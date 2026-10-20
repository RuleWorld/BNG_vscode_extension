import * as vscode from 'vscode';
import * as path from 'path';
import { parseDat } from '../parseDat';
import { parseBnglDocument } from '../server/parser';
import { getGraphmlVisualizationKind, getStandaloneGraphPaletteKind, shouldUseStandaloneRulevizLayout } from '../resultsFolders';

type RulevizViewKind = 'operation' | 'pattern';

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Resolve a destination URI for a webview-provided filename, rejecting path traversal
// (separators, `.`/`..`, absolute paths) so a malicious title cannot escape `folder`.
export function resolveSafeOutputUri(folder: vscode.Uri, fileName: string): vscode.Uri | undefined {
    if (typeof fileName !== 'string' || fileName.length === 0) {
        return undefined;
    }
    // a legitimate output filename is a single path segment, not a traversal token
    if (fileName !== path.basename(fileName) || fileName === '.' || fileName === '..') {
        return undefined;
    }
    const uri = vscode.Uri.joinPath(folder, fileName);
    // defense-in-depth: confirm the resolved path stays under the target folder
    const relative = path.relative(folder.fsPath, uri.fsPath);
    if (relative.length === 0 || relative.startsWith('..') || path.isAbsolute(relative)) {
        return undefined;
    }
    return uri;
}

function getCanonicalRulevizBrowserBaseName(filePath: string): string | undefined {
    const extension = path.extname(filePath).toLowerCase();
    if (extension !== '.graphml') {
        return undefined;
    }

    const graphBaseName = path.basename(filePath, path.extname(filePath));
    const match = graphBaseName.match(/^(.*)_ruleviz_(?:operation|pattern)_.+$/i);
    return match ? `${match[1]}_ruleviz` : undefined;
}

function getCanonicalGraphmlBaseName(filePath: string): string {
    return getCanonicalRulevizBrowserBaseName(filePath)
        ?? path.basename(filePath, path.extname(filePath));
}

function getPlotPanelKey(filePath: string): string {
    const canonicalRulevizBaseName = getCanonicalRulevizBrowserBaseName(filePath);
    if (!canonicalRulevizBaseName) {
        return filePath;
    }

    return path.join(path.dirname(filePath), `${canonicalRulevizBaseName}.graphml`);
}

function getPanelTitle(fpath: string): string {
    const extension = path.extname(fpath).substring(1);
    const fname = extension === 'graphml'
        ? getCanonicalGraphmlBaseName(fpath)
        : path.basename(fpath, path.extname(fpath));

    if (extension === 'graphml') {
        return fname;
    }
    if (extension === 'gdat' || extension === 'cdat') {
        return path.basename(fpath);
    }
    if (extension === 'scan') {
        return path.basename(fpath);
    }
    return 'Unknown';
}

function getExportBaseName(fname: string, ext: string): string {
    return ext === 'graphml' ? fname : `${fname}_${ext}`;
}

function getPreferredModelBaseName(graphmlPath: string): string {
    const graphBaseName = getCanonicalGraphmlBaseName(graphmlPath);
    return graphBaseName
        .replace(/_contactmap$/i, '')
        .replace(/_regulatory$/i, '')
        .replace(/_ruleviz_operation$/i, '')
        .replace(/_ruleviz_pattern$/i, '')
        .replace(/_ruleviz$/i, '');
}

function getPreferredSiblingBnglName(graphmlPath: string, siblingNames: readonly string[]): string | undefined {
    const bnglNames = siblingNames.filter((name) => path.extname(name).toLowerCase() === '.bngl');
    if (bnglNames.length === 0) {
        return undefined;
    }

    const preferredModelBaseName = getPreferredModelBaseName(graphmlPath);
    const preferredName = bnglNames.find((name) => path.basename(name, path.extname(name)) === preferredModelBaseName);
    return preferredName ?? bnglNames[0];
}

function getRuleDisplayLabel(rawLabel: string, index: number): string {
    const trimmedLabel = rawLabel.trim();
    return trimmedLabel || `_R${index + 1}`;
}

function getRegulatoryReverseRuleDisplayLabels(displayLabel: string): string[] {
    const variants = new Set<string>();
    const trimmedLabel = displayLabel.trim();
    if (!trimmedLabel) {
        return [];
    }

    variants.add(`_reverse_${trimmedLabel}`);
    variants.add(`reverse_${trimmedLabel}`);

    if (trimmedLabel.startsWith('_')) {
        const withoutLeadingUnderscore = trimmedLabel.slice(1);
        if (withoutLeadingUnderscore) {
            variants.add(`_reverse_${withoutLeadingUnderscore}`);
            variants.add(`reverse_${withoutLeadingUnderscore}`);
        }
    }

    return Array.from(variants);
}

function getRulevizReverseRuleDisplayLabel(displayLabel: string): string {
    return `_reverse_${displayLabel.trim()}`;
}

function getRulevizSplitGraphName(viewKind: RulevizViewKind): string {
    return viewKind === 'pattern' ? 'ruleviz_pattern' : 'ruleviz_operation';
}

function getRulevizSplitSuffix(fileName: string, viewKind: RulevizViewKind): string | undefined {
    if (path.extname(fileName).toLowerCase() !== '.graphml') {
        return undefined;
    }

    const baseName = path.basename(fileName, path.extname(fileName));
    const match = baseName.match(new RegExp(`^(.*_${getRulevizSplitGraphName(viewKind)})_(.+)$`, 'i'));
    return match?.[2];
}

function isRulevizSplitGraphmlFileName(fileName: string, viewKind: RulevizViewKind): boolean {
    return getGraphmlVisualizationKind(fileName) === getRulevizSplitGraphName(viewKind)
        && typeof getRulevizSplitSuffix(fileName, viewKind) === 'string';
}

interface RulevizBrowserRow {
    fileName: string;
    graphmlText: string;
    displayLabel: string;
    bnglText?: string;
}

interface RulevizBrowserViewData {
    graphKind: `ruleviz_${RulevizViewKind}`;
    rows: RulevizBrowserRow[];
}

interface RulevizBrowserViews {
    operation?: RulevizBrowserViewData;
    pattern?: RulevizBrowserViewData;
}

async function getRegulatoryRuleBnglByLabel(
    graphmlPath: string,
    folderUri: vscode.Uri,
    siblingNames: readonly string[]
): Promise<Record<string, string> | undefined> {
    const bnglName = getPreferredSiblingBnglName(graphmlPath, siblingNames);
    if (!bnglName) {
        return undefined;
    }

    const bnglUri = vscode.Uri.joinPath(folderUri, bnglName);
    const rawBytes = await vscode.workspace.fs.readFile(bnglUri);
    const text = Buffer.from(rawBytes).toString('utf8');
    const doc = parseBnglDocument(text);

    if (doc.rules.length === 0) {
        return undefined;
    }

    const byLabel: Record<string, string> = {};
    doc.rules.forEach((rule, index) => {
        const displayLabel = getRuleDisplayLabel(rule.label, index);
        const sourceText = rule.sourceText.trim();
        if (!sourceText) {
            return;
        }

        byLabel[displayLabel] = sourceText;
        if (/^_R\d+$/i.test(displayLabel)) {
            byLabel[displayLabel.slice(1)] = sourceText;
        }
        if (sourceText.includes('<->')) {
            for (const reverseLabel of getRegulatoryReverseRuleDisplayLabels(displayLabel)) {
                byLabel[reverseLabel] = sourceText;
            }
        }
    });

    return Object.keys(byLabel).length === 0 ? undefined : byLabel;
}

async function getRulevizBrowserRows(
    graphmlPath: string,
    folderUri: vscode.Uri,
    siblingNames: readonly string[],
    viewKind: RulevizViewKind
): Promise<RulevizBrowserRow[] | undefined> {
    const splitGraphmlNames = siblingNames
        .filter((name) => isRulevizSplitGraphmlFileName(name, viewKind))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));

    if (splitGraphmlNames.length === 0) {
        return undefined;
    }

    const graphmlNameBySuffix = new Map<string, string>();
    splitGraphmlNames.forEach((name) => {
        const suffix = getRulevizSplitSuffix(name, viewKind);
        if (suffix) {
            graphmlNameBySuffix.set(suffix, name);
        }
    });

    const orderedRows: Array<Omit<RulevizBrowserRow, 'graphmlText'>> = [];
    const consumedFileNames = new Set<string>();
    const bnglName = getPreferredSiblingBnglName(graphmlPath, siblingNames);

    if (bnglName) {
        try {
            const bnglUri = vscode.Uri.joinPath(folderUri, bnglName);
            const rawBytes = await vscode.workspace.fs.readFile(bnglUri);
            const text = Buffer.from(rawBytes).toString('utf8');
            const doc = parseBnglDocument(text);

            doc.rules.forEach((rule, index) => {
                const displayLabel = getRuleDisplayLabel(rule.label, index);
                const sourceText = rule.sourceText.trim();
                const forwardFileName = graphmlNameBySuffix.get(displayLabel);

                if (forwardFileName) {
                    orderedRows.push({
                        fileName: forwardFileName,
                        displayLabel: displayLabel,
                        bnglText: sourceText || undefined
                    });
                    consumedFileNames.add(forwardFileName);
                }

                if (!sourceText.includes('<->')) {
                    return;
                }

                const reverseDisplayLabel = getRulevizReverseRuleDisplayLabel(displayLabel);
                const reverseFileName = graphmlNameBySuffix.get(reverseDisplayLabel);
                if (!reverseFileName) {
                    return;
                }

                orderedRows.push({
                    fileName: reverseFileName,
                    displayLabel: reverseDisplayLabel,
                    bnglText: sourceText || undefined
                });
                consumedFileNames.add(reverseFileName);
            });
        } catch {
            // Fall back to filename-only metadata below.
        }
    }

    splitGraphmlNames.forEach((name) => {
        if (consumedFileNames.has(name)) {
            return;
        }

        const suffix = getRulevizSplitSuffix(name, viewKind);
        if (!suffix) {
            return;
        }

        orderedRows.push({
            fileName: name,
            displayLabel: suffix
        });
    });

    if (orderedRows.length === 0) {
        return undefined;
    }

    const rows: RulevizBrowserRow[] = [];
    for (const row of orderedRows) {
        const graphmlUri = vscode.Uri.joinPath(folderUri, row.fileName);
        const rawBytes = await vscode.workspace.fs.readFile(graphmlUri);
        rows.push({
            ...row,
            graphmlText: Buffer.from(rawBytes).toString('utf8')
        });
    }

    return rows;
}

async function getRulevizBrowserViews(
    graphmlPath: string,
    folderUri: vscode.Uri,
    siblingNames: readonly string[]
): Promise<RulevizBrowserViews | undefined> {
    const [operationRows, patternRows] = await Promise.all([
        getRulevizBrowserRows(graphmlPath, folderUri, siblingNames, 'operation'),
        getRulevizBrowserRows(graphmlPath, folderUri, siblingNames, 'pattern')
    ]);

    if (!operationRows && !patternRows) {
        return undefined;
    }

    return {
        operation: operationRows
            ? {
                graphKind: 'ruleviz_operation',
                rows: operationRows
            }
            : undefined,
        pattern: patternRows
            ? {
                graphKind: 'ruleviz_pattern',
                rows: patternRows
            }
            : undefined
    };
}

export class PlotPanel {
    public static currentPanels = new Map<string, PlotPanel>();
    public static readonly viewType = 'plot';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _disposed = false;

    public static disposeAll(): number {
        const panels = Array.from(PlotPanel.currentPanels.values());
        panels.forEach((panel) => panel.dispose());
        return panels.length;
    }

    public static disposeForFolder(folderPath: string) {
        const normalizedFolderPath = path.resolve(folderPath);

        for (const panel of Array.from(PlotPanel.currentPanels.values())) {
            const panelFolderPath = path.resolve(path.dirname(panel._fpath));
            if (panelFolderPath === normalizedFolderPath || panelFolderPath.startsWith(`${normalizedFolderPath}${path.sep}`)) {
                panel.dispose();
            }
        }
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        private _fpath: string,
        private _panelKey: string
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._setup();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'alert':
                    vscode.window.showInformationMessage(message.text);
                    return;
                case 'ready':
                    this._send_figure_data();
                    return;
                case 'image':
                    this._save_image(message);
                    return;
                case 'graphml-export':
                    this._save_graphml_export(message);
                    return;
            }
        }, null, this._disposables);
    }

    public static create(extensionUri: vscode.Uri, target?: vscode.Uri | string, targetColumn?: vscode.ViewColumn) {
        const editor = vscode.window.activeTextEditor;
        const fpath = typeof target === 'string'
            ? target
            : target instanceof vscode.Uri
                ? target.fsPath
                : editor?.document.fileName;
        if (!fpath) return;
        const panelKey = getPlotPanelKey(fpath);

        const column = targetColumn ?? editor?.viewColumn;

        if (PlotPanel.currentPanels.has(panelKey)) {
            PlotPanel.currentPanels.get(panelKey)?._panel.reveal(column);
            return;
        }

        const title = getPanelTitle(fpath);

        const panel = vscode.window.createWebviewPanel(
            PlotPanel.viewType,
            title,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
                retainContextWhenHidden: true
            }
        );

        PlotPanel.currentPanels.set(panelKey, new PlotPanel(panel, extensionUri, fpath, panelKey));
    }

    private _setup() {
        const webview = this._panel.webview;
        const nonce = getNonce();
        const extension = path.extname(this._fpath).substring(1);
        const fname = extension === 'graphml'
            ? getCanonicalGraphmlBaseName(this._fpath)
            : path.basename(this._fpath, path.extname(this._fpath));
        const exportBaseName = getExportBaseName(fname, extension);
        const sourceFilePath = this._fpath;

        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const plotlyUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'plotly-latest.min.js'));
        const cytoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'cytoscape.min.js'));
        const jqUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'jquery-3.5.1.min.js'));
        const stylesMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

        const folder = path.dirname(this._fpath);

        webview.html = this._get_html(webview, nonce, exportBaseName, extension, folder, sourceFilePath, stylesMainUri, jqUri, cytoUri, plotlyUri, scriptUri);
    }

    private _get_html(webview: vscode.Webview, nonce: string, exportBaseName: string, ext: string, folder: string, sourceFilePath: string, stylesMainUri: vscode.Uri, jqUri: vscode.Uri, cytoUri: vscode.Uri, plotlyUri: vscode.Uri, scriptUri: vscode.Uri) {
        const safeExportBaseName = escapeHtml(exportBaseName);
        const safeExt = escapeHtml(ext);
        const safeFolder = escapeHtml(folder);
        const safeSourceFilePath = escapeHtml(sourceFilePath);
        let content = '';
        if (ext === 'graphml') {
            content = `
                <div id="graph_shell">
                    <div id="graph_toolbar">
                    <div class="graph-toolbar-group">
                      <label for="layout_select">Layout</label>
                      <select id="layout_select" class="graph-select">
                        <option value="preset">Preset (GraphML)</option>
                        <option value="breadthfirst">Breadth First</option>
                        <option value="grid">Grid</option>
                        <option value="circle">Circle</option>
                        <option value="concentric">Concentric</option>
                        <option value="cose">Cose</option>
                      </select>
                      <button id="layout_lock_button" class="secondary" type="button">Lock Layout</button>
                      <button id="fit_button" class="secondary" type="button">Scale to Fit</button>
                      <button id="view_mode_button" class="secondary" type="button">Night View</button>
                      <button id="toggle_rule_bngl_button" class="secondary" type="button" hidden>Show Rule BNGL</button>
                      <button id="toggle_ruleviz_view_button" class="secondary" type="button" hidden>Show Pattern</button>
                      <button id="toggle_components_button" class="secondary" type="button" hidden>Hide Components</button>
                      <button id="toggle_internal_states_button" class="secondary" type="button" hidden>Hide Internal States</button>
                    </div>
                    <div class="graph-toolbar-group">
                      <button id="png_button" type="button" title="Save the current graph view as a PNG image">Save PNG</button>
                      <button id="graphml_button" class="secondary" type="button" title="Save a GraphML copy with the current node layout">Save GraphML</button>
                    </div>
                  </div>
                  <div id="network_wrapper">
                    <div id="network"></div>
                    <div id="ruleviz_browser" hidden></div>
                  </div>
                </div>
                <script nonce="${nonce}" src="${jqUri}"></script>
                <script nonce="${nonce}" src="${cytoUri}"></script>
            `;
        } else {
            content = `
                <div id="sidebar">
                    <div class="sidebar-header">
                        <h3>Variables</h3>
                        <div class="sidebar-actions">
                            <button id="show-all" class="secondary">All</button>
                            <button id="show-none" class="secondary">None</button>
                        </div>
                        <input type="text" id="var-filter" placeholder="Filter variables...">
                    </div>
                    <div id="var-list"></div>
                    <div class="sidebar-controls">
                        <div class="control-group">
                            <label>X Axis</label>
                            <div class="control-buttons">
                                <button id="xaxis-linear" class="control-btn active">Linear</button>
                                <button id="xaxis-log" class="control-btn">Log</button>
                            </div>
                        </div>
                        <div class="control-group">
                            <label>Y Axis</label>
                            <div class="control-buttons">
                                <button id="yaxis-linear" class="control-btn active">Linear</button>
                                <button id="yaxis-log" class="control-btn">Log</button>
                            </div>
                        </div>
                        <div class="control-group">
                            <label>Legend</label>
                            <div class="control-buttons">
                                <button id="legend-on" class="control-btn active">On</button>
                                <button id="legend-off" class="control-btn">Off</button>
                            </div>
                        </div>
                        <div class="control-group">
                            <label>Style</label>
                            <div class="control-buttons">
                                <button id="style-lines" class="control-btn active">Lines</button>
                                <button id="style-markers" class="control-btn">Markers</button>
                                <button id="style-both" class="control-btn">Both</button>
                            </div>
                        </div>
                    </div>
                    <div class="sidebar-footer">
                        <button id="view_mode_button" class="secondary">Night View</button>
                        <button id="export-png" title="Save the current plot as a PNG image">Save PNG</button>
                        <button id="export-svg" class="secondary" title="Save the current plot as an SVG image">Save SVG</button>
                    </div>
                </div>
                <div id="plot-container">
                    <div id="plot_meta_bar">
                        <div class="plot-meta-block">
                            <div class="plot-meta-caption">Output file</div>
                            <div id="plot_source_path" class="plot-source-path" title="${safeSourceFilePath}">${safeSourceFilePath}</div>
                            <div id="plot_source_summary" class="plot-source-summary"></div>
                        </div>
                        <div class="plot-view-switch" role="tablist" aria-label="Plot viewer mode">
                            <button id="plot_view_plot_button" class="secondary" type="button" aria-pressed="true">Plot</button>
                            <button id="plot_view_data_button" class="secondary" type="button" aria-pressed="false">Data</button>
                        </div>
                    </div>
                    <div id="plot_viewport">
                        <div id="plot"></div>
                        <div id="plot_data_panel" hidden>
                            <div id="plot_data_empty" class="plot-data-empty" hidden>No data rows were available in this output file.</div>
                            <div class="plot-data-table-shell">
                                <table id="plot_data_table" class="plot-data-table"></table>
                            </div>
                        </div>
                    </div>
                </div>
                <script nonce="${nonce}" src="${plotlyUri}"></script>
            `;
        }

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data: blob:; script-src 'nonce-${nonce}' 'unsafe-eval';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${stylesMainUri}" rel="stylesheet">
            </head>
            <body class="${ext === 'graphml' ? 'graph-view' : 'plot-view'}">
                <div id="page_title" style="display: none;">${safeExportBaseName}</div>
                <div id="page_extension" style="display: none;">${safeExt}</div>
                <div id="folder" style="display: none;">${safeFolder}</div>
                ${content}
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    private async _send_figure_data() {
        const ext = path.extname(this._fpath).substring(1);
        const fileUri = vscode.Uri.file(this._fpath);
        const rawBytes = await vscode.workspace.fs.readFile(fileUri);
        const text = Buffer.from(rawBytes).toString('utf8');
        const config = vscode.workspace.getConfiguration('bngl');

        if (ext === 'graphml') {
            const folderUri = vscode.Uri.file(path.dirname(this._fpath));
            const graphKind = getGraphmlVisualizationKind(this._fpath);
            let standaloneGraphPaletteKind: string | null = null;
            let useStandaloneRulevizBrowser = false;
            let regulatoryRuleBnglByLabel: Record<string, string> | undefined;
            let rulevizBrowserViews: RulevizBrowserViews | undefined;

            try {
                const entries = await vscode.workspace.fs.readDirectory(folderUri);
                const siblingNames = entries.map(([name]) => name);
                standaloneGraphPaletteKind = getStandaloneGraphPaletteKind(
                    this._fpath,
                    siblingNames
                );
                useStandaloneRulevizBrowser = shouldUseStandaloneRulevizLayout(
                    this._fpath,
                    siblingNames
                );
                if (graphKind === 'regulatory') {
                    regulatoryRuleBnglByLabel = await getRegulatoryRuleBnglByLabel(this._fpath, folderUri, siblingNames);
                }
                if ((graphKind === 'ruleviz_operation' || graphKind === 'ruleviz_pattern') && useStandaloneRulevizBrowser) {
                    rulevizBrowserViews = await getRulevizBrowserViews(this._fpath, folderUri, siblingNames);
                }
            } catch {
                standaloneGraphPaletteKind = null;
                useStandaloneRulevizBrowser = false;
                regulatoryRuleBnglByLabel = undefined;
                rulevizBrowserViews = undefined;
            }

            if ((graphKind === 'ruleviz_operation' || graphKind === 'ruleviz_pattern') && useStandaloneRulevizBrowser && rulevizBrowserViews) {
                const initialView: RulevizViewKind = rulevizBrowserViews.pattern
                    ? 'pattern'
                    : 'operation';
                this._panel.webview.postMessage({
                    command: 'ruleviz-browser',
                    context: 'data',
                    graphKind: 'ruleviz',
                    standaloneGraphPaletteKind: 'ruleviz',
                    initialView,
                    views: rulevizBrowserViews
                });
                return;
            }

            this._panel.webview.postMessage({
                command: 'network',
                context: 'data',
                data: text,
                graphKind,
                standaloneGraphPaletteKind,
                regulatoryRuleBnglByLabel
            });
        } else {
            const data = parseDat(text);
            this._panel.webview.postMessage({
                command: 'plot',
                context: 'data',
                names: data[0],
                data: data[1],
                legend: config.get('plotting.legend'),
                max_series: config.get('plotting.max_series_count'),
            });
        }
    }

    private _save_image(message: any) {
        const folder = vscode.Uri.file(message.folder);
        const suffix = message.suffix ? `_${message.suffix}` : '';
        const ext = message.type === 'png' ? 'png' : 'svg';
        const uri = resolveSafeOutputUri(folder, `${message.title}${suffix}.${ext}`);
        if (!uri) {
            vscode.window.showErrorMessage('Invalid image file name.');
            return;
        }
        let data: Buffer;
        if (message.type === 'png') {
            const prefix = 'data:image/png;base64,';
            if (!message.text.startsWith(prefix)) {
                vscode.window.showErrorMessage('Invalid PNG data URI.');
                return;
            }
            data = Buffer.from(message.text.slice(prefix.length), 'base64');
        } else {
            const prefix = 'data:image/svg+xml,';
            let decoded: string;
            try {
                decoded = decodeURIComponent(message.text);
            } catch {
                vscode.window.showErrorMessage('Invalid SVG data URI.');
                return;
            }
            if (!decoded.startsWith(prefix)) {
                vscode.window.showErrorMessage('Invalid SVG data URI.');
                return;
            }
            data = Buffer.from(decoded.slice(prefix.length));
        }
        vscode.workspace.fs.writeFile(uri, data).then(() => {
            vscode.window.showInformationMessage(`Image saved to ${uri.fsPath}`);
        }, (err) => {
            vscode.window.showErrorMessage(`Failed to save image: ${err.message}`);
        });
    }

    private _save_graphml_export(message: any) {
        const folder = vscode.Uri.file(message.folder);
        const candidates = Array.isArray(message.files)
            ? message.files.filter((file: any) => typeof file?.title === 'string' && typeof file?.text === 'string')
            : [];

        if (candidates.length > 0) {
            const files: { uri: vscode.Uri, data: Buffer }[] = [];
            for (const file of candidates) {
                const uri = resolveSafeOutputUri(folder, `${file.title}.graphml`);
                if (!uri) {
                    vscode.window.showErrorMessage('Invalid GraphML file name.');
                    return;
                }
                files.push({ uri, data: Buffer.from(file.text, 'utf8') });
            }
            Promise.all(files.map((file) => vscode.workspace.fs.writeFile(file.uri, file.data))).then(() => {
                const messageText = files.length === 1
                    ? `GraphML saved to ${files[0].uri.fsPath}`
                    : `${files.length} GraphML files saved to ${folder.fsPath}`;
                vscode.window.showInformationMessage(messageText);
            }, (err) => {
                vscode.window.showErrorMessage(`Failed to save GraphML: ${err.message}`);
            });
            return;
        }

        const uri = resolveSafeOutputUri(folder, `${message.title}.graphml`);
        if (!uri) {
            vscode.window.showErrorMessage('Invalid GraphML file name.');
            return;
        }
        const data = Buffer.from(message.text, 'utf8');

        vscode.workspace.fs.writeFile(uri, data).then(() => {
            vscode.window.showInformationMessage(`GraphML saved to ${uri.fsPath}`);
        }, (err) => {
            vscode.window.showErrorMessage(`Failed to save GraphML: ${err.message}`);
        });
    }

    public dispose() {
        if (this._disposed) {
            return;
        }

        this._disposed = true;
        PlotPanel.currentPanels.delete(this._panelKey);
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) x.dispose();
        }
    }
}
