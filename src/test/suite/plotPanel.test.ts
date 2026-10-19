import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { PlotPanel, resolveSafeOutputUri } from '../../plotting/PlotPanel';

const SAMPLE_GRAPHML = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:y="http://www.yworks.com/xml/graphml">
  <key id="d0" for="node" yfiles.type="nodegraphics"/>
  <key id="d1" for="edge" yfiles.type="edgegraphics"/>
  <graph edgedefault="directed" id="G">
    <node id="n0">
      <data key="d0">
        <y:ShapeNode>
          <y:Fill color="#FFE9C7"/>
          <y:BorderStyle color="#999999" type="line" width="1"/>
          <y:Shape type="roundrectangle"/>
          <y:NodeLabel textColor="#000000">A</y:NodeLabel>
        </y:ShapeNode>
      </data>
    </node>
    <node id="n1">
      <data key="d0">
        <y:ShapeNode>
          <y:Fill color="#FFE9C7"/>
          <y:BorderStyle color="#999999" type="line" width="1"/>
          <y:Shape type="roundrectangle"/>
          <y:NodeLabel textColor="#000000">B</y:NodeLabel>
        </y:ShapeNode>
      </data>
    </node>
    <edge id="e0" source="n0" target="n1">
      <data key="d1">
        <y:PolyLineEdge>
          <y:LineStyle color="#999999" type="line" width="1"/>
          <y:Arrows source="none" target="standard"/>
        </y:PolyLineEdge>
      </data>
    </edge>
  </graph>
</graphml>
`;

const SAMPLE_REGULATORY_GRAPHML = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:y="http://www.yworks.com/xml/graphml">
  <key id="d0" for="node" yfiles.type="nodegraphics"/>
  <graph edgedefault="directed" id="G">
    <node id="n0">
      <data key="d0">
        <y:ShapeNode>
          <y:Fill color="#FFE9C7"/>
          <y:BorderStyle color="#999999" type="line" width="1"/>
          <y:Shape type="roundrectangle"/>
          <y:NodeLabel textColor="#000000">A()</y:NodeLabel>
        </y:ShapeNode>
      </data>
    </node>
    <node id="n1">
      <data key="d0">
        <y:ShapeNode>
          <y:Fill color="#CC99FF"/>
          <y:BorderStyle color="#999999" type="line" width="1"/>
          <y:Shape type="ellipse"/>
          <y:NodeLabel textColor="#000000"></y:NodeLabel>
        </y:ShapeNode>
      </data>
    </node>
    <node id="n2">
      <data key="d0">
        <y:ShapeNode>
          <y:Fill color="#CC99FF"/>
          <y:BorderStyle color="#999999" type="line" width="1"/>
          <y:Shape type="ellipse"/>
          <y:NodeLabel textColor="#000000"></y:NodeLabel>
        </y:ShapeNode>
      </data>
    </node>
  </graph>
</graphml>
`;

const SAMPLE_MODEL_BNGL = [
    'begin model',
    'begin reaction rules',
    'A() <-> B() kf, kr',
    'namedRule: B() -> C() k2',
    'end reaction rules',
    'end model',
    ''
].join('\n');

const SAMPLE_GDAT = [
    '# time A B',
    '0 1 2',
    '1 3 4',
    ''
].join('\n');

suite('PlotPanel', () => {
    let tmpDir: string;
    let modelPath: string;
    let graphmlPath: string;
    let gdatPath: string;
    let regulatoryGraphmlPath: string;
    let rulevizOperationGraphmlPath: string;
    let splitRulevizOperationGraphmlPath: string;
    let splitDualRulevizOperationGraphmlPath: string;
    let splitDualRulevizPatternGraphmlPath: string;

    suiteSetup(async function () {
        this.timeout(30_000);

        const ext = vscode.extensions.getExtension('BioNetGen-ext.biontegen-vscode-extension');
        if (ext && !ext.isActive) {
            await ext.activate();
        }
    });

    setup(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bngl-plotpanel-test-'));
        const contactMapDir = path.join(tmpDir, 'contactmap');
        const plotDir = path.join(tmpDir, 'plot');
        const regulatoryDir = path.join(tmpDir, 'regulatory');
        const rulevizDir = path.join(tmpDir, 'ruleviz');
        const splitRulevizDir = path.join(tmpDir, 'ruleviz_split');
        const splitDualRulevizDir = path.join(tmpDir, 'ruleviz_split_dual');

        [contactMapDir, plotDir, regulatoryDir, rulevizDir, splitRulevizDir, splitDualRulevizDir].forEach((dir) => {
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, 'test_model.bngl'), SAMPLE_MODEL_BNGL, 'utf8');
        });

        modelPath = path.join(contactMapDir, 'test_model.bngl');
        graphmlPath = path.join(contactMapDir, 'test_contactmap.graphml');
        fs.writeFileSync(graphmlPath, SAMPLE_GRAPHML, 'utf8');
        gdatPath = path.join(plotDir, 'test_model.gdat');
        fs.writeFileSync(gdatPath, SAMPLE_GDAT, 'utf8');
        regulatoryGraphmlPath = path.join(regulatoryDir, 'test_model_regulatory.graphml');
        fs.writeFileSync(regulatoryGraphmlPath, SAMPLE_REGULATORY_GRAPHML, 'utf8');
        rulevizOperationGraphmlPath = path.join(rulevizDir, 'test_model_ruleviz_operation.graphml');
        fs.writeFileSync(rulevizOperationGraphmlPath, SAMPLE_GRAPHML, 'utf8');
        splitRulevizOperationGraphmlPath = path.join(splitRulevizDir, 'test_model_ruleviz_operation__R1.graphml');
        fs.writeFileSync(splitRulevizOperationGraphmlPath, SAMPLE_GRAPHML, 'utf8');
        fs.writeFileSync(path.join(splitRulevizDir, 'test_model_ruleviz_operation__reverse__R1.graphml'), SAMPLE_GRAPHML, 'utf8');
        fs.writeFileSync(path.join(splitRulevizDir, 'test_model_ruleviz_operation_namedRule.graphml'), SAMPLE_GRAPHML, 'utf8');

        splitDualRulevizOperationGraphmlPath = path.join(splitDualRulevizDir, 'test_model_ruleviz_operation__R1.graphml');
        splitDualRulevizPatternGraphmlPath = path.join(splitDualRulevizDir, 'test_model_ruleviz_pattern__R1.graphml');
        fs.writeFileSync(splitDualRulevizOperationGraphmlPath, SAMPLE_GRAPHML, 'utf8');
        fs.writeFileSync(path.join(splitDualRulevizDir, 'test_model_ruleviz_operation__reverse__R1.graphml'), SAMPLE_GRAPHML, 'utf8');
        fs.writeFileSync(path.join(splitDualRulevizDir, 'test_model_ruleviz_operation_namedRule.graphml'), SAMPLE_GRAPHML, 'utf8');
        fs.writeFileSync(splitDualRulevizPatternGraphmlPath, SAMPLE_GRAPHML, 'utf8');
        fs.writeFileSync(path.join(splitDualRulevizDir, 'test_model_ruleviz_pattern__reverse__R1.graphml'), SAMPLE_GRAPHML, 'utf8');
        fs.writeFileSync(path.join(splitDualRulevizDir, 'test_model_ruleviz_pattern_namedRule.graphml'), SAMPLE_GRAPHML, 'utf8');
    });

    teardown(async () => {
        Array.from(PlotPanel.currentPanels.values()).forEach((panel) => panel.dispose());
        PlotPanel.currentPanels.clear();

        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('uses graph-specific titles and exposes layout/save controls for GraphML', async function () {
        this.timeout(15_000);

        PlotPanel.create(
            vscode.extensions.getExtension('BioNetGen-ext.biontegen-vscode-extension')!.extensionUri,
            vscode.Uri.file(graphmlPath),
            vscode.ViewColumn.One
        );

        const panelWrapper = PlotPanel.currentPanels.get(graphmlPath) as any;
        assert.ok(panelWrapper, 'expected a PlotPanel instance for the explicit GraphML file');

        const panel = panelWrapper._panel as vscode.WebviewPanel;
        assert.strictEqual(panel.title, 'test_contactmap');

        const html = panel.webview.html;
        assert.match(html, /id="layout_select"/);
        assert.match(html, /Lock Layout/);
        assert.match(html, /Scale to Fit/);
        assert.match(html, /Night View/);
        assert.match(html, /Hide Components/);
        assert.match(html, /Hide Internal States/);
        assert.match(html, /Save PNG/);
        assert.match(html, /Save GraphML/);
        assert.doesNotMatch(html, /Delete Results/);
        assert.doesNotMatch(html, /Apply Layout/);
        assert.doesNotMatch(html, /Reset View/);

        PlotPanel.create(
            vscode.extensions.getExtension('BioNetGen-ext.biontegen-vscode-extension')!.extensionUri,
            vscode.Uri.file(graphmlPath),
            vscode.ViewColumn.One
        );
        assert.strictEqual(PlotPanel.currentPanels.size, 1, 'expected re-opening to reuse the existing panel');
    });

    test('uses source filenames for plot viewer titles and exposes plot/data toggle controls', async function () {
        this.timeout(15_000);

        PlotPanel.create(
            vscode.extensions.getExtension('BioNetGen-ext.biontegen-vscode-extension')!.extensionUri,
            vscode.Uri.file(gdatPath),
            vscode.ViewColumn.One
        );

        const panelWrapper = PlotPanel.currentPanels.get(gdatPath) as any;
        assert.ok(panelWrapper, 'expected a PlotPanel instance for the GDAT file');

        const panel = panelWrapper._panel as vscode.WebviewPanel;
        assert.strictEqual(panel.title, 'test_model.gdat');

        const html = panel.webview.html;
        assert.match(html, /Output file/);
        assert.match(html, /test_model\.gdat/);
        assert.doesNotMatch(html, /id="plot_source_name"/);
        assert.match(html, /id="plot_view_plot_button"/);
        assert.match(html, /id="plot_view_data_button"/);
        assert.match(html, /id="plot_data_table"/);
    });

    test('uses a unified RuleViz title for the standalone browser and reuses one panel across pattern and operation split files', async function () {
        this.timeout(15_000);

        PlotPanel.create(
            vscode.extensions.getExtension('BioNetGen-ext.biontegen-vscode-extension')!.extensionUri,
            vscode.Uri.file(splitDualRulevizPatternGraphmlPath),
            vscode.ViewColumn.One
        );

        const panelWrapper = Array.from(PlotPanel.currentPanels.values())[0] as any;
        assert.ok(panelWrapper, 'expected a PlotPanel instance for the split RuleViz GraphML files');

        const panel = panelWrapper._panel as vscode.WebviewPanel;
        assert.strictEqual(panel.title, 'test_model_ruleviz');

        PlotPanel.create(
            vscode.extensions.getExtension('BioNetGen-ext.biontegen-vscode-extension')!.extensionUri,
            vscode.Uri.file(splitDualRulevizOperationGraphmlPath),
            vscode.ViewColumn.One
        );

        assert.strictEqual(PlotPanel.currentPanels.size, 1, 'expected split RuleViz pattern and operation files to share one panel');
    });

    test('can open a viewer for an explicit file without replacing the current model editor', async function () {
        this.timeout(15_000);

        const modelDoc = await vscode.workspace.openTextDocument(modelPath);
        const modelEditor = await vscode.window.showTextDocument(modelDoc, {
            preview: true,
            viewColumn: vscode.ViewColumn.One
        });

        PlotPanel.create(
            vscode.extensions.getExtension('BioNetGen-ext.biontegen-vscode-extension')!.extensionUri,
            vscode.Uri.file(graphmlPath),
            modelEditor.viewColumn
        );

        const panelWrapper = PlotPanel.currentPanels.get(graphmlPath) as any;
        assert.ok(panelWrapper, 'expected a PlotPanel instance for the explicit GraphML file');
        assert.strictEqual(vscode.window.activeTextEditor?.document.fileName, modelPath);

        const openTextEditors = vscode.window.visibleTextEditors.map((editor) => editor.document.fileName);
        assert.ok(openTextEditors.includes(modelPath), 'expected the BNGL model editor to remain open');
        assert.ok(!openTextEditors.includes(graphmlPath), 'expected the raw GraphML text editor not to be opened');
    });

    test('reports standalone regulatory graph metadata and BNGL rule text for regulatory GraphML', async function () {
        this.timeout(15_000);

        PlotPanel.create(
            vscode.extensions.getExtension('BioNetGen-ext.biontegen-vscode-extension')!.extensionUri,
            vscode.Uri.file(regulatoryGraphmlPath),
            vscode.ViewColumn.One
        );

        const panelWrapper = PlotPanel.currentPanels.get(regulatoryGraphmlPath) as any;
        assert.ok(panelWrapper, 'expected a PlotPanel instance for the regulatory GraphML file');

        const panel = panelWrapper._panel as vscode.WebviewPanel;
        const postedMessages: any[] = [];
        const originalPostMessage = panel.webview.postMessage.bind(panel.webview);
        panel.webview.postMessage = ((message: any) => {
            postedMessages.push(message);
            return Promise.resolve(true);
        }) as typeof panel.webview.postMessage;

        try {
            await panelWrapper._send_figure_data();
        } finally {
            panel.webview.postMessage = originalPostMessage;
        }

        const networkMessage = postedMessages.find((message) => message.command === 'network');
        assert.ok(networkMessage, 'expected a network payload to be posted to the webview');
        assert.strictEqual(networkMessage.graphKind, 'regulatory');
        assert.strictEqual(networkMessage.standaloneGraphPaletteKind, 'regulatory');
        assert.strictEqual(networkMessage.regulatoryRuleBnglByLabel._R1, 'A() <-> B() kf, kr');
        assert.strictEqual(networkMessage.regulatoryRuleBnglByLabel._reverse__R1, 'A() <-> B() kf, kr');
        assert.strictEqual(networkMessage.regulatoryRuleBnglByLabel.namedRule, 'namedRule: B() -> C() k2');
    });

    test('reports standalone RuleViz metadata for operation GraphML', async function () {
        this.timeout(15_000);

        PlotPanel.create(
            vscode.extensions.getExtension('BioNetGen-ext.biontegen-vscode-extension')!.extensionUri,
            vscode.Uri.file(rulevizOperationGraphmlPath),
            vscode.ViewColumn.One
        );

        const panelWrapper = PlotPanel.currentPanels.get(rulevizOperationGraphmlPath) as any;
        assert.ok(panelWrapper, 'expected a PlotPanel instance for the RuleViz GraphML file');

        const panel = panelWrapper._panel as vscode.WebviewPanel;
        const postedMessages: any[] = [];
        const originalPostMessage = panel.webview.postMessage.bind(panel.webview);
        panel.webview.postMessage = ((message: any) => {
            postedMessages.push(message);
            return Promise.resolve(true);
        }) as typeof panel.webview.postMessage;

        try {
            await panelWrapper._send_figure_data();
        } finally {
            panel.webview.postMessage = originalPostMessage;
        }

        const networkMessage = postedMessages.find((message) => message.command === 'network');
        assert.ok(networkMessage, 'expected a network payload to be posted to the webview');
        assert.strictEqual(networkMessage.graphKind, 'ruleviz_operation');
        assert.strictEqual(networkMessage.standaloneGraphPaletteKind, 'ruleviz_operation');
    });

    test('bundles standalone split RuleViz operation outputs into an ordered browser payload', async function () {
        this.timeout(15_000);

        PlotPanel.create(
            vscode.extensions.getExtension('BioNetGen-ext.biontegen-vscode-extension')!.extensionUri,
            vscode.Uri.file(splitRulevizOperationGraphmlPath),
            vscode.ViewColumn.One
        );

        const panelWrapper = Array.from(PlotPanel.currentPanels.values())[0] as any;
        assert.ok(panelWrapper, 'expected a PlotPanel instance for the split RuleViz GraphML files');

        const panel = panelWrapper._panel as vscode.WebviewPanel;
        const postedMessages: any[] = [];
        const originalPostMessage = panel.webview.postMessage.bind(panel.webview);
        panel.webview.postMessage = ((message: any) => {
            postedMessages.push(message);
            return Promise.resolve(true);
        }) as typeof panel.webview.postMessage;

        try {
            await panelWrapper._send_figure_data();
        } finally {
            panel.webview.postMessage = originalPostMessage;
        }

        const browserMessage = postedMessages.find((message) => message.command === 'ruleviz-browser');
        assert.ok(browserMessage, 'expected a standalone RuleViz browser payload to be posted to the webview');
        assert.strictEqual(browserMessage.graphKind, 'ruleviz');
        assert.strictEqual(browserMessage.standaloneGraphPaletteKind, 'ruleviz');
        assert.strictEqual(browserMessage.initialView, 'operation');
        assert.strictEqual(browserMessage.views.operation.rows.length, 3);
        assert.strictEqual(browserMessage.views.operation.rows[0].displayLabel, '_R1');
        assert.strictEqual(browserMessage.views.operation.rows[0].bnglText, 'A() <-> B() kf, kr');
        assert.strictEqual(browserMessage.views.operation.rows[1].displayLabel, '_reverse__R1');
        assert.strictEqual(browserMessage.views.operation.rows[1].bnglText, 'A() <-> B() kf, kr');
        assert.strictEqual(browserMessage.views.operation.rows[2].displayLabel, 'namedRule');
        assert.strictEqual(browserMessage.views.operation.rows[2].bnglText, 'namedRule: B() -> C() k2');
        assert.strictEqual(browserMessage.views.pattern, undefined);
    });

    test('defaults dual-view standalone RuleViz browser to pattern even when opened from an operation GraphML', async function () {
        this.timeout(15_000);

        PlotPanel.create(
            vscode.extensions.getExtension('BioNetGen-ext.biontegen-vscode-extension')!.extensionUri,
            vscode.Uri.file(splitDualRulevizOperationGraphmlPath),
            vscode.ViewColumn.One
        );

        const panelWrapper = Array.from(PlotPanel.currentPanels.values())[0] as any;
        assert.ok(panelWrapper, 'expected a PlotPanel instance for the dual-view split RuleViz GraphML files');

        const panel = panelWrapper._panel as vscode.WebviewPanel;
        const postedMessages: any[] = [];
        const originalPostMessage = panel.webview.postMessage.bind(panel.webview);
        panel.webview.postMessage = ((message: any) => {
            postedMessages.push(message);
            return Promise.resolve(true);
        }) as typeof panel.webview.postMessage;

        try {
            await panelWrapper._send_figure_data();
        } finally {
            panel.webview.postMessage = originalPostMessage;
        }

        const browserMessage = postedMessages.find((message) => message.command === 'ruleviz-browser');
        assert.ok(browserMessage, 'expected a dual-view standalone RuleViz browser payload to be posted to the webview');
        assert.strictEqual(browserMessage.graphKind, 'ruleviz');
        assert.strictEqual(browserMessage.standaloneGraphPaletteKind, 'ruleviz');
        assert.strictEqual(browserMessage.initialView, 'pattern');
        assert.strictEqual(browserMessage.views.operation.rows.length, 3);
        assert.strictEqual(browserMessage.views.pattern.rows.length, 3);
        assert.strictEqual(browserMessage.views.pattern.rows[0].displayLabel, '_R1');
        assert.strictEqual(browserMessage.views.pattern.rows[0].bnglText, 'A() <-> B() kf, kr');
        assert.strictEqual(browserMessage.views.pattern.rows[1].displayLabel, '_reverse__R1');
        assert.strictEqual(browserMessage.views.pattern.rows[1].bnglText, 'A() <-> B() kf, kr');
        assert.strictEqual(browserMessage.views.pattern.rows[2].displayLabel, 'namedRule');
        assert.strictEqual(browserMessage.views.pattern.rows[2].bnglText, 'namedRule: B() -> C() k2');
    });
});

suite('resolveSafeOutputUri', () => {
    const folder = vscode.Uri.file(path.join(os.tmpdir(), 'bngl-output'));

    test('accepts a plain filename and keeps it under the folder', () => {
        const uri = resolveSafeOutputUri(folder, 'figure.png');
        assert.ok(uri, 'expected a plain filename to resolve');
        assert.strictEqual(uri!.fsPath, path.join(folder.fsPath, 'figure.png'));
    });

    test('rejects parent-directory traversal in the filename', () => {
        assert.strictEqual(resolveSafeOutputUri(folder, '../escape.png'), undefined);
        assert.strictEqual(resolveSafeOutputUri(folder, '../../etc/passwd'), undefined);
    });

    test('rejects path separators, absolute paths, and traversal tokens', () => {
        assert.strictEqual(resolveSafeOutputUri(folder, 'sub/figure.png'), undefined);
        assert.strictEqual(resolveSafeOutputUri(folder, path.join(os.tmpdir(), 'abs.png')), undefined);
        assert.strictEqual(resolveSafeOutputUri(folder, '..'), undefined);
        assert.strictEqual(resolveSafeOutputUri(folder, '.'), undefined);
        assert.strictEqual(resolveSafeOutputUri(folder, ''), undefined);
    });
});
