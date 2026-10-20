// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    const network = document.getElementById('network');
    const rulevizBrowser = document.getElementById('ruleviz_browser');
    const plotElement = document.getElementById('plot');
    const plotDataPanel = document.getElementById('plot_data_panel');
    const plotDataTable = document.getElementById('plot_data_table');
    const plotDataEmpty = document.getElementById('plot_data_empty');
    const plotSourceSummary = document.getElementById('plot_source_summary');
    const plotViewPlotButton = document.getElementById('plot_view_plot_button');
    const plotViewDataButton = document.getElementById('plot_view_data_button');
    const viewModeButton = document.getElementById('view_mode_button');

    const page_title = document.getElementById('page_title').innerText;
    const page_folder = document.getElementById('folder').innerText;

    // Accessible qualitative palette based on seaborn's colorblind cycle.
    const plotSeriesColors = [
        "#0173B2",
        "#DE8F05",
        "#029E73",
        "#D55E00",
        "#CC78BC",
        "#56B4E9",
        "#CA9161",
        "#949494",
        "#FBAFE4",
        "#ECE133"
    ];
    const plotSeriesColorCount = plotSeriesColors.length;
    const plotPngExportScale = 2;
    const graphPngExportScale = 4;
    const graphFitPadding = 40;
    const VIEW_MODE_LIGHT = 'light';
    const VIEW_MODE_DARK = 'dark';
    const REGULATORY_RULE_BNGL_CAPTION_CLASS = 'regulatory-rule-bngl-caption';
    const REGULATORY_RULE_BNGL_HIDDEN_CLASS = 'regulatory-rule-bngl-hidden';
    const contactMapViewerPalettes = {
        [VIEW_MODE_LIGHT]: {
            background: '#ffffff',
            moleculeFill: '#eee8d8',
            moleculeBorder: '#262b33',
            moleculeLabel: '#14181e',
            siteFill: '#d6e2ea',
            siteBorder: '#3d5669',
            siteLabel: '#14232d',
            stateFill: '#e8ddee',
            stateBorder: '#5b4370',
            stateLabel: '#281c37',
            edge: '#373b42',
            edgeHighlight: '#144c8e',
            arrow: '#191b20',
            activatedAccent: '#c4372d',
            modifiedAccent: '#daa62f',
            boundAccent: '#307659',
            inhibitedAccent: '#55585e',
            uncertainAccent: '#cd6f36',
            secondaryText: '#555a62',
            divider: '#9197a0'
        },
        [VIEW_MODE_DARK]: {
            background: '#12161e',
            moleculeFill: '#3b372f',
            moleculeBorder: '#c4baa0',
            moleculeLabel: '#efe9da',
            siteFill: '#253642',
            siteBorder: '#84a8be',
            siteLabel: '#dcebf2',
            stateFill: '#372d42',
            stateBorder: '#b194cb',
            stateLabel: '#ede2f6',
            edge: '#acb2bc',
            edgeHighlight: '#5a96da',
            arrow: '#dce0e6',
            activatedAccent: '#e85c4e',
            modifiedAccent: '#ecbe52',
            boundAccent: '#5bab84',
            inhibitedAccent: '#868b94',
            uncertainAccent: '#e58b4e',
            secondaryText: '#b0b7c2',
            divider: '#697380'
        }
    };
    const regulatoryViewerPalettes = {
        [VIEW_MODE_LIGHT]: {
            background: '#ffffff',
            nodeFill: '#e4efe8',
            nodeBorder: '#355246',
            nodeLabel: '#14221c',
            edge: '#5b7469',
            arrow: '#26352e',
            activatedAccent: '#307659',
            inhibitedAccent: '#b54c42',
            modifiedAccent: '#c79634',
            uncertainAccent: '#7a8793'
        },
        [VIEW_MODE_DARK]: {
            background: '#101821',
            nodeFill: '#273d36',
            nodeBorder: '#90b2a3',
            nodeLabel: '#e8f2ed',
            edge: '#8fa89d',
            arrow: '#dce6e0',
            activatedAccent: '#62b58b',
            inhibitedAccent: '#e07b70',
            modifiedAccent: '#e2bd68',
            uncertainAccent: '#a6b3bd'
        }
    };
    const rulevizBrowserPalettes = {
        [VIEW_MODE_LIGHT]: {
            background: '#f5f0e7',
            rowBackground: '#fffdf8',
            rowBorder: '#d8cfbf',
            rowShadow: 'rgba(84, 67, 41, 0.08)',
            canvasBackground: '#fcf9f2',
            canvasBorder: '#ddd3c4',
            labelForeground: '#1f2a30',
            mutedForeground: '#6f7169',
            ruleLabelForeground: '#6f5b8e',
            moleculeFill: '#dbc8af',
            moleculeBorder: '#735a3d',
            moleculeLabel: '#2d2012',
            componentFill: '#d6e3d8',
            componentBorder: '#557363',
            componentLabel: '#1e3128',
            ruleFill: '#f7f3ea',
            ruleBorder: '#6d5c46',
            ruleLabel: '#2f251a',
            operationFill: '#ccb9e2',
            operationBorder: '#6f5b8e',
            operationLabel: '#312043',
            modifierFill: '#b59cd7',
            modifierBorder: '#5b4679',
            modifierLabel: '#241432',
            stateFill: '#f1d79a',
            stateBorder: '#a5721f',
            stateLabel: '#4c3403',
            edge: '#7b7265',
            arrow: '#4e463d'
        },
        [VIEW_MODE_DARK]: {
            background: '#10161a',
            rowBackground: '#162026',
            rowBorder: '#334048',
            rowShadow: 'rgba(0, 0, 0, 0.22)',
            canvasBackground: '#0d1317',
            canvasBorder: '#38444c',
            labelForeground: '#eef3ee',
            mutedForeground: '#a8b0a8',
            ruleLabelForeground: '#e3d7ee',
            moleculeFill: '#6e5a44',
            moleculeBorder: '#d5c0a0',
            moleculeLabel: '#f8f1e3',
            componentFill: '#395045',
            componentBorder: '#a8c5b7',
            componentLabel: '#eef7f1',
            ruleFill: '#243037',
            ruleBorder: '#d1c0a7',
            ruleLabel: '#f4ede2',
            operationFill: '#7d6797',
            operationBorder: '#e3d7ee',
            operationLabel: '#fbf7ff',
            modifierFill: '#9376bb',
            modifierBorder: '#f1e8fb',
            modifierLabel: '#fffaff',
            stateFill: '#c49d3f',
            stateBorder: '#f0d48d',
            stateLabel: '#211905',
            edge: '#9fa79f',
            arrow: '#e2e9e3'
        }
    };

    let current_plot_data = [];
    let currentPlotView = 'plot';
    let currentPlotTableNames = [];
    let currentPlotTableColumns = [];
    let plotDataTableRendered = false;
    let plotReady = false;
    let currentCy = null;
    let graphKind = 'other';
    let graphHasComponents = false;
    let graphHasInternalStates = false;
    let standaloneGraphPaletteKind = null;
    let showComponents = true;
    let showInternalStates = true;
    let showRegulatoryRuleBngl = false;
    let currentGraphLayoutName = 'preset';
    let graphLayoutLocked = false;
    let currentRulevizBrowser = null;
    let hostViewMode = inferHostViewMode();
    let currentViewMode = resolveInitialViewMode();

    function isStandaloneContactMapViewer() {
        return graphKind === 'contactmap' && standaloneGraphPaletteKind === 'contactmap';
    }

    function isStandaloneRegulatoryViewer() {
        return graphKind === 'regulatory' && standaloneGraphPaletteKind === 'regulatory';
    }

    function isStandaloneRulevizViewer() {
        return graphKind === 'ruleviz' && standaloneGraphPaletteKind === 'ruleviz';
    }

    function isStandaloneRulevizOperationViewer() {
        return graphKind === 'ruleviz_operation' && standaloneGraphPaletteKind === 'ruleviz_operation';
    }

    function isStandaloneRulevizBrowserActive() {
        return Boolean(currentRulevizBrowser);
    }

    function isStandaloneGraphPaletteViewer() {
        return isStandaloneContactMapViewer() || isStandaloneRegulatoryViewer();
    }

    function getContactMapViewerPalette() {
        return currentViewMode === VIEW_MODE_DARK
            ? contactMapViewerPalettes[VIEW_MODE_DARK]
            : contactMapViewerPalettes[VIEW_MODE_LIGHT];
    }

    function getRegulatoryViewerPalette() {
        return currentViewMode === VIEW_MODE_DARK
            ? regulatoryViewerPalettes[VIEW_MODE_DARK]
            : regulatoryViewerPalettes[VIEW_MODE_LIGHT];
    }

    function getRulevizBrowserPalette() {
        return currentViewMode === VIEW_MODE_DARK
            ? rulevizBrowserPalettes[VIEW_MODE_DARK]
            : rulevizBrowserPalettes[VIEW_MODE_LIGHT];
    }

    function getGraphFitPadding() {
        if (isStandaloneContactMapViewer()) {
            return 28;
        }

        if (isStandaloneRulevizViewer()) {
            return 36;
        }

        return graphFitPadding;
    }

    function cssVar(name, fallback = '') {
        const value = window.getComputedStyle(document.body).getPropertyValue(name).trim();
        return value || fallback;
    }

    function clampChannel(value) {
        return Math.max(0, Math.min(255, Math.round(value)));
    }

    function clampOpacity(value) {
        return Math.max(0, Math.min(1, value));
    }

    function clampNumber(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function parseColor(color) {
        if (!color) {
            return null;
        }

        const value = color.trim();
        if (!value || value === 'none' || value === 'transparent') {
            return null;
        }

        const hexMatch = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
        if (hexMatch) {
            let digits = hexMatch[1];
            if (digits.length === 3) {
                digits = digits.split('').map((digit) => digit + digit).join('');
            }

            if (digits.length === 6) {
                digits += 'ff';
            }

            return {
                r: parseInt(digits.slice(0, 2), 16),
                g: parseInt(digits.slice(2, 4), 16),
                b: parseInt(digits.slice(4, 6), 16),
                a: parseInt(digits.slice(6, 8), 16) / 255
            };
        }

        const rgbMatch = value.match(/^rgba?\(([^)]+)\)$/i);
        if (rgbMatch) {
            const parts = rgbMatch[1].split(',').map((part) => part.trim());
            if (parts.length < 3) {
                return null;
            }

            const r = Number(parts[0]);
            const g = Number(parts[1]);
            const b = Number(parts[2]);
            const a = parts.length > 3 ? Number(parts[3]) : 1;

            if ([r, g, b, a].some((part) => Number.isNaN(part))) {
                return null;
            }

            return { r, g, b, a };
        }

        return null;
    }

    function toCssColor(color) {
        const r = clampChannel(color.r);
        const g = clampChannel(color.g);
        const b = clampChannel(color.b);
        const a = typeof color.a === 'number' ? clampOpacity(color.a) : 1;

        if (a < 1) {
            return `rgba(${r}, ${g}, ${b}, ${a})`;
        }

        return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
    }

    function normalizeColorKey(color) {
        const parsed = parseColor(color);
        if (!parsed) {
            return (color || '').trim().toLowerCase();
        }

        return toCssColor({
            r: parsed.r,
            g: parsed.g,
            b: parsed.b,
            a: 1
        }).toLowerCase();
    }

    function mixColors(base, mixin, ratio) {
        const clampedRatio = Math.max(0, Math.min(1, ratio));
        return {
            r: base.r + (mixin.r - base.r) * clampedRatio,
            g: base.g + (mixin.g - base.g) * clampedRatio,
            b: base.b + (mixin.b - base.b) * clampedRatio,
            a: typeof base.a === 'number' ? base.a : 1
        };
    }

    function channelToLinear(channel) {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    }

    function getRelativeLuminance(color) {
        return (0.2126 * channelToLinear(color.r))
            + (0.7152 * channelToLinear(color.g))
            + (0.0722 * channelToLinear(color.b));
    }

    function getContrastRatio(colorA, colorB) {
        const parsedA = parseColor(colorA);
        const parsedB = parseColor(colorB);
        if (!parsedA || !parsedB) {
            return null;
        }

        const luminanceA = getRelativeLuminance(parsedA);
        const luminanceB = getRelativeLuminance(parsedB);
        const lighter = Math.max(luminanceA, luminanceB);
        const darker = Math.min(luminanceA, luminanceB);
        return (lighter + 0.05) / (darker + 0.05);
    }

    function isColorDark(color) {
        const parsed = parseColor(color);
        if (!parsed) {
            return false;
        }

        return getRelativeLuminance(parsed) < 0.45;
    }

    function liftColorForDarkMode(color, minimumLuminance) {
        const parsed = parseColor(color);
        if (!parsed) {
            return color;
        }

        if (getRelativeLuminance(parsed) >= minimumLuminance) {
            return color;
        }

        let ratio = 0;
        let candidate = parsed;
        while (getRelativeLuminance(candidate) < minimumLuminance && ratio < 1) {
            ratio += 0.08;
            candidate = mixColors(parsed, { r: 255, g: 255, b: 255, a: parsed.a }, ratio);
        }

        return toCssColor(candidate);
    }

    function getHighestContrastColor(backgroundColor, candidates) {
        let bestColor = candidates[0];
        let bestContrast = -1;

        candidates.forEach((candidate) => {
            const contrast = getContrastRatio(candidate, backgroundColor);
            if (contrast !== null && contrast > bestContrast) {
                bestContrast = contrast;
                bestColor = candidate;
            }
        });

        return bestColor;
    }

    function ensureTextContrast(color, backgroundColor, minimumContrast) {
        const contrast = getContrastRatio(color, backgroundColor);
        if (contrast === null || contrast >= minimumContrast) {
            return color;
        }

        const candidates = [];

        if (isStandaloneContactMapViewer()) {
            const palette = getContactMapViewerPalette();
            candidates.push(palette.moleculeLabel, palette.siteLabel, palette.stateLabel);
        } else if (isStandaloneRegulatoryViewer()) {
            const palette = getRegulatoryViewerPalette();
            candidates.push(palette.nodeLabel, palette.arrow, palette.edge);
        }

        candidates.push(currentViewMode === VIEW_MODE_DARK ? '#f4f7fb' : '#101418');
        return getHighestContrastColor(backgroundColor, candidates);
    }

    function inferHostViewMode() {
        const hostBackground = cssVar('--vscode-editor-background', window.getComputedStyle(document.body).backgroundColor);
        return isColorDark(hostBackground) ? VIEW_MODE_DARK : VIEW_MODE_LIGHT;
    }

    function getPersistedState() {
        return vscode.getState() || {};
    }

    function resolveInitialViewMode() {
        const state = getPersistedState();
        if (state.viewMode === VIEW_MODE_LIGHT || state.viewMode === VIEW_MODE_DARK) {
            return state.viewMode;
        }

        return inferHostViewMode();
    }

    function persistViewMode(mode) {
        const state = getPersistedState();
        vscode.setState({
            ...state,
            viewMode: mode
        });
    }

    function resolveInitialGraphViewState() {
        const state = getPersistedState();
        const graphView = state.graphView || {};

        return {
            layoutName: typeof graphView.layoutName === 'string' ? graphView.layoutName : undefined,
            layoutLocked: typeof graphView.layoutLocked === 'boolean' ? graphView.layoutLocked : false,
            showComponents: typeof graphView.showComponents === 'boolean' ? graphView.showComponents : true,
            showInternalStates: typeof graphView.showInternalStates === 'boolean' ? graphView.showInternalStates : true,
            showRegulatoryRuleBngl: typeof graphView.showRegulatoryRuleBngl === 'boolean' ? graphView.showRegulatoryRuleBngl : false
        };
    }

    function persistGraphViewState() {
        const state = getPersistedState();
        vscode.setState({
            ...state,
            graphView: {
                layoutName: currentGraphLayoutName,
                layoutLocked: graphLayoutLocked,
                showComponents: showComponents,
                showInternalStates: showInternalStates,
                showRegulatoryRuleBngl: showRegulatoryRuleBngl
            }
        });
    }

    function getPlotTheme() {
        return {
            foreground: cssVar('--viewer-foreground', '#1f2328'),
            border: cssVar('--viewer-border', '#c5ccd6'),
            grid: cssVar('--viewer-plot-grid', '#dbe2eb'),
            zeroLine: cssVar('--viewer-plot-zeroline', '#c7d0db'),
            paperBackground: cssVar('--viewer-plot-paper-background', cssVar('--viewer-background', '#ffffff')),
            plotBackground: cssVar('--viewer-plot-background', '#ffffff'),
            legendBackground: cssVar('--viewer-legend-background', 'rgba(255, 255, 255, 0.92)')
        };
    }

    function applyPlotTheme() {
        if (!plotElement || !plotReady) {
            return;
        }

        const theme = getPlotTheme();
        Plotly.relayout(plotElement, {
            paper_bgcolor: theme.paperBackground,
            plot_bgcolor: theme.plotBackground,
            'font.color': theme.foreground,
            'xaxis.color': theme.foreground,
            'xaxis.gridcolor': theme.grid,
            'xaxis.zerolinecolor': theme.zeroLine,
            'xaxis.title.font.color': theme.foreground,
            'yaxis.color': theme.foreground,
            'yaxis.gridcolor': theme.grid,
            'yaxis.zerolinecolor': theme.zeroLine,
            'yaxis.title.font.color': theme.foreground,
            'legend.bgcolor': theme.legendBackground,
            'legend.bordercolor': theme.border,
            'legend.font.color': theme.foreground
        });
    }

    function pluralize(count, singular, plural = `${singular}s`) {
        return `${count} ${count === 1 ? singular : plural}`;
    }

    function getPlotRowCount(columns) {
        if (!Array.isArray(columns) || columns.length === 0 || !Array.isArray(columns[0])) {
            return 0;
        }

        return columns[0].length;
    }

    function updatePlotSourceSummary(names, columns) {
        if (!plotSourceSummary) {
            return;
        }

        const columnCount = Array.isArray(names) ? names.length : 0;
        const rowCount = getPlotRowCount(columns);
        const seriesCount = Math.max(columnCount - 1, 0);
        const summaryParts = [];

        if (columnCount > 0) {
            summaryParts.push(pluralize(columnCount, 'column'));
        }
        if (rowCount > 0) {
            summaryParts.push(pluralize(rowCount, 'row'));
        }
        if (seriesCount > 0) {
            summaryParts.push(pluralize(seriesCount, 'plotted series', 'plotted series'));
        }

        plotSourceSummary.textContent = summaryParts.join(' • ') || 'No plotted data detected.';
    }

    function renderPlotDataTable() {
        if (!plotDataTable) {
            return;
        }

        if (plotDataTableRendered) {
            return;
        }

        plotDataTable.innerHTML = '';
        const columnNames = Array.isArray(currentPlotTableNames) ? currentPlotTableNames : [];
        const columnData = Array.isArray(currentPlotTableColumns) ? currentPlotTableColumns : [];
        const rowCount = getPlotRowCount(columnData);
        const hasRows = columnNames.length > 0 && rowCount > 0;

        if (plotDataEmpty) {
            plotDataEmpty.hidden = hasRows;
        }

        if (!hasRows) {
            plotDataTableRendered = true;
            return;
        }

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        columnNames.forEach((name) => {
            const headerCell = document.createElement('th');
            headerCell.textContent = name;
            headerRow.appendChild(headerCell);
        });
        thead.appendChild(headerRow);

        const tbody = document.createElement('tbody');
        for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
            const row = document.createElement('tr');
            for (let columnIndex = 0; columnIndex < columnNames.length; columnIndex += 1) {
                const cell = document.createElement('td');
                const value = Array.isArray(columnData[columnIndex]) ? columnData[columnIndex][rowIndex] : '';
                cell.textContent = value ?? '';
                row.appendChild(cell);
            }
            tbody.appendChild(row);
        }

        plotDataTable.appendChild(thead);
        plotDataTable.appendChild(tbody);
        plotDataTableRendered = true;
    }

    function setPlotViewerMode(view) {
        currentPlotView = view === 'data' ? 'data' : 'plot';

        if (plotViewPlotButton) {
            const isPlotView = currentPlotView === 'plot';
            plotViewPlotButton.classList.toggle('active', isPlotView);
            plotViewPlotButton.setAttribute('aria-pressed', isPlotView ? 'true' : 'false');
        }

        if (plotViewDataButton) {
            const isDataView = currentPlotView === 'data';
            plotViewDataButton.classList.toggle('active', isDataView);
            plotViewDataButton.setAttribute('aria-pressed', isDataView ? 'true' : 'false');
        }

        if (currentPlotView === 'data') {
            renderPlotDataTable();
        }

        if (plotElement) {
            plotElement.hidden = currentPlotView !== 'plot';
        }

        if (plotDataPanel) {
            plotDataPanel.hidden = currentPlotView !== 'data';
        }

        if (currentPlotView === 'plot' && plotReady && plotElement) {
            requestAnimationFrame(() => {
                Plotly.Plots.resize(plotElement);
            });
        }
    }

    function adaptGraphColor(color, role) {
        if (currentViewMode !== VIEW_MODE_DARK) {
            return color;
        }

        if (isStandaloneGraphPaletteViewer()) {
            return color;
        }

        if (role === 'label') {
            return liftColorForDarkMode(color, 0.62);
        }

        return liftColorForDarkMode(color, 0.48);
    }

    function getContactMapNodeKind(sourceColor) {
        switch (normalizeColorKey(sourceColor)) {
            case '#d2d2d2':
                return 'molecule';
            case '#ffffff':
                return 'site';
            case '#ffcc00':
                return 'state';
            default:
                return 'other';
        }
    }

    function getContactMapBaseFillColor(nodeKind, sourceColor) {
        const palette = getContactMapViewerPalette();
        switch (nodeKind) {
            case 'molecule':
                return palette.moleculeFill;
            case 'site':
                return palette.siteFill;
            case 'state':
                return palette.stateFill;
            default:
                return sourceColor;
        }
    }

    function getContactMapBaseBorderColor(nodeKind, sourceColor) {
        const palette = getContactMapViewerPalette();
        switch (nodeKind) {
            case 'molecule':
                return palette.moleculeBorder;
            case 'site':
                return palette.siteBorder;
            case 'state':
                return palette.stateBorder;
            default:
                return sourceColor;
        }
    }

    function getContactMapBaseLabelColor(nodeKind, sourceColor) {
        const palette = getContactMapViewerPalette();
        switch (nodeKind) {
            case 'molecule':
                return palette.moleculeLabel;
            case 'site':
                return palette.siteLabel;
            case 'state':
                return palette.stateLabel;
            default:
                return sourceColor;
        }
    }

    function getRegulatoryBaseFillColor(sourceColor) {
        const palette = getRegulatoryViewerPalette();
        const source = parseColor(sourceColor);
        const target = parseColor(palette.nodeFill);
        if (!source || !target) {
            return palette.nodeFill;
        }

        let candidate = mixColors(source, target, currentViewMode === VIEW_MODE_DARK ? 0.68 : 0.78);
        if (currentViewMode === VIEW_MODE_DARK && getRelativeLuminance(candidate) < 0.14) {
            candidate = mixColors(candidate, { r: 255, g: 255, b: 255, a: candidate.a }, 0.12);
        }
        if (currentViewMode === VIEW_MODE_LIGHT && getRelativeLuminance(candidate) > 0.92) {
            candidate = mixColors(candidate, target, 0.18);
        }

        return toCssColor(candidate);
    }

    function getRegulatoryAccentFromSourceColor(sourceColor) {
        const palette = getRegulatoryViewerPalette();
        const source = parseColor(sourceColor);
        if (!source) {
            return palette.edge;
        }

        const maxChannel = Math.max(source.r, source.g, source.b);
        const minChannel = Math.min(source.r, source.g, source.b);
        const chroma = maxChannel - minChannel;
        if (chroma < 22) {
            return palette.edge;
        }

        if (source.g >= source.r + 18 && source.g >= source.b + 12) {
            return palette.activatedAccent;
        }

        if (source.r >= source.g + 24 && source.r >= source.b + 12) {
            return palette.inhibitedAccent;
        }

        if (source.r >= 140 && source.g >= 105 && source.b <= Math.min(source.r, source.g) - 12) {
            return palette.modifiedAccent;
        }

        if (source.b >= source.r + 12 && source.b >= source.g + 12) {
            return palette.uncertainAccent;
        }

        return palette.edge;
    }

    function getRegulatoryEdgeColor(sourceColor, role) {
        const palette = getRegulatoryViewerPalette();
        const source = parseColor(sourceColor);
        const accent = parseColor(getRegulatoryAccentFromSourceColor(sourceColor));
        if (!source || !accent) {
            return role === 'arrow' ? palette.arrow : palette.edge;
        }

        let candidate = mixColors(source, accent, currentViewMode === VIEW_MODE_DARK ? 0.6 : 0.72);
        if (role === 'arrow') {
            const arrowTarget = parseColor(palette.arrow);
            if (arrowTarget) {
                candidate = mixColors(candidate, arrowTarget, currentViewMode === VIEW_MODE_DARK ? 0.2 : 0.08);
            }
        }

        if (currentViewMode === VIEW_MODE_DARK && getRelativeLuminance(candidate) < 0.34) {
            candidate = mixColors(candidate, { r: 255, g: 255, b: 255, a: candidate.a }, 0.18);
        }

        return toCssColor(candidate);
    }

    function getCytoscapeShape(graphmlShape, kind) {
        switch ((graphmlShape || '').toLowerCase()) {
            case 'rectangle':
                return 'rectangle';
            case 'roundrectangle':
                return 'round-rectangle';
            case 'ellipse':
                return 'ellipse';
            case 'diamond':
                return 'diamond';
            case 'hexagon':
                return 'hexagon';
            case 'octagon':
                return 'octagon';
            case 'parallelogram':
                return 'parallelogram';
            case 'triangle':
                return 'triangle';
            case 'trapezoid':
                return 'trapezoid';
            default:
                return graphKind === 'contactmap' && kind !== 'other' ? 'round-rectangle' : 'ellipse';
        }
    }

    function getContactMapBorderWidth(nodeKind, sourceBorderWidth) {
        const parsedWidth = parseFloat(sourceBorderWidth);
        const baseWidth = Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : 1;

        switch (nodeKind) {
            case 'molecule':
                return Math.max(baseWidth, 3.2);
            case 'site':
                return Math.max(baseWidth, 1.8);
            case 'state':
                return Math.max(baseWidth, 1.5);
            default:
                return baseWidth;
        }
    }

    function getContactMapLabelFontSize(nodeKind, sourceFontSize, displayWidth, displayHeight, labelText, hasDirectChildren) {
        const textLength = Math.max((labelText || '').trim().length, 1);
        const widthBudget = Math.max(
            nodeKind === 'molecule' ? 68 : (nodeKind === 'site' ? 42 : 34),
            displayWidth - (nodeKind === 'molecule' ? 18 : 12)
        );
        const widthFactor = nodeKind === 'molecule' ? 0.58 : (nodeKind === 'state' ? 0.72 : 0.66);
        const widthDrivenSize = widthBudget / Math.max(textLength * widthFactor, 2.2);
        const heightFactor = nodeKind === 'molecule'
            ? (hasDirectChildren ? 0.32 : 0.42)
            : (nodeKind === 'state' ? 0.54 : 0.44);
        const heightDrivenSize = displayHeight * heightFactor;
        const adaptiveSize = Math.min(widthDrivenSize, heightDrivenSize);
        const minimumSize = nodeKind === 'molecule'
            ? 18
            : (nodeKind === 'state' ? 12 : 14);
        const maximumSize = nodeKind === 'molecule'
            ? (hasDirectChildren ? 26 : 28)
            : (nodeKind === 'state' ? 16 : 20);

        return Math.max(
            sourceFontSize,
            clampNumber(adaptiveSize, minimumSize, maximumSize)
        );
    }

    function getContactMapDefaultNodeDimensions(nodeKind, hasDirectChildren) {
        if (graphKind === 'regulatory') {
            return { width: 150, height: 48 };
        }

        if (!isStandaloneContactMapViewer()) {
            return { width: 80, height: 32 };
        }

        switch (nodeKind) {
            case 'molecule':
                return hasDirectChildren
                    ? { width: 140, height: 74 }
                    : { width: 104, height: 44 };
            case 'site':
                return hasDirectChildren
                    ? { width: 78, height: 34 }
                    : { width: 68, height: 30 };
            case 'state':
                return { width: 56, height: 28 };
            default:
                return { width: 90, height: 40 };
        }
    }

    function getRegulatoryRuleBnglCaptionMetrics(labelText) {
        const normalizedLabelText = (labelText || '').trim();
        if (!normalizedLabelText) {
            return {
                width: 220,
                height: 28,
                labelMaxWidth: 200,
                fontSize: 11
            };
        }

        const lines = normalizedLabelText.split(/\n/);
        const longestLineLength = lines.reduce((longest, line) => Math.max(longest, line.length), 0);
        const fontSize = longestLineLength > 96 ? 10 : 11;
        const width = clampNumber((Math.min(longestLineLength, 88) * 7) + 34, 220, 520);
        const labelMaxWidth = Math.max(190, width - 24);
        const approximateCharsPerWrappedLine = Math.max(22, Math.floor(labelMaxWidth / 7));
        const wrappedLineCount = lines.reduce((count, line) => {
            return count + Math.max(1, Math.ceil(Math.max(line.length, 1) / approximateCharsPerWrappedLine));
        }, 0);
        const height = clampNumber((wrappedLineCount * (fontSize + 4)) + 12, 28, 148);

        return {
            width: width,
            height: height,
            labelMaxWidth: labelMaxWidth,
            fontSize: fontSize
        };
    }

    function getContactMapMinimumNodeWidth(nodeKind, labelText, hasDirectChildren) {
        const textLength = Math.max((labelText || '').trim().length, 1);

        switch (nodeKind) {
            case 'molecule':
                return clampNumber(
                    (textLength * 10) + (hasDirectChildren ? 36 : 26),
                    hasDirectChildren ? 118 : 98,
                    hasDirectChildren ? 210 : 190
                );
            case 'site':
                return clampNumber(
                    (textLength * 7) + (hasDirectChildren ? 22 : 18),
                    hasDirectChildren ? 68 : 62,
                    150
                );
            case 'state':
                return clampNumber((textLength * 8) + 18, 56, 120);
            default:
                return clampNumber((textLength * 9) + 24, 92, 180);
        }
    }

    function getContactMapLabelMaxWidth(nodeKind, displayWidth, hasDirectChildren) {
        switch (nodeKind) {
            case 'molecule':
                return Math.max(72, displayWidth - 22);
            case 'site':
                return Math.max(44, displayWidth - 16);
            case 'state':
                return Math.max(32, displayWidth - 10);
            default:
                return Math.max(48, displayWidth - 16);
        }
    }

    function getContactMapLabelValign(nodeKind) {
        return nodeKind === 'state' ? 'center' : 'top';
    }

    function getContactMapLabelHalign(nodeKind) {
        return nodeKind === 'molecule' ? 'left' : 'center';
    }

    function getContactMapLabelJustification(nodeKind) {
        return nodeKind === 'molecule' ? 'left' : 'center';
    }

    function getContactMapLabelMarginX(nodeKind, displayWidth) {
        if (nodeKind !== 'molecule') {
            return 0;
        }

        return Math.round(clampNumber(displayWidth * 0.08, 8, 14));
    }

    function getContactMapLabelMarginY(nodeKind, displayHeight) {
        switch (nodeKind) {
            case 'molecule':
                return Math.round(clampNumber(displayHeight * 0.12, 8, 13));
            case 'site':
                return Math.round(clampNumber(displayHeight * 0.1, 4, 8));
            default:
                return 0;
        }
    }

    function getContactMapLabelBackgroundOpacity(nodeKind) {
        return nodeKind === 'molecule' || nodeKind === 'site' ? 0.95 : 0;
    }

    function getContactMapLabelBackgroundPadding(nodeKind) {
        switch (nodeKind) {
            case 'molecule':
                return 3;
            case 'site':
                return 2;
            default:
                return 0;
        }
    }

    function getContactMapMinZoomedFontSize(nodeKind) {
        switch (nodeKind) {
            case 'molecule':
                return 12;
            case 'site':
                return 11;
            case 'state':
                return 10;
            default:
                return 10;
        }
    }

    function getContactMapCompoundPadding(nodeKind, hasDirectChildren) {
        if (!hasDirectChildren) {
            return 18;
        }

        switch (nodeKind) {
            case 'molecule':
                return 28;
            case 'site':
                return 14;
            default:
                return 18;
        }
    }

    function getDirectChildNodeElements(node) {
        const directChildNodes = [];

        Array.from(node.children || []).forEach((child) => {
            if (child.tagName !== 'graph') {
                return;
            }

            Array.from(child.children || []).forEach((graphChild) => {
                if (graphChild.tagName === 'node') {
                    directChildNodes.push(graphChild);
                }
            });
        });

        return directChildNodes;
    }

    function isRulevizBrowserWildcardBondModifierLabel(labelText) {
        const normalizedLabel = (labelText || '').trim();
        return normalizedLabel === '+' || normalizedLabel === '?';
    }

    function getRulevizBrowserNodeKind(sourceColor, shape, parentId, parentNodeKind, labelText, options = {}) {
        const normalizedColor = normalizeColorKey(sourceColor);
        const normalizedShape = (shape || '').toLowerCase();
        const normalizedLabel = (labelText || '').trim();
        const viewName = options.viewName || 'operation';

        if (isRulevizBrowserWildcardBondModifierLabel(normalizedLabel)) {
            return 'modifier';
        }

        if (normalizedColor === '#cc99ff') {
            return 'operation';
        }

        if (normalizedColor === '#fff0a7') {
            return 'state';
        }

        if (viewName === 'pattern' && !parentId && normalizedShape === 'roundrectangle' && normalizedLabel.length === 0) {
            return 'patternGroup';
        }

        if (normalizedShape === 'roundrectangle') {
            return 'rule';
        }

        if (!parentId || parentNodeKind === 'rule' || parentNodeKind === 'patternGroup') {
            return 'molecule';
        }

        if (parentNodeKind === 'molecule') {
            return 'component';
        }

        if (parentNodeKind === 'component') {
            return 'state';
        }

        return 'component';
    }

    function getRulevizBrowserNodeShape(nodeKind) {
        switch (nodeKind) {
            case 'patternGroup':
            case 'molecule':
            case 'component':
            case 'rule':
                return 'round-rectangle';
            case 'modifier':
            case 'state':
            case 'operation':
            default:
                return 'ellipse';
        }
    }

    function getRulevizBrowserNodeDimensions(nodeKind, labelText, hasDirectChildren) {
        const textLength = Math.max((labelText || '').trim().length, 1);

        switch (nodeKind) {
            case 'patternGroup':
                return {
                    width: clampNumber((textLength * 8) + 168, 220, 360),
                    height: 156
                };
            case 'molecule':
                return hasDirectChildren
                    ? {
                        width: clampNumber((textLength * 10) + 72, 150, 248),
                        height: 96
                    }
                    : {
                        width: clampNumber((textLength * 9) + 34, 106, 162),
                        height: 46
                    };
            case 'component':
                return hasDirectChildren
                    ? {
                        width: clampNumber((textLength * 9) + 38, 96, 168),
                        height: 66
                    }
                    : {
                        width: clampNumber((textLength * 8) + 26, 72, 126),
                        height: 36
                    };
            case 'rule':
                return hasDirectChildren
                    ? {
                        width: clampNumber((textLength * 10) + 140, 240, 360),
                        height: 184
                    }
                    : {
                        width: clampNumber((textLength * 9) + 34, 92, 176),
                        height: 42
                    };
            case 'operation':
                return {
                    width: clampNumber((textLength * 9) + 34, 74, 144),
                    height: 44
                };
            case 'modifier': {
                const diameter = clampNumber((textLength * 9) + 30, 46, 54);
                return {
                    width: diameter,
                    height: diameter
                };
            }
            case 'state':
                return {
                    width: clampNumber((textLength * 8) + 16, 48, 102),
                    height: 28
                };
            default:
                return {
                    width: clampNumber((textLength * 9) + (hasDirectChildren ? 40 : 28), hasDirectChildren ? 94 : 72, hasDirectChildren ? 170 : 132),
                    height: hasDirectChildren ? 54 : 38
                };
        }
    }

    function getRulevizBrowserContactMapNodeKind(nodeKind) {
        switch (nodeKind) {
            case 'molecule':
                return 'molecule';
            case 'component':
                return 'site';
            case 'state':
                return 'state';
            default:
                return null;
        }
    }

    function getRulevizBrowserNodeLabelValign(nodeKind) {
        const contactMapLabelKind = getRulevizBrowserContactMapNodeKind(nodeKind);
        if (contactMapLabelKind) {
            return getContactMapLabelValign(contactMapLabelKind);
        }

        return 'center';
    }

    function getRulevizBrowserNodeLabelHalign(nodeKind) {
        const contactMapLabelKind = getRulevizBrowserContactMapNodeKind(nodeKind);
        if (contactMapLabelKind) {
            return getContactMapLabelHalign(contactMapLabelKind);
        }

        return 'center';
    }

    function getRulevizBrowserNodeLabelJustification(nodeKind) {
        const contactMapLabelKind = getRulevizBrowserContactMapNodeKind(nodeKind);
        if (contactMapLabelKind) {
            return getContactMapLabelJustification(contactMapLabelKind);
        }

        return 'center';
    }

    function getRulevizBrowserNodeLabelMarginX(nodeKind, _hasDirectChildren, displayWidth) {
        const contactMapLabelKind = getRulevizBrowserContactMapNodeKind(nodeKind);
        if (contactMapLabelKind) {
            return getContactMapLabelMarginX(contactMapLabelKind, displayWidth);
        }

        return 0;
    }

    function getRulevizBrowserNodeLabelMarginY(nodeKind, _hasDirectChildren, displayHeight) {
        const contactMapLabelKind = getRulevizBrowserContactMapNodeKind(nodeKind);
        if (contactMapLabelKind) {
            return getContactMapLabelMarginY(contactMapLabelKind, displayHeight);
        }

        return 0;
    }

    function getRulevizBrowserNodeLabelMaxWidth(nodeKind, hasDirectChildren, displayWidth) {
        const contactMapLabelKind = getRulevizBrowserContactMapNodeKind(nodeKind);
        if (contactMapLabelKind) {
            return getContactMapLabelMaxWidth(contactMapLabelKind, displayWidth, hasDirectChildren);
        }

        return Math.max(48, displayWidth - 18);
    }

    function getRulevizBrowserNodeLabelBackgroundOpacity(nodeKind) {
        const contactMapLabelKind = getRulevizBrowserContactMapNodeKind(nodeKind);
        if (contactMapLabelKind) {
            return getContactMapLabelBackgroundOpacity(contactMapLabelKind);
        }

        return 0;
    }

    function getRulevizBrowserNodeLabelBackgroundPadding(nodeKind) {
        const contactMapLabelKind = getRulevizBrowserContactMapNodeKind(nodeKind);
        if (contactMapLabelKind) {
            return getContactMapLabelBackgroundPadding(contactMapLabelKind);
        }

        return 0;
    }

    function getRulevizBrowserNodeLabelFontSize(nodeKind, sourceFontSize, displayWidth, displayHeight, labelText, hasDirectChildren) {
        const contactMapLabelKind = getRulevizBrowserContactMapNodeKind(nodeKind);
        if (contactMapLabelKind) {
            return getContactMapLabelFontSize(
                contactMapLabelKind,
                sourceFontSize,
                displayWidth,
                displayHeight,
                labelText,
                hasDirectChildren
            );
        }

        const textLength = Math.max((labelText || '').trim().length, 1);

        switch (nodeKind) {
            case 'modifier': {
                const widthBudget = Math.max(24, displayWidth - 8);
                const widthDrivenSize = widthBudget / Math.max(textLength * 0.64, 1.2);
                const heightDrivenSize = displayHeight * 0.52;
                return Math.max(sourceFontSize, clampNumber(Math.min(widthDrivenSize, heightDrivenSize), 19, 24));
            }
            case 'operation': {
                const widthBudget = Math.max(42, displayWidth - 16);
                const widthDrivenSize = widthBudget / Math.max(textLength * 0.72, 2);
                const heightDrivenSize = displayHeight * 0.5;
                return Math.max(sourceFontSize, clampNumber(Math.min(widthDrivenSize, heightDrivenSize), 16, 21));
            }
            default: {
                const widthBudget = Math.max(42, displayWidth - 16);
                const widthDrivenSize = widthBudget / Math.max(textLength * 0.72, 2.2);
                const heightDrivenSize = displayHeight * 0.44;
                return Math.max(sourceFontSize, clampNumber(Math.min(widthDrivenSize, heightDrivenSize), 13, 18));
            }
        }
    }

    function getRulevizBrowserMinZoomedFontSize(nodeKind) {
        const contactMapNodeKind = getRulevizBrowserContactMapNodeKind(nodeKind);
        if (contactMapNodeKind) {
            return getContactMapMinZoomedFontSize(contactMapNodeKind);
        }

        switch (nodeKind) {
            case 'modifier':
                return 14;
            case 'operation':
                return 13;
            default:
                return 0;
        }
    }

    function getRulevizBrowserNodeBorderWidth(nodeKind, sourceBorderWidth) {
        const contactMapNodeKind = getRulevizBrowserContactMapNodeKind(nodeKind);
        if (contactMapNodeKind) {
            return getContactMapBorderWidth(contactMapNodeKind, sourceBorderWidth);
        }

        const parsedWidth = parseFloat(sourceBorderWidth);
        return Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : 1;
    }

    function getRulevizBrowserEdgeWidth(sourceEdgeWidth, sourceNodeKind, targetNodeKind) {
        const parsedWidth = parseFloat(sourceEdgeWidth);
        const baseWidth = Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : 1;
        const sourceContactMapKind = getRulevizBrowserContactMapNodeKind(sourceNodeKind);
        const targetContactMapKind = getRulevizBrowserContactMapNodeKind(targetNodeKind);

        if (sourceContactMapKind === 'state' || targetContactMapKind === 'state') {
            return Math.max(baseWidth, 1.5);
        }

        if (sourceContactMapKind || targetContactMapKind) {
            return Math.max(baseWidth, 1.8);
        }

        return baseWidth;
    }

    function getRulevizBrowserCompoundPadding(nodeKind, hasDirectChildren) {
        if (!hasDirectChildren) {
            return 0;
        }

        if (nodeKind === 'patternGroup') {
            return 24;
        }

        if (nodeKind === 'rule') {
            return 34;
        }

        if (nodeKind === 'molecule') {
            return 28;
        }

        if (nodeKind === 'component') {
            return 14;
        }

        return 0;
    }

    function getRulevizBrowserNodeFillColor(nodeKind, sourceColor) {
        const contactMapNodeKind = getRulevizBrowserContactMapNodeKind(nodeKind);
        if (contactMapNodeKind) {
            return getContactMapBaseFillColor(contactMapNodeKind, sourceColor);
        }

        const palette = getRulevizBrowserPalette();
        switch (nodeKind) {
            case 'patternGroup':
                return palette.canvasBackground;
            case 'rule':
                return palette.ruleFill;
            case 'operation':
                return palette.operationFill;
            case 'modifier':
                return palette.modifierFill;
            default:
                return sourceColor || palette.componentFill;
        }
    }

    function getRulevizBrowserNodeBorderColor(nodeKind, sourceColor) {
        const contactMapNodeKind = getRulevizBrowserContactMapNodeKind(nodeKind);
        if (contactMapNodeKind) {
            return getContactMapBaseBorderColor(contactMapNodeKind, sourceColor);
        }

        const palette = getRulevizBrowserPalette();
        switch (nodeKind) {
            case 'patternGroup':
                return palette.canvasBorder;
            case 'rule':
                return palette.ruleBorder;
            case 'operation':
                return palette.operationBorder;
            case 'modifier':
                return palette.modifierBorder;
            default:
                return sourceColor || palette.componentBorder;
        }
    }

    function getRulevizBrowserNodeLabelColor(nodeKind, sourceColor) {
        const contactMapNodeKind = getRulevizBrowserContactMapNodeKind(nodeKind);
        if (contactMapNodeKind) {
            return getContactMapBaseLabelColor(contactMapNodeKind, sourceColor);
        }

        const palette = getRulevizBrowserPalette();
        switch (nodeKind) {
            case 'patternGroup':
                return palette.labelForeground;
            case 'rule':
                return palette.ruleLabel;
            case 'operation':
                return palette.operationLabel;
            case 'modifier':
                return palette.modifierLabel;
            default:
                return sourceColor || palette.labelForeground;
        }
    }

    function getRulevizBrowserGraphHeight(nodeCount) {
        return clampNumber(198 + (nodeCount * 18), 250, 520);
    }

    function applyRulevizBrowserContainerTheme() {
        if (!rulevizBrowser) {
            return;
        }

        const palette = getRulevizBrowserPalette();
        rulevizBrowser.style.setProperty('--ruleviz-browser-background', palette.background);
        rulevizBrowser.style.setProperty('--ruleviz-browser-row-background', palette.rowBackground);
        rulevizBrowser.style.setProperty('--ruleviz-browser-row-border', palette.rowBorder);
        rulevizBrowser.style.setProperty('--ruleviz-browser-row-shadow', palette.rowShadow);
        rulevizBrowser.style.setProperty('--ruleviz-browser-canvas-background', palette.canvasBackground);
        rulevizBrowser.style.setProperty('--ruleviz-browser-canvas-border', palette.canvasBorder);
        rulevizBrowser.style.setProperty('--ruleviz-browser-label-foreground', palette.labelForeground);
        rulevizBrowser.style.setProperty('--ruleviz-browser-muted-foreground', palette.mutedForeground);
        rulevizBrowser.style.setProperty('--ruleviz-browser-rule-label-foreground', palette.ruleLabelForeground);
        rulevizBrowser.style.background = palette.background;
    }

    function getRulevizBrowserViewState(viewName) {
        if (!currentRulevizBrowser || !currentRulevizBrowser.views) {
            return null;
        }

        return currentRulevizBrowser.views[viewName] || null;
    }

    function getAvailableRulevizBrowserViewNames() {
        if (!currentRulevizBrowser || !currentRulevizBrowser.views) {
            return [];
        }

        return Object.keys(currentRulevizBrowser.views).filter((viewName) => {
            const viewState = currentRulevizBrowser.views[viewName];
            return viewState
                && Array.isArray(viewState.cards)
                && viewState.cards.length > 0;
        });
    }

    function getActiveRulevizBrowserViewState() {
        if (!currentRulevizBrowser) {
            return null;
        }

        const preferredViewName = currentRulevizBrowser.activeView;
        const preferredViewState = getRulevizBrowserViewState(preferredViewName);
        if (preferredViewState && Array.isArray(preferredViewState.cards) && preferredViewState.cards.length > 0) {
            return preferredViewState;
        }

        const fallbackViewName = getAvailableRulevizBrowserViewNames()[0];
        if (!fallbackViewName) {
            return null;
        }

        currentRulevizBrowser.activeView = fallbackViewName;
        return getRulevizBrowserViewState(fallbackViewName);
    }

    function getActiveRulevizBrowserCards() {
        const viewState = getActiveRulevizBrowserViewState();
        return viewState && Array.isArray(viewState.cards) ? viewState.cards : [];
    }

    function forEachRulevizBrowserCard(callback) {
        getAvailableRulevizBrowserViewNames().forEach((viewName) => {
            const viewState = getRulevizBrowserViewState(viewName);
            if (!viewState || !Array.isArray(viewState.cards)) {
                return;
            }

            viewState.cards.forEach((card) => {
                callback(card, viewState, viewName);
            });
        });
    }

    function scheduleRulevizBrowserViewportSync() {
        if (!isStandaloneRulevizBrowserActive() || !currentRulevizBrowser) {
            return;
        }

        if (currentRulevizBrowser.viewportSyncScheduled) {
            return;
        }

        currentRulevizBrowser.viewportSyncScheduled = true;
        requestAnimationFrame(() => {
            if (!currentRulevizBrowser) {
                return;
            }

            currentRulevizBrowser.viewportSyncScheduled = false;
            if (!isStandaloneRulevizBrowserActive()) {
                return;
            }

            getActiveRulevizBrowserCards().forEach((card) => {
                if (card && card.cy) {
                    card.cy.resize();
                }
            });
        });
    }

    function destroyRulevizBrowser() {
        if (currentRulevizBrowser && currentRulevizBrowser.scrollHandler && rulevizBrowser) {
            rulevizBrowser.removeEventListener('scroll', currentRulevizBrowser.scrollHandler);
        }

        if (currentRulevizBrowser && currentRulevizBrowser.resizeHandler) {
            window.removeEventListener('resize', currentRulevizBrowser.resizeHandler);
        }

        forEachRulevizBrowserCard((card) => {
            if (card.cy) {
                card.cy.destroy();
            }
        });

        currentRulevizBrowser = null;

        if (rulevizBrowser) {
            rulevizBrowser.innerHTML = '';
            rulevizBrowser.hidden = true;
        }

        if (network) {
            network.hidden = false;
        }
    }

    function configureToolbarForRulevizBrowser(isActive) {
        const layoutSelect = document.getElementById('layout_select');
        const layoutLockButton = document.getElementById('layout_lock_button');
        const fitButton = document.getElementById('fit_button');
        const exportPngButton = document.getElementById('png_button');
        const exportGraphmlButton = document.getElementById('graphml_button');
        const toggleRuleBnglButton = document.getElementById('toggle_rule_bngl_button');
        const toggleRulevizViewButton = document.getElementById('toggle_ruleviz_view_button');
        const presetOption = layoutSelect ? layoutSelect.querySelector('option[value="preset"]') : null;

        if (exportPngButton) {
            exportPngButton.hidden = false;
            exportPngButton.disabled = false;
        }

        if (exportGraphmlButton) {
            exportGraphmlButton.hidden = false;
            exportGraphmlButton.disabled = false;
        }

        if (toggleRuleBnglButton) {
            toggleRuleBnglButton.hidden = isActive;
            toggleRuleBnglButton.disabled = isActive;
        }

        if (toggleRulevizViewButton && !isActive) {
            toggleRulevizViewButton.hidden = true;
            toggleRulevizViewButton.disabled = true;
            toggleRulevizViewButton.textContent = 'Show Pattern';
            toggleRulevizViewButton.title = '';
        }

        if (layoutSelect) {
            layoutSelect.disabled = false;
            layoutSelect.title = '';
        }

        if (presetOption) {
            presetOption.hidden = isActive;
            presetOption.disabled = isActive;
        }
    }

    function applyRulevizBrowserFit(options = {}) {
        if (!isStandaloneRulevizBrowserActive()) {
            return;
        }

        const animate = options.animate !== false;
        const padding = getGraphFitPadding();

        getActiveRulevizBrowserCards().forEach((card) => {
            if (!card || !card.cy) {
                return;
            }

            const elementsToFit = card.cy.elements(':visible');
            if (elementsToFit.length === 0) {
                return;
            }

            card.cy.resize();
            if (!animate) {
                card.cy.fit(elementsToFit, padding);
                return;
            }

            card.cy.animate({
                fit: {
                    eles: elementsToFit,
                    padding: padding
                },
                duration: 250
            });
        });
    }

    function applyRulevizBrowserLayoutLock() {
        if (!isStandaloneRulevizBrowserActive()) {
            return;
        }

        getActiveRulevizBrowserCards().forEach((card) => {
            applyRulevizBrowserCardInteractivity(card);
        });
    }

    function getElementRectWithinContainer(element, container) {
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        return {
            x: elementRect.left - containerRect.left + container.scrollLeft,
            y: elementRect.top - containerRect.top + container.scrollTop,
            width: elementRect.width,
            height: elementRect.height
        };
    }

    function drawRoundedRectPath(ctx, x, y, width, height, radius) {
        const clampedRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
        ctx.beginPath();
        ctx.moveTo(x + clampedRadius, y);
        ctx.lineTo(x + width - clampedRadius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + clampedRadius);
        ctx.lineTo(x + width, y + height - clampedRadius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - clampedRadius, y + height);
        ctx.lineTo(x + clampedRadius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - clampedRadius);
        ctx.lineTo(x, y + clampedRadius);
        ctx.quadraticCurveTo(x, y, x + clampedRadius, y);
        ctx.closePath();
    }

    function fillAndStrokeRoundedRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle, lineWidth) {
        drawRoundedRectPath(ctx, x, y, width, height, radius);
        if (fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.fill();
        }
        if (strokeStyle && lineWidth > 0) {
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = strokeStyle;
            ctx.stroke();
        }
    }

    function setCanvasFontFromStyle(ctx, style) {
        const fontStyle = style.fontStyle && style.fontStyle !== 'normal' ? `${style.fontStyle} ` : '';
        const fontVariant = style.fontVariant && style.fontVariant !== 'normal' ? `${style.fontVariant} ` : '';
        const fontWeight = style.fontWeight ? `${style.fontWeight} ` : '';
        const fontSize = style.fontSize || '14px';
        const fontFamily = style.fontFamily || 'sans-serif';
        ctx.font = `${fontStyle}${fontVariant}${fontWeight}${fontSize} ${fontFamily}`;
    }

    function breakCanvasTextToken(ctx, token, maxWidth) {
        if (!token) {
            return [''];
        }

        const segments = [];
        let current = '';

        Array.from(token).forEach((character) => {
            const candidate = current + character;
            if (!current || ctx.measureText(candidate).width <= maxWidth) {
                current = candidate;
                return;
            }

            segments.push(current);
            current = character;
        });

        if (current) {
            segments.push(current);
        }

        return segments;
    }

    function wrapCanvasText(ctx, text, maxWidth) {
        const normalizedText = String(text || '');
        const paragraphs = normalizedText.split(/\r?\n/);
        const lines = [];

        paragraphs.forEach((paragraph) => {
            if (paragraph.length === 0) {
                lines.push('');
                return;
            }

            const tokens = paragraph.split(/(\s+)/).filter((token) => token.length > 0);
            let currentLine = '';

            tokens.forEach((token) => {
                const candidate = currentLine ? `${currentLine}${token}` : token;
                if (!currentLine || ctx.measureText(candidate).width <= maxWidth) {
                    currentLine = candidate;
                    return;
                }

                if (currentLine.trim().length > 0) {
                    lines.push(currentLine.trimEnd());
                    currentLine = token.trimStart();
                } else {
                    currentLine = token;
                }

                if (ctx.measureText(currentLine).width <= maxWidth) {
                    return;
                }

                const brokenSegments = breakCanvasTextToken(ctx, currentLine, maxWidth);
                currentLine = brokenSegments.pop() || '';
                lines.push(...brokenSegments);
            });

            if (currentLine.length > 0) {
                lines.push(currentLine.trimEnd());
            }
        });

        return lines;
    }

    function loadImageFromUri(uri) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = function () {
                resolve(image);
            };
            image.onerror = function () {
                reject(new Error('Failed to load image data for export.'));
            };
            image.src = uri;
        });
    }

    function createRulevizBrowserExportFileTitle(fileName, index) {
        const normalizedName = typeof fileName === 'string' && fileName.trim().length > 0
            ? fileName.trim()
            : `${page_title}_${index + 1}`;
        return normalizedName.replace(/\.graphml$/i, '') + '_layout';
    }

    function getRulevizBrowserPngExportTitle() {
        const activeViewState = getActiveRulevizBrowserViewState();
        if (!activeViewState || !activeViewState.viewName) {
            return page_title;
        }

        const normalizedTitle = page_title.replace(/_ruleviz_(operation|pattern)$/i, '_ruleviz');
        return `${normalizedTitle}_${activeViewState.viewName}`;
    }

    function findGraphmlGeometryContainerForExport(graphNode) {
        const searchRoots = Array.from(graphNode.children || []).filter((child) => child.tagName === 'data');
        const roots = searchRoots.length !== 0 ? searchRoots : [graphNode];

        for (const root of roots) {
            const descendants = Array.from(root.getElementsByTagName('*'));
            const preferredContainer = descendants.find((element) => {
                return element.tagName === 'y:ShapeNode'
                    || element.tagName === 'y:GenericNode'
                    || element.tagName === 'y:GroupNode';
            });

            if (preferredContainer) {
                return preferredContainer;
            }

            const fallbackContainer = descendants.find((element) => element.tagName.startsWith('y:'));
            if (fallbackContainer) {
                return fallbackContainer;
            }
        }

        return null;
    }

    function getRulevizBrowserNodeGeometryForGraphmlExport(node) {
        const storedWidth = node.isParent()
            ? (
                Number(node.data('layoutFootprintWidth'))
                || Number(node.data('minCompoundWidth'))
                || Number(node.data('width'))
            )
            : Number(node.data('width'));
        const storedHeight = node.isParent()
            ? (
                Number(node.data('layoutFootprintHeight'))
                || Number(node.data('minCompoundHeight'))
                || Number(node.data('height'))
            )
            : Number(node.data('height'));
        const width = storedWidth > 0
            ? storedWidth
            : getNodeLayoutSize(node).width;
        const height = storedHeight > 0
            ? storedHeight
            : getNodeLayoutSize(node).height;
        const position = node.position();

        return {
            x: position.x - (width / 2),
            y: position.y - (height / 2),
            width: width,
            height: height
        };
    }

    function serializeRulevizBrowserCardGraphml(card) {
        const graphmlText = card && card.row ? card.row.graphmlText : '';
        if (typeof graphmlText !== 'string' || graphmlText.trim().length === 0 || !card.cy) {
            return null;
        }

        const xmlParser = new DOMParser();
        const exportDoc = xmlParser.parseFromString(graphmlText, 'text/xml');
        const serializer = new XMLSerializer();
        const yNamespace = exportDoc.lookupNamespaceURI('y') || 'http://www.yworks.com/xml/graphml';

        Array.from(exportDoc.getElementsByTagName('node')).forEach((graphNode) => {
            const nodeId = graphNode.getAttribute('id');
            if (!nodeId) {
                return;
            }

            const cyNode = card.cy.getElementById(nodeId);
            if (!cyNode || cyNode.length === 0) {
                return;
            }

            const geometry = getRulevizBrowserNodeGeometryForGraphmlExport(cyNode);
            const geometryContainer = findGraphmlGeometryContainerForExport(graphNode);
            if (!geometryContainer) {
                return;
            }

            let geometryElement = geometryContainer.getElementsByTagName('y:Geometry').item(0);
            if (!geometryElement) {
                geometryElement = exportDoc.createElementNS(yNamespace, 'y:Geometry');
                geometryContainer.insertBefore(geometryElement, geometryContainer.firstChild);
            }

            geometryElement.setAttribute('x', geometry.x.toFixed(2));
            geometryElement.setAttribute('y', geometry.y.toFixed(2));
            geometryElement.setAttribute('width', geometry.width.toFixed(2));
            geometryElement.setAttribute('height', geometry.height.toFixed(2));
        });

        return serializer.serializeToString(exportDoc);
    }

    async function exportRulevizBrowserPng() {
        const cards = getActiveRulevizBrowserCards();
        if (!isStandaloneRulevizBrowserActive() || !rulevizBrowser || cards.length === 0) {
            return;
        }

        const browserWidth = Math.max(rulevizBrowser.scrollWidth, rulevizBrowser.clientWidth, 1);
        const browserHeight = Math.max(rulevizBrowser.scrollHeight, rulevizBrowser.clientHeight, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(browserWidth * graphPngExportScale));
        canvas.height = Math.max(1, Math.round(browserHeight * graphPngExportScale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not create canvas context for export.');
        }

        ctx.scale(graphPngExportScale, graphPngExportScale);
        const browserStyle = window.getComputedStyle(rulevizBrowser);
        ctx.fillStyle = browserStyle.backgroundColor || getRulevizBrowserPalette().background;
        ctx.fillRect(0, 0, browserWidth, browserHeight);

        const cardsWithImages = await Promise.all(cards.map(async (card) => {
            const shellStyle = card.shell ? window.getComputedStyle(card.shell) : null;
            const imageUri = card.cy
                ? card.cy.png({
                    output: 'base64uri',
                    bg: shellStyle ? shellStyle.backgroundColor : getRulevizBrowserPalette().canvasBackground,
                    full: false,
                    scale: graphPngExportScale
                })
                : null;
            const image = imageUri ? await loadImageFromUri(imageUri) : null;
            return {
                card,
                image
            };
        }));

        cardsWithImages.forEach(({ card, image }, index) => {
            if (!card.rowElement || !card.labelElement || !card.shell || !card.graphContainer) {
                return;
            }

            const rowRect = getElementRectWithinContainer(card.rowElement, rulevizBrowser);
            const labelRect = getElementRectWithinContainer(card.labelElement, rulevizBrowser);
            const shellRect = getElementRectWithinContainer(card.shell, rulevizBrowser);
            const graphRect = getElementRectWithinContainer(card.graphContainer, rulevizBrowser);

            const rowStyle = window.getComputedStyle(card.rowElement);
            const labelStyle = window.getComputedStyle(card.labelElement);
            const shellStyle = window.getComputedStyle(card.shell);

            fillAndStrokeRoundedRect(
                ctx,
                rowRect.x,
                rowRect.y,
                rowRect.width,
                rowRect.height,
                parseFloat(rowStyle.borderRadius) || 16,
                rowStyle.backgroundColor,
                rowStyle.borderColor,
                parseFloat(rowStyle.borderWidth) || 1
            );

            setCanvasFontFromStyle(ctx, labelStyle);
            ctx.fillStyle = labelStyle.color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            const labelLineHeight = parseFloat(labelStyle.lineHeight) || (parseFloat(labelStyle.fontSize) * 1.25) || 18;
            const labelLines = wrapCanvasText(ctx, card.labelElement.textContent || card.row.displayLabel || `Rule ${index + 1}`, Math.max(24, labelRect.width));
            labelLines.forEach((line, lineIndex) => {
                ctx.fillText(line, labelRect.x, labelRect.y + (lineIndex * labelLineHeight));
            });

            fillAndStrokeRoundedRect(
                ctx,
                shellRect.x,
                shellRect.y,
                shellRect.width,
                shellRect.height,
                parseFloat(shellStyle.borderRadius) || 14,
                shellStyle.backgroundColor,
                shellStyle.borderColor,
                parseFloat(shellStyle.borderWidth) || 1
            );

            if (image) {
                ctx.save();
                drawRoundedRectPath(
                    ctx,
                    graphRect.x,
                    graphRect.y,
                    graphRect.width,
                    graphRect.height,
                    Math.max(0, (parseFloat(shellStyle.borderRadius) || 14) - 1)
                );
                ctx.clip();
                ctx.drawImage(image, graphRect.x, graphRect.y, graphRect.width, graphRect.height);
                ctx.restore();
            }

            if (card.bnglElement) {
                const bnglRect = getElementRectWithinContainer(card.bnglElement, rulevizBrowser);
                const bnglStyle = window.getComputedStyle(card.bnglElement);
                fillAndStrokeRoundedRect(
                    ctx,
                    bnglRect.x,
                    bnglRect.y,
                    bnglRect.width,
                    bnglRect.height,
                    parseFloat(bnglStyle.borderRadius) || 12,
                    bnglStyle.backgroundColor,
                    bnglStyle.borderColor,
                    parseFloat(bnglStyle.borderWidth) || 1
                );

                setCanvasFontFromStyle(ctx, bnglStyle);
                ctx.fillStyle = bnglStyle.color;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                const horizontalPadding = parseFloat(bnglStyle.paddingLeft) || 16;
                const verticalPadding = parseFloat(bnglStyle.paddingTop) || 14;
                const bnglLineHeight = parseFloat(bnglStyle.lineHeight) || (parseFloat(bnglStyle.fontSize) * 1.5) || 18;
                const bnglLines = wrapCanvasText(
                    ctx,
                    card.bnglElement.textContent || card.row.bnglText || '',
                    Math.max(24, bnglRect.width - (horizontalPadding * 2))
                );
                bnglLines.forEach((line, lineIndex) => {
                    ctx.fillText(
                        line,
                        bnglRect.x + horizontalPadding,
                        bnglRect.y + verticalPadding + (lineIndex * bnglLineHeight)
                    );
                });
            }
        });

        vscode.postMessage({
            command: 'image',
            type: 'png',
            title: getRulevizBrowserPngExportTitle(),
            folder: page_folder,
            text: canvas.toDataURL('image/png')
        });
    }

    function exportRulevizBrowserGraphml() {
        const cards = getActiveRulevizBrowserCards();
        if (!isStandaloneRulevizBrowserActive() || cards.length === 0) {
            return;
        }

        const files = cards.map((card, index) => {
            const text = serializeRulevizBrowserCardGraphml(card);
            if (!text) {
                return null;
            }

            return {
                title: createRulevizBrowserExportFileTitle(card.row && card.row.fileName, index),
                text
            };
        }).filter((item) => item && typeof item.title === 'string' && typeof item.text === 'string');

        if (files.length === 0) {
            return;
        }

        vscode.postMessage({
            command: 'graphml-export',
            folder: page_folder,
            files
        });
    }

    function parseRulevizBrowserGraphml(graphmlText, options = {}) {
        const xmlParser = new DOMParser();
        const xmlDoc = xmlParser.parseFromString(graphmlText, 'text/xml');
        const cytoElements = {
            nodes: [],
            edges: []
        };
        const nodeKindsById = {};
        let nodeCount = 0;
        let nodeOrderCounter = 0;

        function addRulevizNode(node, parentId, parentNodeKind) {
            const nodeId = node.getAttribute('id');
            if (!nodeId) {
                return;
            }

            let backgroundColor = node.getElementsByTagName('y:Fill').item(0);
            backgroundColor = backgroundColor ? backgroundColor.getAttribute('color') : null;
            backgroundColor = backgroundColor || '#999999';

            let border = node.getElementsByTagName('y:BorderStyle').item(0);
            let borderWidth = border ? border.getAttribute('width') : null;
            let borderColor = border ? border.getAttribute('color') : null;
            borderWidth = borderWidth || '1';
            borderColor = borderColor || '#000000';

            let shape = node.getElementsByTagName('y:Shape').item(0);
            shape = shape ? shape.getAttribute('type') : null;

            let label = node.getElementsByTagName('y:NodeLabel').item(0);
            let labelText = label ? label.textContent : '';
            let labelColor = label ? label.getAttribute('textColor') : null;
            let labelWeight = label ? label.getAttribute('fontStyle') : null;
            let labelFontSize = label ? parseFloat(label.getAttribute('fontSize')) : NaN;
            labelColor = labelColor || '#000000';
            labelWeight = labelWeight === 'bold' ? 'bold' : 'normal';
            labelFontSize = Number.isFinite(labelFontSize) && labelFontSize > 0 ? labelFontSize : 12;

            const hasDirectChildren = getDirectChildNodeElements(node).length > 0;
            const nodeKind = getRulevizBrowserNodeKind(
                backgroundColor,
                shape,
                parentId,
                parentNodeKind,
                labelText,
                {
                    viewName: options.viewName
                }
            );
            const dimensions = getRulevizBrowserNodeDimensions(nodeKind, labelText, hasDirectChildren);
            const labelValign = getRulevizBrowserNodeLabelValign(nodeKind);
            const labelHalign = getRulevizBrowserNodeLabelHalign(nodeKind);
            const labelJustification = getRulevizBrowserNodeLabelJustification(nodeKind);
            const labelMarginX = getRulevizBrowserNodeLabelMarginX(nodeKind, hasDirectChildren, dimensions.width);
            const labelMarginY = getRulevizBrowserNodeLabelMarginY(nodeKind, hasDirectChildren, dimensions.height);
            const labelBackgroundOpacity = getRulevizBrowserNodeLabelBackgroundOpacity(nodeKind);
            const labelBackgroundPadding = getRulevizBrowserNodeLabelBackgroundPadding(nodeKind);
            const computedLabelFontSize = getRulevizBrowserNodeLabelFontSize(
                nodeKind,
                labelFontSize,
                dimensions.width,
                dimensions.height,
                labelText,
                hasDirectChildren
            );
            const compoundPadding = getRulevizBrowserCompoundPadding(nodeKind, hasDirectChildren);
            const labelMaxWidth = getRulevizBrowserNodeLabelMaxWidth(nodeKind, hasDirectChildren, dimensions.width);
            const effectiveLabelText = nodeKind === 'rule' ? '' : labelText;
            const displayBackgroundColor = getRulevizBrowserNodeFillColor(nodeKind, backgroundColor);
            const displayBorderColor = getRulevizBrowserNodeBorderColor(nodeKind, borderColor);
            const displayLabelColor = getRulevizBrowserNodeLabelColor(nodeKind, labelColor);
            const displayBorderWidth = getRulevizBrowserNodeBorderWidth(nodeKind, borderWidth);

            cytoElements.nodes.push({
                data: {
                    id: nodeId,
                    parent: parentId || undefined,
                    nodeKind: nodeKind,
                    backgroundColor: backgroundColor,
                    displayBackgroundColor: displayBackgroundColor,
                    borderColor: borderColor,
                    displayBorderColor: displayBorderColor,
                    borderWidth: borderWidth,
                    displayBorderWidth: displayBorderWidth,
                    nodeShape: getRulevizBrowserNodeShape(nodeKind),
                    width: dimensions.width,
                    height: dimensions.height,
                    labelText: effectiveLabelText,
                    displayLabelBackgroundColor: labelBackgroundOpacity > 0 ? displayBackgroundColor : 'transparent',
                    displayLabelColor: displayLabelColor,
                    labelWeight: nodeKind === 'rule' || nodeKind === 'modifier' || (nodeKind === 'molecule' && hasDirectChildren) ? 'bold' : labelWeight,
                    labelFontSize: computedLabelFontSize,
                    labelValign: labelValign,
                    labelHalign: labelHalign,
                    labelJustification: labelJustification,
                    labelMarginX: labelMarginX,
                    labelMarginY: labelMarginY,
                    labelBackgroundOpacity: labelBackgroundOpacity,
                    labelBackgroundPadding: labelBackgroundPadding,
                    labelMaxWidth: labelMaxWidth,
                    compoundPadding: compoundPadding,
                    minCompoundWidth: hasDirectChildren ? dimensions.width : 0,
                    minCompoundHeight: hasDirectChildren ? dimensions.height : 0,
                    minZoomedFontSize: getRulevizBrowserMinZoomedFontSize(nodeKind),
                    nodeOrder: nodeOrderCounter
                }
            });
            nodeKindsById[nodeId] = nodeKind;
            nodeCount += 1;
            nodeOrderCounter += 1;

            if (node.getAttribute('yfiles.foldertype') === 'group' && hasDirectChildren) {
                addRulevizChildNodes(node, nodeId, nodeKind);
            }
        }

        function addRulevizChildNodes(root, parentId, parentNodeKind) {
            Array.from(root.children || []).forEach((element) => {
                if (element.tagName === 'graph') {
                    addRulevizChildNodes(element, parentId, parentNodeKind);
                    return;
                }

                if (element.tagName === 'node') {
                    addRulevizNode(element, parentId, parentNodeKind);
                }
            });
        }

        const graphmlRoot = xmlDoc.getElementsByTagName('graphml').item(0);
        if (graphmlRoot) {
            addRulevizChildNodes(graphmlRoot, null, null);
        }

        Array.from(xmlDoc.getElementsByTagName('edge')).forEach((edge, index) => {
            const source = edge.getAttribute('source');
            const target = edge.getAttribute('target');
            if (!source || !target) {
                return;
            }

            let line = edge.getElementsByTagName('y:LineStyle').item(0);
            let lineWidth = line ? line.getAttribute('width') : null;
            let lineColor = line ? line.getAttribute('color') : null;
            lineWidth = lineWidth || '1';
            lineColor = lineColor || '#000000';

            let arrow = edge.getElementsByTagName('y:Arrows').item(0);
            arrow = arrow ? arrow.getAttribute('target') : null;
            const sourceNodeKind = nodeKindsById[source] || 'other';
            const targetNodeKind = nodeKindsById[target] || 'other';

            cytoElements.edges.push({
                data: {
                    id: edge.getAttribute('id') || `e${index}`,
                    source: source,
                    target: target,
                    lineWidth: getRulevizBrowserEdgeWidth(lineWidth, sourceNodeKind, targetNodeKind),
                    displayLineColor: lineColor,
                    displayArrowColor: lineColor,
                    arrow: arrow === 'standard' ? 'triangle' : 'none'
                }
            });
        });

        return {
            elements: cytoElements,
            nodeCount: nodeCount
        };
    }

    function createRulevizBrowserStylesheet() {
        return [
            {
                selector: 'node',
                style: {
                    'background-color': 'data(displayBackgroundColor)',
                    'border-width': 'data(displayBorderWidth)',
                    'border-color': 'data(displayBorderColor)',
                    'shape': 'data(nodeShape)',
                    'width': 'data(width)',
                    'height': 'data(height)',
                    'label': 'data(labelText)',
                    'color': 'data(displayLabelColor)',
                    'font-weight': 'data(labelWeight)',
                    'font-size': 'data(labelFontSize)',
                    'text-valign': 'data(labelValign)',
                    'text-halign': 'data(labelHalign)',
                    'text-justification': 'data(labelJustification)',
                    'text-margin-x': 'data(labelMarginX)',
                    'text-margin-y': 'data(labelMarginY)',
                    'text-background-color': 'data(displayLabelBackgroundColor)',
                    'text-background-opacity': 'data(labelBackgroundOpacity)',
                    'text-background-padding': 'data(labelBackgroundPadding)',
                    'text-background-shape': 'round-rectangle',
                    'text-wrap': 'wrap',
                    'text-max-width': 'data(labelMaxWidth)',
                    'min-zoomed-font-size': 'data(minZoomedFontSize)'
                }
            },
            {
                selector: ':parent',
                style: {
                    'padding': 'data(compoundPadding)',
                    'min-width': 'data(minCompoundWidth)',
                    'min-height': 'data(minCompoundHeight)',
                    'compound-sizing-wrt-labels': 'include'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 'data(lineWidth)',
                    'line-color': 'data(displayLineColor)',
                    'target-arrow-color': 'data(displayArrowColor)',
                    'target-arrow-shape': 'data(arrow)',
                    'curve-style': 'bezier'
                }
            }
        ];
    }

    function createRulevizBrowserLayoutOptions(layoutName, options = {}) {
        const fit = options.fit !== false;
        const padding = Number.isFinite(options.padding) ? options.padding : 22;
        let layoutOptions;

        switch (layoutName) {
            case 'grid':
                layoutOptions = {
                    name: 'grid',
                    fit: fit,
                    padding: padding,
                    avoidOverlap: true,
                    avoidOverlapPadding: 22,
                    nodeDimensionsIncludeLabels: true,
                    animate: false
                };
                break;
            case 'circle':
                layoutOptions = {
                    name: 'circle',
                    fit: fit,
                    padding: padding,
                    avoidOverlap: true,
                    nodeDimensionsIncludeLabels: true,
                    spacingFactor: 1.12,
                    animate: false
                };
                break;
            case 'concentric':
                layoutOptions = {
                    name: 'concentric',
                    fit: fit,
                    padding: padding,
                    avoidOverlap: true,
                    nodeDimensionsIncludeLabels: true,
                    minNodeSpacing: 54,
                    spacingFactor: 1.1,
                    animate: false
                };
                break;
            case 'cose':
                layoutOptions = {
                    name: 'cose',
                    fit: fit,
                    padding: padding,
                    animate: false,
                    nodeDimensionsIncludeLabels: true,
                    componentSpacing: 92,
                    nodeOverlap: 16,
                    idealEdgeLength: 88,
                    edgeElasticity: 90,
                    nestingFactor: 0.95,
                    gravity: 1,
                    numIter: 1500,
                    initialTemp: 140,
                    coolingFactor: 0.96,
                    minTemp: 1
                };
                break;
            case 'breadthfirst':
            default:
                layoutOptions = {
                    name: 'breadthfirst',
                    fit: fit,
                    padding: padding,
                    directed: true,
                    animate: false,
                    avoidOverlap: true,
                    nodeDimensionsIncludeLabels: true,
                    spacingFactor: 1.16
                };
                break;
        }

        if (layoutOptions.name === 'breadthfirst') {
            if (options.rotateHorizontal) {
                layoutOptions.transform = (_node, position) => {
                    return {
                        x: position.y,
                        y: position.x
                    };
                };
            }

            if (options.roots && options.roots.length > 0) {
                layoutOptions.roots = options.roots;
            }
        }

        if (Number.isFinite(options.spacingFactor)) {
            layoutOptions.spacingFactor = options.spacingFactor;
        }

        if (Number.isFinite(options.avoidOverlapPadding)) {
            layoutOptions.avoidOverlapPadding = options.avoidOverlapPadding;
        }

        return layoutOptions;
    }

    function applyRulevizBrowserTheme() {
        if (!isStandaloneRulevizBrowserActive()) {
            return;
        }

        applyRulevizBrowserContainerTheme();
        const palette = getRulevizBrowserPalette();

        forEachRulevizBrowserCard((card) => {
            if (!card || !card.cy) {
                return;
            }

            if (card.shell) {
                card.shell.style.background = palette.canvasBackground;
                card.shell.style.borderColor = palette.canvasBorder;
            }

            card.cy.batch(() => {
                card.cy.nodes().forEach((node) => {
                    const nodeKind = node.data('nodeKind') || 'component';
                    const fill = getRulevizBrowserNodeFillColor(nodeKind, node.data('backgroundColor'));
                    const border = getRulevizBrowserNodeBorderColor(nodeKind, node.data('borderColor'));
                    const labelColor = ensureTextContrast(
                        getRulevizBrowserNodeLabelColor(nodeKind, node.data('labelColor') || node.data('displayLabelColor')),
                        fill,
                        4.5
                    );
                    const labelBackgroundOpacity = Number(node.data('labelBackgroundOpacity')) || 0;

                    node.data('displayBackgroundColor', fill);
                    node.data('displayBorderColor', border);
                    node.data('displayLabelColor', labelColor);
                    node.data(
                        'displayLabelBackgroundColor',
                        labelBackgroundOpacity > 0 ? fill : 'transparent'
                    );
                });

                card.cy.edges().forEach((edge) => {
                    edge.data('displayLineColor', palette.edge);
                    edge.data('displayArrowColor', palette.arrow);
                });
            });

            card.cy.style().update();
            card.cy.resize();
        });
    }

    function applyRulevizBrowserBnglVisibility() {
        if (!rulevizBrowser) {
            return;
        }

        rulevizBrowser.querySelectorAll('.ruleviz-browser-rule-bngl').forEach((element) => {
            element.hidden = false;
        });

        updateRegulatoryRuleBnglButton(false);
    }

    function getRulevizBrowserPackingConfig(nodeKind, childCount) {
        const contactMapNodeKind = getRulevizBrowserContactMapNodeKind(nodeKind);
        if (contactMapNodeKind) {
            return getContactMapPackingConfig(contactMapNodeKind, childCount);
        }

        switch (nodeKind) {
            case 'patternGroup':
                return {
                    gapX: 18,
                    gapY: 14,
                    targetAspect: childCount > 3 ? 1.18 : 1.42
                };
            case 'rule':
                return {
                    gapX: 18,
                    gapY: 14,
                    targetAspect: 1.35
                };
            default:
                return {
                    gapX: 14,
                    gapY: 10,
                    targetAspect: 1.4
                };
        }
    }

    function packRulevizBrowserChildren(parentNode) {
        if (!parentNode.isParent()) {
            return false;
        }

        const visibleChildren = parentNode.children(':visible').toArray().sort(compareNodeOrder);
        if (visibleChildren.length === 0) {
            return false;
        }

        const config = getRulevizBrowserPackingConfig(parentNode.data('nodeKind'), visibleChildren.length);
        const items = visibleChildren.map((childNode) => {
            const size = getNodeLayoutSize(childNode);
            return {
                node: childNode,
                width: size.width,
                height: size.height
            };
        });
        const positions = buildPackedPositions(items, config);
        let moved = false;

        positions.forEach((item) => {
            const currentPosition = item.node.position();
            if (Math.abs(currentPosition.x - item.x) > 0.5 || Math.abs(currentPosition.y - item.y) > 0.5) {
                item.node.position({
                    x: item.x,
                    y: item.y
                });
                moved = true;
            }
        });

        return moved;
    }

    function getRulevizBrowserPatternTopLevelNodes(cy, options = {}) {
        if (!cy) {
            return [];
        }

        const nodes = options.visibleOnly === false ? cy.nodes() : cy.nodes(':visible');
        return nodes.filter((node) => {
            return node.parent().length === 0;
        }).toArray().sort(compareNodeOrder);
    }

    function getRulevizBrowserPatternTopLevelEdges(cy, topLevelNodes, options = {}) {
        if (!cy || !Array.isArray(topLevelNodes) || topLevelNodes.length === 0) {
            return [];
        }

        const topLevelNodeIds = new Set(topLevelNodes.map((node) => node.id()));
        const edges = options.visibleOnly === false ? cy.edges() : cy.edges(':visible');
        return edges.filter((edge) => {
            return topLevelNodeIds.has(edge.source().id()) && topLevelNodeIds.has(edge.target().id());
        }).toArray();
    }

    function packRulevizBrowserPatternCompounds(cy) {
        if (!cy) {
            return false;
        }

        const topLevelNodes = getRulevizBrowserPatternTopLevelNodes(cy, { visibleOnly: true });
        if (topLevelNodes.length === 0) {
            return false;
        }

        const anchorPositions = new Map();
        topLevelNodes.forEach((node) => {
            anchorPositions.set(node.id(), {
                x: node.position('x'),
                y: node.position('y')
            });
        });

        const compoundNodes = cy.nodes(':visible').filter((node) => node.isParent()).toArray().sort((left, right) => {
            const depthDifference = right.parents().length - left.parents().length;
            if (depthDifference !== 0) {
                return depthDifference;
            }

            return compareNodeOrder(left, right);
        });
        let moved = false;

        cy.batch(() => {
            compoundNodes.forEach((compoundNode) => {
                moved = packRulevizBrowserChildren(compoundNode) || moved;
            });

            anchorPositions.forEach((anchorPosition, nodeId) => {
                const topLevelNode = cy.getElementById(nodeId);
                if (!topLevelNode || topLevelNode.length === 0 || !topLevelNode.visible()) {
                    return;
                }

                const currentPosition = topLevelNode.position();
                const deltaX = anchorPosition.x - currentPosition.x;
                const deltaY = anchorPosition.y - currentPosition.y;
                if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
                    topLevelNode.shift({
                        x: deltaX,
                        y: deltaY
                    });
                    moved = true;
                }
            });
        });

        return moved;
    }

    function getRulevizBrowserPatternRootNodes(cy, topLevelNodes, topLevelEdges) {
        const incomingCounts = new Map();
        const outgoingCounts = new Map();

        topLevelNodes.forEach((node) => {
            incomingCounts.set(node.id(), 0);
            outgoingCounts.set(node.id(), 0);
        });

        topLevelEdges.forEach((edge) => {
            incomingCounts.set(edge.target().id(), (incomingCounts.get(edge.target().id()) || 0) + 1);
            outgoingCounts.set(edge.source().id(), (outgoingCounts.get(edge.source().id()) || 0) + 1);
        });

        const roots = topLevelNodes.filter((node) => {
            return (incomingCounts.get(node.id()) || 0) === 0;
        });
        if (roots.length > 0) {
            return cy.collection(roots);
        }

        const nonRuleNodes = topLevelNodes.filter((node) => node.data('nodeKind') !== 'rule');
        if (nonRuleNodes.length > 0) {
            return cy.collection(nonRuleNodes);
        }

        return cy.collection(topLevelNodes);
    }

    function getRulevizBrowserPatternTopLevelRanks(cy, topLevelNodes, topLevelEdges) {
        const nodeById = new Map();
        const incomingCounts = new Map();
        const outgoingIdsBySource = new Map();
        const incomingIdsByTarget = new Map();
        const rankById = new Map();

        topLevelNodes.forEach((node) => {
            nodeById.set(node.id(), node);
            incomingCounts.set(node.id(), 0);
            outgoingIdsBySource.set(node.id(), []);
            incomingIdsByTarget.set(node.id(), []);
            rankById.set(node.id(), 0);
        });

        topLevelEdges.forEach((edge) => {
            const sourceId = edge.source().id();
            const targetId = edge.target().id();
            if (!nodeById.has(sourceId) || !nodeById.has(targetId)) {
                return;
            }

            incomingCounts.set(targetId, (incomingCounts.get(targetId) || 0) + 1);
            outgoingIdsBySource.get(sourceId).push(targetId);
            incomingIdsByTarget.get(targetId).push(sourceId);
        });

        outgoingIdsBySource.forEach((targetIds) => {
            targetIds.sort((leftId, rightId) => compareNodeOrder(nodeById.get(leftId), nodeById.get(rightId)));
        });

        const queue = getRulevizBrowserPatternRootNodes(cy, topLevelNodes, topLevelEdges).toArray().sort(compareNodeOrder);
        const visitedNodeIds = new Set();

        while (queue.length > 0) {
            const node = queue.shift();
            if (!node) {
                continue;
            }

            const nodeId = node.id();
            if (visitedNodeIds.has(nodeId)) {
                continue;
            }

            visitedNodeIds.add(nodeId);
            const sourceRank = rankById.get(nodeId) || 0;
            const outgoingIds = outgoingIdsBySource.get(nodeId) || [];
            outgoingIds.forEach((targetId) => {
                rankById.set(targetId, Math.max(rankById.get(targetId) || 0, sourceRank + 1));
                incomingCounts.set(targetId, Math.max(0, (incomingCounts.get(targetId) || 0) - 1));
                if ((incomingCounts.get(targetId) || 0) === 0) {
                    queue.push(nodeById.get(targetId));
                }
            });

            queue.sort(compareNodeOrder);
        }

        if (visitedNodeIds.size !== topLevelNodes.length) {
            const fallbackRuleRank = topLevelNodes.some((node) => node.data('nodeKind') === 'rule') ? 1 : 0;
            topLevelNodes.forEach((node) => {
                if (visitedNodeIds.has(node.id())) {
                    return;
                }

                const hasIncoming = (incomingIdsByTarget.get(node.id()) || []).length > 0;
                const hasOutgoing = (outgoingIdsBySource.get(node.id()) || []).length > 0;
                if (node.data('nodeKind') === 'rule') {
                    rankById.set(node.id(), fallbackRuleRank);
                    return;
                }

                rankById.set(node.id(), hasIncoming && !hasOutgoing ? fallbackRuleRank + 1 : 0);
            });
        }

        return rankById;
    }

    function applyRulevizBrowserPatternBreadthfirstLayout(cy, topLevelNodes, topLevelEdges) {
        const rankById = getRulevizBrowserPatternTopLevelRanks(cy, topLevelNodes, topLevelEdges);
        const nodesByRank = new Map();

        topLevelNodes.forEach((node) => {
            const rank = rankById.get(node.id()) || 0;
            if (!nodesByRank.has(rank)) {
                nodesByRank.set(rank, []);
            }

            nodesByRank.get(rank).push(node);
        });

        const ranks = Array.from(nodesByRank.keys()).sort((left, right) => left - right);
        const columnGap = 80;
        const rowGap = 34;
        const columnWidths = new Map();

        ranks.forEach((rank) => {
            const columnWidth = nodesByRank.get(rank).reduce((maxWidth, node) => {
                return Math.max(maxWidth, getNodeLayoutSize(node).width);
            }, 0);
            columnWidths.set(rank, columnWidth);
        });

        const totalWidth = ranks.reduce((width, rank, index) => {
            return width + (columnWidths.get(rank) || 0) + (index > 0 ? columnGap : 0);
        }, 0);
        let cursorX = -totalWidth / 2;

        cy.batch(() => {
            ranks.forEach((rank) => {
                const columnNodes = nodesByRank.get(rank).slice().sort((left, right) => {
                    const leftKind = left.data('nodeKind');
                    const rightKind = right.data('nodeKind');
                    if (leftKind === 'rule' && rightKind !== 'rule') {
                        return 1;
                    }

                    if (leftKind !== 'rule' && rightKind === 'rule') {
                        return -1;
                    }

                    return compareNodeOrder(left, right);
                });
                const sizedNodes = columnNodes.map((node) => {
                    return {
                        node: node,
                        size: getNodeLayoutSize(node)
                    };
                });
                const totalHeight = sizedNodes.reduce((height, item, index) => {
                    return height + item.size.height + (index > 0 ? rowGap : 0);
                }, 0);
                let cursorY = -totalHeight / 2;
                const centerX = cursorX + ((columnWidths.get(rank) || 0) / 2);

                sizedNodes.forEach((item) => {
                    const currentPosition = item.node.position();
                    const targetPosition = {
                        x: centerX,
                        y: cursorY + (item.size.height / 2)
                    };
                    const deltaX = targetPosition.x - currentPosition.x;
                    const deltaY = targetPosition.y - currentPosition.y;

                    if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
                        item.node.shift({
                            x: deltaX,
                            y: deltaY
                        });
                    }

                    cursorY += item.size.height + rowGap;
                });

                cursorX += (columnWidths.get(rank) || 0) + columnGap;
            });
        });

        cy.fit(cy.elements(':visible'), getGraphFitPadding());
    }

    function applyRulevizBrowserPatternCardLayout(card, layoutName) {
        if (!card || !card.cy) {
            return;
        }

        const cy = card.cy;
        cy.resize();
        packRulevizBrowserPatternCompounds(cy);

        const topLevelNodes = getRulevizBrowserPatternTopLevelNodes(cy, { visibleOnly: true });
        if (topLevelNodes.length === 0) {
            return;
        }

        const topLevelEdges = getRulevizBrowserPatternTopLevelEdges(cy, topLevelNodes, { visibleOnly: true });
        let layoutElements = cy.collection(topLevelNodes);
        if (topLevelEdges.length > 0) {
            layoutElements = layoutElements.union(cy.collection(topLevelEdges));
        }

        if (layoutName === 'breadthfirst') {
            applyRulevizBrowserPatternBreadthfirstLayout(cy, topLevelNodes, topLevelEdges);
            return;
        }

        const layoutOptions = createRulevizBrowserLayoutOptions(layoutName);
        const layout = layoutElements.layout(layoutOptions);
        layout.run();
    }

    function applyRulevizBrowserCardInteractivity(card) {
        if (!card || !card.cy) {
            return;
        }

        card.cy.batch(() => {
            card.cy.nodes().forEach((node) => {
                if (graphLayoutLocked) {
                    node.ungrabify();
                    node.lock();
                    return;
                }

                node.unlock();
                node.grabify();
            });
        });
    }

    function applyRulevizBrowserLayout(layoutName, options = {}) {
        if (!isStandaloneRulevizBrowserActive()) {
            return;
        }

        const availableLayouts = currentRulevizBrowser.layoutFactories;
        const normalizedLayoutName = normalizeLayoutSelection(
            layoutName,
            false,
            currentRulevizBrowser.defaultLayoutName,
            availableLayouts
        );
        currentGraphLayoutName = normalizedLayoutName;

        if (options.persist !== false) {
            persistGraphViewState();
        }

        const layoutSelect = document.getElementById('layout_select');
        if (layoutSelect) {
            layoutSelect.value = normalizedLayoutName;
        }

        forEachRulevizBrowserCard((card) => {
            if (!card || !card.cy) {
                return;
            }

            if (card.viewName === 'pattern') {
                applyRulevizBrowserPatternCardLayout(card, normalizedLayoutName);
                return;
            }

            card.cy.resize();
            const layout = card.cy.layout(createRulevizBrowserLayoutOptions(normalizedLayoutName));
            layout.run();
        });
    }

    function createRulevizBrowserViewState(viewName, rows) {
        const safeRows = Array.isArray(rows)
            ? rows.filter((row) => {
                return row
                    && typeof row.graphmlText === 'string'
                    && row.graphmlText.trim().length > 0
                    && typeof row.displayLabel === 'string'
                    && row.displayLabel.trim().length > 0;
            })
            : [];

        if (safeRows.length === 0) {
            return null;
        }

        const viewElement = document.createElement('section');
        viewElement.className = 'ruleviz-browser-view';
        viewElement.dataset.rulevizView = viewName;

        const table = document.createElement('section');
        table.className = 'ruleviz-browser-table';
        viewElement.appendChild(table);

        const cards = [];

        safeRows.forEach((row) => {
            const parsedGraph = parseRulevizBrowserGraphml(row.graphmlText, {
                viewName: viewName
            });

            const rowElement = document.createElement('article');
            rowElement.className = 'ruleviz-browser-row';

            const metaElement = document.createElement('div');
            metaElement.className = 'ruleviz-browser-meta';

            const labelElement = document.createElement('div');
            labelElement.className = 'ruleviz-browser-rule-label';
            labelElement.textContent = row.displayLabel;
            metaElement.appendChild(labelElement);

            const graphCell = document.createElement('div');
            graphCell.className = 'ruleviz-browser-graph-cell';

            const graphShell = document.createElement('div');
            graphShell.className = 'ruleviz-browser-graph-shell';
            graphShell.style.height = `${getRulevizBrowserGraphHeight(parsedGraph.nodeCount)}px`;

            const graphContainer = document.createElement('div');
            graphContainer.className = 'ruleviz-browser-graph';
            graphShell.appendChild(graphContainer);
            graphCell.appendChild(graphShell);

            rowElement.appendChild(metaElement);
            rowElement.appendChild(graphCell);

            let bnglElement = null;
            if (row.bnglText) {
                bnglElement = document.createElement('pre');
                bnglElement.className = 'ruleviz-browser-rule-bngl';
                bnglElement.textContent = row.bnglText;
                rowElement.appendChild(bnglElement);
            }

            table.appendChild(rowElement);

            const cy = cytoscape({
                container: graphContainer,
                elements: parsedGraph.elements,
                style: createRulevizBrowserStylesheet(),
                layout: {
                    name: 'preset',
                    fit: false
                }
            });

            cards.push({
                cy: cy,
                shell: graphShell,
                row: row,
                viewName: viewName,
                rowElement: rowElement,
                labelElement: labelElement,
                graphContainer: graphContainer,
                bnglElement: bnglElement
            });
        });

        return {
            viewName: viewName,
            rows: safeRows,
            cards: cards,
            viewElement: viewElement
        };
    }

    function updateRulevizViewButton() {
        const toggleRulevizViewButton = document.getElementById('toggle_ruleviz_view_button');
        if (!toggleRulevizViewButton) {
            return;
        }

        const availableViewNames = getAvailableRulevizBrowserViewNames();
        const activeViewState = getActiveRulevizBrowserViewState();
        const isAvailable = isStandaloneRulevizBrowserActive() && Boolean(activeViewState) && availableViewNames.length > 1;

        toggleRulevizViewButton.hidden = !isAvailable;
        toggleRulevizViewButton.disabled = !isAvailable;

        if (!isAvailable || !activeViewState) {
            toggleRulevizViewButton.textContent = 'Show Pattern';
            toggleRulevizViewButton.title = '';
            delete toggleRulevizViewButton.dataset.targetRulevizView;
            return;
        }

        const nextViewName = availableViewNames.find((viewName) => viewName !== activeViewState.viewName) || activeViewState.viewName;
        const label = nextViewName === 'pattern' ? 'Show Pattern' : 'Show Operation';
        toggleRulevizViewButton.textContent = label;
        toggleRulevizViewButton.setAttribute('aria-label', label);
        toggleRulevizViewButton.title = nextViewName === 'pattern'
            ? 'Switch the standalone RuleViz browser to pattern view.'
            : 'Switch the standalone RuleViz browser to operation view.';
        toggleRulevizViewButton.dataset.targetRulevizView = nextViewName;
    }

    function setRulevizBrowserActiveView(viewName, options = {}) {
        if (!isStandaloneRulevizBrowserActive()) {
            return;
        }

        const availableViewNames = getAvailableRulevizBrowserViewNames();
        if (availableViewNames.length === 0) {
            updateRulevizViewButton();
            return;
        }

        const normalizedViewName = availableViewNames.includes(viewName)
            ? viewName
            : availableViewNames[0];

        currentRulevizBrowser.activeView = normalizedViewName;

        availableViewNames.forEach((name) => {
            const viewState = getRulevizBrowserViewState(name);
            if (!viewState || !viewState.viewElement) {
                return;
            }

            viewState.viewElement.hidden = name !== normalizedViewName;
        });

        getActiveRulevizBrowserCards().forEach((card) => {
            if (card && card.cy) {
                card.cy.resize();
            }
        });

        applyRulevizBrowserLayout(currentGraphLayoutName, { persist: false });
        applyRulevizBrowserLayoutLock();

        updateRulevizViewButton();

        if (options.fit) {
            applyRulevizBrowserFit({
                animate: options.animate !== false
            });
        }
    }

    function renderRulevizBrowser(views, initialView) {
        destroyRulevizBrowser();

        if (!rulevizBrowser || !network) {
            return;
        }

        const operationRows = views && views.operation && Array.isArray(views.operation.rows)
            ? views.operation.rows
            : [];
        const patternRows = views && views.pattern && Array.isArray(views.pattern.rows)
            ? views.pattern.rows
            : [];

        network.hidden = true;
        rulevizBrowser.hidden = false;
        rulevizBrowser.innerHTML = '';

        const operationViewState = createRulevizBrowserViewState('operation', operationRows);
        const patternViewState = createRulevizBrowserViewState('pattern', patternRows);

        if (!operationViewState && !patternViewState) {
            const emptyState = document.createElement('div');
            emptyState.className = 'ruleviz-browser-empty';
            emptyState.textContent = 'No standalone RuleViz rows were available for this results folder.';
            rulevizBrowser.appendChild(emptyState);
        } else {
            [operationViewState, patternViewState].forEach((viewState) => {
                if (!viewState) {
                    return;
                }

                rulevizBrowser.appendChild(viewState.viewElement);
            });
        }

        currentRulevizBrowser = {
            activeView: initialView === 'pattern' ? 'pattern' : 'operation',
            views: {
                operation: operationViewState,
                pattern: patternViewState
            },
            showRuleBnglAvailable: [operationViewState, patternViewState].some((viewState) => {
                return viewState && viewState.rows.some((row) => typeof row.bnglText === 'string' && row.bnglText.trim().length > 0);
            }),
            defaultLayoutName: 'breadthfirst',
            layoutFactories: {
                breadthfirst: true,
                grid: true,
                circle: true,
                concentric: true,
                cose: true
            },
            viewportSyncScheduled: false,
            scrollHandler: () => {
                scheduleRulevizBrowserViewportSync();
            },
            resizeHandler: () => {
                scheduleRulevizBrowserViewportSync();
            }
        };

        rulevizBrowser.addEventListener('scroll', currentRulevizBrowser.scrollHandler, {
            passive: true
        });
        window.addEventListener('resize', currentRulevizBrowser.resizeHandler);

        configureToolbarForRulevizBrowser(true);
        applyRulevizBrowserTheme();
        applyRulevizBrowserBnglVisibility();
        setRulevizBrowserActiveView(currentRulevizBrowser.activeView, { fit: false });
    }

    function updateComponentsButton() {
        const toggleComponentsButton = document.getElementById('toggle_components_button');
        if (!toggleComponentsButton) {
            return;
        }

        const isAvailable = graphKind === 'contactmap' && graphHasComponents;
        toggleComponentsButton.hidden = !isAvailable;
        toggleComponentsButton.disabled = !isAvailable;

        if (!isAvailable) {
            return;
        }

        const label = showComponents ? 'Hide Components' : 'Show Components';
        toggleComponentsButton.textContent = label;
        toggleComponentsButton.setAttribute('aria-label', label);
    }

    function updateInternalStatesButton() {
        const toggleInternalStatesButton = document.getElementById('toggle_internal_states_button');
        if (!toggleInternalStatesButton) {
            return;
        }

        const isAvailable = graphKind === 'contactmap' && graphHasInternalStates && showComponents;
        toggleInternalStatesButton.hidden = !isAvailable;
        toggleInternalStatesButton.disabled = !isAvailable;

        if (!isAvailable) {
            return;
        }

        const label = showInternalStates ? 'Hide Internal States' : 'Show Internal States';
        toggleInternalStatesButton.textContent = label;
        toggleInternalStatesButton.setAttribute('aria-label', label);
    }

    function updateRegulatoryRuleBnglButton(isAvailable) {
        const toggleRuleBnglButton = document.getElementById('toggle_rule_bngl_button');
        if (!toggleRuleBnglButton) {
            return;
        }

        toggleRuleBnglButton.hidden = !isAvailable;
        toggleRuleBnglButton.disabled = !isAvailable;

        if (!isAvailable) {
            return;
        }

        const label = showRegulatoryRuleBngl ? 'Hide Rule BNGL' : 'Show Rule BNGL';
        toggleRuleBnglButton.textContent = label;
        toggleRuleBnglButton.setAttribute('aria-label', label);
        if (isStandaloneRulevizBrowserActive()) {
            toggleRuleBnglButton.title = showRegulatoryRuleBngl
                ? 'Hide the full BNGL text for each RuleViz row.'
                : 'Show the full BNGL text for each RuleViz row.';
            return;
        }

        toggleRuleBnglButton.title = showRegulatoryRuleBngl
            ? 'Show the compact BioNetGen rule labels on regulatory-rule nodes.'
            : 'Show the full BNGL rule text below the regulatory-rule nodes.';
    }

    function updateLayoutLockButton(layoutSelect) {
        const layoutLockButton = document.getElementById('layout_lock_button');
        if (!layoutLockButton) {
            return;
        }

        const label = graphLayoutLocked ? 'Unlock Layout' : 'Lock Layout';
        layoutLockButton.textContent = label;
        layoutLockButton.setAttribute('aria-label', label);

        if (layoutSelect) {
            layoutSelect.disabled = graphLayoutLocked;
            layoutSelect.title = graphLayoutLocked
                ? 'Unlock layout to change the layout style.'
                : '';
        }
    }

    function normalizeLayoutSelection(layoutName, hasSpecifiedPositions, defaultLayoutName, layoutFactories) {
        if (!layoutName || !Object.prototype.hasOwnProperty.call(layoutFactories, layoutName)) {
            return defaultLayoutName;
        }

        if (layoutName === 'preset' && !hasSpecifiedPositions) {
            return defaultLayoutName;
        }

        return layoutName;
    }

    function getNodeBaseBackgroundColor(node) {
        if (node.data('isRegulatoryRuleBnglCaption')) {
            return 'transparent';
        }

        const sourceColor = node.data('backgroundColor');
        if (isStandaloneContactMapViewer()) {
            return getContactMapBaseFillColor(node.data('nodeKind'), sourceColor);
        }

        if (isStandaloneRegulatoryViewer()) {
            return getRegulatoryBaseFillColor(sourceColor);
        }

        return sourceColor;
    }

    function getNodeBaseBorderColor(node) {
        if (node.data('isRegulatoryRuleBnglCaption')) {
            return 'transparent';
        }

        const sourceColor = node.data('borderColor');
        if (isStandaloneContactMapViewer()) {
            return getContactMapBaseBorderColor(node.data('nodeKind'), sourceColor);
        }

        if (isStandaloneRegulatoryViewer()) {
            return getRegulatoryViewerPalette().nodeBorder;
        }

        return sourceColor;
    }

    function getNodeBaseLabelColor(node) {
        if (node.data('isRegulatoryRuleBnglCaption')) {
            return isStandaloneRegulatoryViewer()
                ? getRegulatoryViewerPalette().nodeLabel
                : (node.data('labelColor') || '#000000');
        }

        const sourceColor = node.data('labelColor');
        if (isStandaloneContactMapViewer()) {
            return getContactMapBaseLabelColor(node.data('nodeKind'), sourceColor);
        }

        if (isStandaloneRegulatoryViewer()) {
            return getRegulatoryViewerPalette().nodeLabel;
        }

        return sourceColor;
    }

    function getEdgeBaseLineColor(edge) {
        const sourceColor = edge.data('lineColor');
        if (isStandaloneContactMapViewer()) {
            return getContactMapViewerPalette().edge;
        }

        if (isStandaloneRegulatoryViewer()) {
            return getRegulatoryEdgeColor(sourceColor, 'edge');
        }

        return sourceColor;
    }

    function getEdgeBaseArrowColor(edge) {
        const sourceColor = edge.data('arrowColor');
        if (isStandaloneContactMapViewer()) {
            return getContactMapViewerPalette().arrow;
        }

        if (isStandaloneRegulatoryViewer()) {
            return getRegulatoryEdgeColor(sourceColor || edge.data('lineColor'), 'arrow');
        }

        return sourceColor || edge.data('lineColor');
    }

    function getNodeDisplayLabelColor(node) {
        if (node.data('isRegulatoryRuleBnglCaption') && isStandaloneRegulatoryViewer()) {
            return ensureTextContrast(
                getRegulatoryViewerPalette().nodeLabel,
                getRegulatoryViewerPalette().background,
                5
            );
        }

        const backgroundColor = getNodeBaseBackgroundColor(node);
        let labelColor = getNodeBaseLabelColor(node);

        if (!isStandaloneGraphPaletteViewer() && currentViewMode === VIEW_MODE_DARK && isColorDark(backgroundColor)) {
            labelColor = liftColorForDarkMode(labelColor, 0.62);
        }

        return ensureTextContrast(labelColor, backgroundColor, 4.5);
    }

    function getNodeDisplayLabelBackgroundColor(node) {
        if (!isStandaloneContactMapViewer()) {
            return 'transparent';
        }

        const nodeKind = node.data('nodeKind');
        if (nodeKind !== 'molecule' && nodeKind !== 'site') {
            return 'transparent';
        }

        return getNodeBaseBackgroundColor(node);
    }

    function applyStandaloneGraphCanvasTheme() {
        const networkWrapper = document.getElementById('network_wrapper');

        if (!networkWrapper) {
            return;
        }

        if (isStandaloneRulevizBrowserActive()) {
            const palette = getRulevizBrowserPalette();
            applyRulevizBrowserContainerTheme();
            networkWrapper.style.background = palette.background;
            if (network) {
                network.style.background = '';
                network.style.backgroundColor = '';
            }
            return;
        }

        if (!network) {
            return;
        }

        if (isStandaloneContactMapViewer()) {
            const palette = getContactMapViewerPalette();
            network.style.background = palette.background;
            network.style.backgroundColor = palette.background;
            networkWrapper.style.background = palette.background;
            return;
        }

        if (isStandaloneRegulatoryViewer()) {
            const palette = getRegulatoryViewerPalette();
            network.style.background = palette.background;
            network.style.backgroundColor = palette.background;
            networkWrapper.style.background = palette.background;
            return;
        }

        network.style.background = '';
        network.style.backgroundColor = '';
        networkWrapper.style.background = '';
    }

    function applyGraphTheme() {
        if (isStandaloneRulevizBrowserActive()) {
            applyRulevizBrowserTheme();
            applyStandaloneGraphCanvasTheme();
            return;
        }

        if (!currentCy) {
            applyStandaloneGraphCanvasTheme();
            return;
        }

        currentCy.batch(() => {
            currentCy.nodes().forEach((node) => {
                node.data('displayBackgroundColor', getNodeBaseBackgroundColor(node));
                node.data('displayBorderColor', adaptGraphColor(getNodeBaseBorderColor(node), 'border'));
                node.data('displayLabelColor', getNodeDisplayLabelColor(node));
                node.data('displayLabelBackgroundColor', getNodeDisplayLabelBackgroundColor(node));
            });

            currentCy.edges().forEach((edge) => {
                edge.data('displayLineColor', adaptGraphColor(getEdgeBaseLineColor(edge), 'edge'));
                edge.data('displayArrowColor', adaptGraphColor(getEdgeBaseArrowColor(edge), 'edge'));
            });
        });

        currentCy.style().update();
        applyStandaloneGraphCanvasTheme();
    }

    function applyContactMapStructureVisibility() {
        if (!currentCy) {
            return;
        }

        currentCy.batch(() => {
            currentCy.nodes().forEach((node) => {
                const nodeKind = node.data('nodeKind');
                const shouldHideComponents = graphKind === 'contactmap'
                    && graphHasComponents
                    && !showComponents
                    && (nodeKind === 'site' || nodeKind === 'state');
                const shouldHideStates = graphKind === 'contactmap'
                    && graphHasInternalStates
                    && showComponents
                    && !showInternalStates
                    && nodeKind === 'state';
                node.toggleClass('contact-map-structure-hidden', shouldHideComponents || shouldHideStates);
            });
        });

        syncContactMapPromotedEdges(currentCy);
        currentCy.style().update();
    }

    function compareNodeOrder(left, right) {
        const leftOrder = Number(left.data('nodeOrder')) || 0;
        const rightOrder = Number(right.data('nodeOrder')) || 0;

        if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
        }

        return left.id().localeCompare(right.id());
    }

    function getStandaloneContactMapLayoutScratch(cy) {
        if (!cy) {
            return { prepared: false };
        }

        let scratch = cy.scratch('_standaloneContactMapLayout');
        if (!scratch) {
            scratch = { prepared: false };
            cy.scratch('_standaloneContactMapLayout', scratch);
        }

        return scratch;
    }

    function getTopLevelStandaloneContactMapMolecule(node) {
        if (!node || node.length === 0) {
            return null;
        }

        let currentNode = node;
        while (currentNode && currentNode.length !== 0) {
            if (currentNode.data('nodeKind') === 'molecule' && currentNode.parent().length === 0) {
                return currentNode;
            }

            currentNode = currentNode.parent();
        }

        return null;
    }

    function getTopLevelStandaloneContactMapMolecules(cy, options = {}) {
        const visibleOnly = options.visibleOnly !== false;
        const nodes = visibleOnly ? cy.nodes(':visible') : cy.nodes();

        return nodes.filter((node) => {
            return node.data('nodeKind') === 'molecule' && node.parent().length === 0;
        }).toArray();
    }

    function isContactMapNodeVisibleInCurrentStructure(node) {
        if (!node || node.length === 0 || graphKind !== 'contactmap') {
            return true;
        }

        const nodeKind = node.data('nodeKind');
        if (!showComponents && (nodeKind === 'site' || nodeKind === 'state')) {
            return false;
        }

        if (showComponents && !showInternalStates && nodeKind === 'state') {
            return false;
        }

        return true;
    }

    function getContactMapVisibleAnchor(node) {
        let currentNode = node;

        while (currentNode && currentNode.length !== 0) {
            if (isContactMapNodeVisibleInCurrentStructure(currentNode)) {
                return currentNode;
            }

            currentNode = currentNode.parent();
        }

        return null;
    }

    function getContactMapPromotedEdgeKey(sourceAnchor, targetAnchor, arrow) {
        const sourceId = sourceAnchor.id();
        const targetId = targetAnchor.id();

        if (arrow && arrow !== 'none') {
            return `directed::${sourceId}->${targetId}::${arrow}`;
        }

        return `undirected::${[sourceId, targetId].sort().join('::')}`;
    }

    function syncContactMapPromotedEdges(cy) {
        if (!cy) {
            return;
        }

        cy.batch(() => {
            const existingPromotedEdges = cy.edges().filter((edge) => Boolean(edge.data('isPromotedEdge')));
            if (existingPromotedEdges.length !== 0) {
                cy.remove(existingPromotedEdges);
            }

            const promotedEdges = [];
            const promotedEdgeDataByKey = new Map();

            cy.edges().filter((edge) => !edge.data('isPromotedEdge')).forEach((edge) => {
                const sourceNode = edge.source();
                const targetNode = edge.target();
                const sourceAnchor = getContactMapVisibleAnchor(sourceNode);
                const targetAnchor = getContactMapVisibleAnchor(targetNode);
                const shouldHideOriginal = !sourceAnchor
                    || !targetAnchor
                    || sourceAnchor.id() === targetAnchor.id();
                const shouldPromote = !shouldHideOriginal
                    && (sourceAnchor.id() !== sourceNode.id() || targetAnchor.id() !== targetNode.id());

                edge.toggleClass('contact-map-structure-hidden', shouldHideOriginal || shouldPromote);

                if (!shouldPromote) {
                    return;
                }

                const arrow = edge.data('arrow') || 'none';
                const promotedKey = getContactMapPromotedEdgeKey(sourceAnchor, targetAnchor, arrow);
                const parsedLineWidth = Number.parseFloat(edge.data('lineWidth'));

                if (promotedEdgeDataByKey.has(promotedKey)) {
                    const promotedEdge = promotedEdgeDataByKey.get(promotedKey);
                    if (Number.isFinite(parsedLineWidth)) {
                        promotedEdge.lineWidth = Math.max(Number.parseFloat(promotedEdge.lineWidth) || 1, parsedLineWidth).toString();
                    }
                    return;
                }

                const promotedEdge = {
                    id: `contact-map-promoted-edge-${promotedEdgeDataByKey.size}`,
                    source: sourceAnchor.id(),
                    target: targetAnchor.id(),
                    lineWidth: Number.isFinite(parsedLineWidth) ? parsedLineWidth.toString() : (edge.data('lineWidth') || '1'),
                    lineColor: edge.data('lineColor'),
                    displayLineColor: edge.data('displayLineColor') || edge.data('lineColor'),
                    arrowColor: edge.data('arrowColor') || edge.data('lineColor'),
                    displayArrowColor: edge.data('displayArrowColor') || edge.data('arrowColor') || edge.data('lineColor'),
                    arrow: arrow,
                    connectsState: false,
                    connectsComponent: false,
                    isPromotedEdge: true
                };

                promotedEdgeDataByKey.set(promotedKey, promotedEdge);
                promotedEdges.push({ data: promotedEdge });
            });

            if (promotedEdges.length !== 0) {
                cy.add(promotedEdges);
            }
        });
    }

    function getNodeLayoutSize(node) {
        const bounds = node.boundingBox({
            includeLabels: true,
            includeOverlays: false
        });
        const baseWidth = node.isParent()
            ? (Number(node.data('minCompoundWidth')) || Number(node.data('width')) || 0)
            : (Number(node.data('width')) || 0);
        const baseHeight = node.isParent()
            ? (Number(node.data('minCompoundHeight')) || Number(node.data('height')) || 0)
            : (Number(node.data('height')) || 0);

        return {
            width: Math.max(bounds.w, baseWidth),
            height: Math.max(bounds.h, baseHeight)
        };
    }

    function getStandaloneContactMapMoleculeLayoutSize(node) {
        const storedWidth = Number(node.data('layoutFootprintWidth')) || 0;
        const storedHeight = Number(node.data('layoutFootprintHeight')) || 0;

        if (storedWidth > 0 && storedHeight > 0) {
            return {
                width: storedWidth,
                height: storedHeight
            };
        }

        return getNodeLayoutSize(node);
    }

    function getContactMapPackingConfig(nodeKind, childCount) {
        switch (nodeKind) {
            case 'molecule':
                return {
                    gapX: 12,
                    gapY: 10,
                    targetAspect: childCount > 4 ? 1.2 : 1.4
                };
            case 'site':
                return {
                    gapX: 8,
                    gapY: 6,
                    targetAspect: childCount > 3 ? 1.25 : 1.6
                };
            default:
                return {
                    gapX: 14,
                    gapY: 10,
                    targetAspect: 1.4
                };
        }
    }

    function buildPackedPositions(items, config) {
        if (items.length === 0) {
            return [];
        }

        const maxItemWidth = items.reduce((maxWidth, item) => Math.max(maxWidth, item.width), 0);
        const estimatedArea = items.reduce((total, item) => {
            return total + ((item.width + config.gapX) * (item.height + config.gapY));
        }, 0);
        const targetRowWidth = Math.max(
            maxItemWidth,
            Math.sqrt(Math.max(estimatedArea, 1) * config.targetAspect)
        );
        const rows = [];
        let currentRow = [];
        let currentRowWidth = 0;
        let currentRowHeight = 0;

        items.forEach((item) => {
            const nextWidth = currentRow.length === 0
                ? item.width
                : currentRowWidth + config.gapX + item.width;

            if (currentRow.length > 0 && nextWidth > targetRowWidth) {
                rows.push({
                    items: currentRow,
                    width: currentRowWidth,
                    height: currentRowHeight
                });
                currentRow = [];
                currentRowWidth = 0;
                currentRowHeight = 0;
            }

            currentRow.push(item);
            currentRowWidth = currentRow.length === 1
                ? item.width
                : currentRowWidth + config.gapX + item.width;
            currentRowHeight = Math.max(currentRowHeight, item.height);
        });

        if (currentRow.length > 0) {
            rows.push({
                items: currentRow,
                width: currentRowWidth,
                height: currentRowHeight
            });
        }

        const totalHeight = rows.reduce((height, row, index) => {
            return height + row.height + (index > 0 ? config.gapY : 0);
        }, 0);
        let cursorY = -totalHeight / 2;
        const positions = [];

        rows.forEach((row) => {
            let cursorX = -row.width / 2;

            row.items.forEach((item) => {
                positions.push({
                    node: item.node,
                    x: cursorX + (item.width / 2),
                    y: cursorY + (row.height / 2)
                });
                cursorX += item.width + config.gapX;
            });

            cursorY += row.height + config.gapY;
        });

        return positions;
    }

    function packStandaloneContactMapChildren(parentNode) {
        if (!parentNode.isParent()) {
            return false;
        }

        const visibleChildren = parentNode.children(':visible').toArray().sort(compareNodeOrder);
        if (visibleChildren.length === 0) {
            return false;
        }

        const config = getContactMapPackingConfig(parentNode.data('nodeKind'), visibleChildren.length);
        const items = visibleChildren.map((childNode) => {
            const size = getNodeLayoutSize(childNode);
            return {
                node: childNode,
                width: size.width,
                height: size.height
            };
        });
        const positions = buildPackedPositions(items, config);
        let moved = false;

        positions.forEach((item) => {
            const currentPosition = item.node.position();
            if (Math.abs(currentPosition.x - item.x) > 0.5 || Math.abs(currentPosition.y - item.y) > 0.5) {
                item.node.position({
                    x: item.x,
                    y: item.y
                });
                moved = true;
            }
        });

        return moved;
    }

    function packStandaloneContactMapCompounds(cy) {
        if (!isStandaloneContactMapViewer()) {
            return false;
        }

        const topLevelMolecules = getTopLevelVisibleStandaloneContactMapMolecules(cy);
        const anchorPositions = new Map();
        topLevelMolecules.forEach((moleculeNode) => {
            anchorPositions.set(moleculeNode.id(), {
                x: moleculeNode.position('x'),
                y: moleculeNode.position('y')
            });
        });

        const compoundNodes = cy.nodes(':visible').filter((node) => node.isParent()).toArray().sort((left, right) => {
            const depthDifference = right.parents().length - left.parents().length;
            if (depthDifference !== 0) {
                return depthDifference;
            }

            return compareNodeOrder(left, right);
        });
        let moved = false;

        cy.batch(() => {
            compoundNodes.forEach((compoundNode) => {
                moved = packStandaloneContactMapChildren(compoundNode) || moved;
            });

            anchorPositions.forEach((anchorPosition, nodeId) => {
                const moleculeNode = cy.getElementById(nodeId);
                if (!moleculeNode || moleculeNode.length === 0 || !moleculeNode.visible()) {
                    return;
                }

                const currentPosition = moleculeNode.position();
                const deltaX = anchorPosition.x - currentPosition.x;
                const deltaY = anchorPosition.y - currentPosition.y;
                if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
                    moleculeNode.shift({
                        x: deltaX,
                        y: deltaY
                    });
                    moved = true;
                }
            });
        });

        return moved;
    }

    function getTopLevelVisibleStandaloneContactMapMolecules(cy) {
        return getTopLevelStandaloneContactMapMolecules(cy, { visibleOnly: true });
    }

    function storeStandaloneContactMapCanonicalGeometry(cy) {
        if (!isStandaloneContactMapViewer()) {
            return;
        }

        cy.batch(() => {
            cy.nodes().forEach((node) => {
                const topLevelMolecule = getTopLevelStandaloneContactMapMolecule(node);
                if (!topLevelMolecule) {
                    return;
                }

                const moleculePosition = topLevelMolecule.position();
                const nodePosition = node.position();
                node.data('canonicalOffsetX', nodePosition.x - moleculePosition.x);
                node.data('canonicalOffsetY', nodePosition.y - moleculePosition.y);
            });
        });
    }

    function restoreStandaloneContactMapCanonicalGeometry(cy) {
        if (!isStandaloneContactMapViewer()) {
            return;
        }

        const molecules = getTopLevelStandaloneContactMapMolecules(cy, { visibleOnly: false });
        if (molecules.length === 0) {
            return;
        }

        cy.batch(() => {
            molecules.forEach((moleculeNode) => {
                const moleculePosition = moleculeNode.position();
                const descendants = moleculeNode.descendants().toArray().sort((left, right) => {
                    const depthDifference = left.parents().length - right.parents().length;
                    if (depthDifference !== 0) {
                        return depthDifference;
                    }

                    return compareNodeOrder(left, right);
                });

                descendants.forEach((node) => {
                    const offsetX = Number(node.data('canonicalOffsetX'));
                    const offsetY = Number(node.data('canonicalOffsetY'));
                    if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
                        return;
                    }

                    node.position({
                        x: moleculePosition.x + offsetX,
                        y: moleculePosition.y + offsetY
                    });
                });
            });
        });
    }

    function updateStandaloneContactMapLayoutFootprints(cy) {
        if (!isStandaloneContactMapViewer()) {
            return;
        }

        cy.batch(() => {
            getTopLevelStandaloneContactMapMolecules(cy, { visibleOnly: false }).forEach((moleculeNode) => {
                const size = getNodeLayoutSize(moleculeNode);
                const minWidth = Number(moleculeNode.data('minCompoundWidth')) || 0;
                const minHeight = Number(moleculeNode.data('minCompoundHeight')) || 0;
                const baseWidth = Number(moleculeNode.data('width')) || 0;
                const baseHeight = Number(moleculeNode.data('height')) || 0;

                moleculeNode.data('layoutFootprintWidth', Math.max(size.width, minWidth, baseWidth));
                moleculeNode.data('layoutFootprintHeight', Math.max(size.height, minHeight, baseHeight));
            });
        });
    }

    function ensureStandaloneContactMapPrepared(cy) {
        if (!isStandaloneContactMapViewer()) {
            return;
        }

        const scratch = getStandaloneContactMapLayoutScratch(cy);
        if (scratch.prepared) {
            return;
        }

        cy.resize();
        packStandaloneContactMapCompounds(cy);
        storeStandaloneContactMapCanonicalGeometry(cy);
        updateStandaloneContactMapLayoutFootprints(cy);
        scratch.prepared = true;
    }

    function getExpandedBoundingBox(node, padding, options = {}) {
        const useStoredFootprint = options.useStoredFootprint === true;
        if (useStoredFootprint) {
            const position = node.position();
            const size = getStandaloneContactMapMoleculeLayoutSize(node);

            return {
                x1: position.x - (size.width / 2) - padding,
                y1: position.y - (size.height / 2) - padding,
                x2: position.x + (size.width / 2) + padding,
                y2: position.y + (size.height / 2) + padding
            };
        }

        const bounds = node.boundingBox({
            includeLabels: true,
            includeOverlays: false
        });

        return {
            x1: bounds.x1 - padding,
            y1: bounds.y1 - padding,
            x2: bounds.x2 + padding,
            y2: bounds.y2 + padding
        };
    }

    function resolveStandaloneContactMapOverlaps(cy, options = {}) {
        if (!isStandaloneContactMapViewer()) {
            return false;
        }

        const molecules = getTopLevelVisibleStandaloneContactMapMolecules(cy);
        if (molecules.length < 2) {
            return false;
        }

        const useStoredFootprint = options.useStoredFootprint === true;
        const padding = currentGraphLayoutName === 'cose' ? 18 : 14;
        const maxPasses = 16;
        let moved = false;

        cy.batch(() => {
            for (let pass = 0; pass < maxPasses; pass += 1) {
                let passMoved = false;

                molecules.sort((left, right) => {
                    const leftPosition = left.position();
                    const rightPosition = right.position();

                    if (leftPosition.y !== rightPosition.y) {
                        return leftPosition.y - rightPosition.y;
                    }

                    if (leftPosition.x !== rightPosition.x) {
                        return leftPosition.x - rightPosition.x;
                    }

                    return left.id().localeCompare(right.id());
                });

                for (let i = 0; i < molecules.length; i += 1) {
                    for (let j = i + 1; j < molecules.length; j += 1) {
                        const left = molecules[i];
                        const right = molecules[j];
                        const leftBounds = getExpandedBoundingBox(left, padding, { useStoredFootprint: useStoredFootprint });
                        const rightBounds = getExpandedBoundingBox(right, padding, { useStoredFootprint: useStoredFootprint });
                        const overlapX = Math.min(leftBounds.x2, rightBounds.x2) - Math.max(leftBounds.x1, rightBounds.x1);
                        const overlapY = Math.min(leftBounds.y2, rightBounds.y2) - Math.max(leftBounds.y1, rightBounds.y1);

                        if (overlapX <= 0 || overlapY <= 0) {
                            continue;
                        }

                        const leftPosition = left.position();
                        const rightPosition = right.position();
                        let deltaLeft = { x: 0, y: 0 };
                        let deltaRight = { x: 0, y: 0 };

                        if (overlapX < overlapY) {
                            const direction = leftPosition.x === rightPosition.x
                                ? (left.id().localeCompare(right.id()) <= 0 ? -1 : 1)
                                : (leftPosition.x < rightPosition.x ? -1 : 1);
                            const shift = (overlapX / 2) + 2;
                            deltaLeft.x = direction * shift;
                            deltaRight.x = -direction * shift;
                        } else {
                            const direction = leftPosition.y === rightPosition.y
                                ? (left.id().localeCompare(right.id()) <= 0 ? -1 : 1)
                                : (leftPosition.y < rightPosition.y ? -1 : 1);
                            const shift = (overlapY / 2) + 2;
                            deltaLeft.y = direction * shift;
                            deltaRight.y = -direction * shift;
                        }

                        left.shift(deltaLeft);
                        right.shift(deltaRight);
                        passMoved = true;
                        moved = true;
                    }
                }

                if (!passMoved) {
                    break;
                }
            }
        });

        return moved;
    }

    function getStandaloneContactMapLayoutCenter(moleculeNodes) {
        if (!moleculeNodes || moleculeNodes.length === 0) {
            return { x: 0, y: 0 };
        }

        const center = moleculeNodes.reduce((accumulator, node) => {
            return {
                x: accumulator.x + node.position('x'),
                y: accumulator.y + node.position('y')
            };
        }, { x: 0, y: 0 });

        center.x /= moleculeNodes.length;
        center.y /= moleculeNodes.length;
        return center;
    }

    function getStandaloneContactMapRelativeLayoutBounds(positionsById, sizeById) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        positionsById.forEach((position, nodeId) => {
            const size = sizeById.get(nodeId);
            const width = size ? size.width : 0;
            const height = size ? size.height : 0;
            minX = Math.min(minX, position.x - (width / 2));
            maxX = Math.max(maxX, position.x + (width / 2));
            minY = Math.min(minY, position.y - (height / 2));
            maxY = Math.max(maxY, position.y + (height / 2));
        });

        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
            return {
                minX: 0,
                maxX: 0,
                minY: 0,
                maxY: 0,
                width: 0,
                height: 0,
                centerX: 0,
                centerY: 0
            };
        }

        return {
            minX: minX,
            maxX: maxX,
            minY: minY,
            maxY: maxY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }

    function centerStandaloneContactMapRelativePositions(positionsById, sizeById) {
        const bounds = getStandaloneContactMapRelativeLayoutBounds(positionsById, sizeById);
        const centeredPositions = new Map();

        positionsById.forEach((position, nodeId) => {
            centeredPositions.set(nodeId, {
                x: position.x - bounds.centerX,
                y: position.y - bounds.centerY
            });
        });

        return {
            positionsById: centeredPositions,
            width: bounds.width,
            height: bounds.height
        };
    }

    function buildStandaloneContactMapGridPositions(cy) {
        const moleculeNodes = getTopLevelStandaloneContactMapMolecules(cy, { visibleOnly: false }).sort(compareNodeOrder);
        const positionsById = new Map();

        if (moleculeNodes.length === 0) {
            return positionsById;
        }

        const center = getStandaloneContactMapLayoutCenter(moleculeNodes);
        const sizeById = new Map();
        moleculeNodes.forEach((node) => {
            sizeById.set(node.id(), getStandaloneContactMapMoleculeLayoutSize(node));
        });

        const gapX = 58;
        const gapY = 56;
        const targetAspect = 1.45;
        let bestCandidate = null;

        for (let columnCount = 1; columnCount <= moleculeNodes.length; columnCount += 1) {
            const rowCount = Math.ceil(moleculeNodes.length / columnCount);
            const columnWidths = Array.from({ length: columnCount }, () => 0);
            const rowHeights = Array.from({ length: rowCount }, () => 0);

            moleculeNodes.forEach((node, index) => {
                const size = sizeById.get(node.id());
                const rowIndex = Math.floor(index / columnCount);
                const columnIndex = index % columnCount;
                columnWidths[columnIndex] = Math.max(columnWidths[columnIndex], size.width);
                rowHeights[rowIndex] = Math.max(rowHeights[rowIndex], size.height);
            });

            const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0) + (Math.max(columnCount - 1, 0) * gapX);
            const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0) + (Math.max(rowCount - 1, 0) * gapY);
            const aspect = totalWidth / Math.max(totalHeight, 1);
            const score = (totalWidth * totalHeight) * (1 + Math.abs(Math.log(aspect / targetAspect)));

            if (bestCandidate && score >= bestCandidate.score) {
                continue;
            }

            const candidatePositions = new Map();
            let rowStartY = -totalHeight / 2;
            for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
                const rowHeight = rowHeights[rowIndex];
                let columnStartX = -totalWidth / 2;

                for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
                    const nodeIndex = (rowIndex * columnCount) + columnIndex;
                    if (nodeIndex >= moleculeNodes.length) {
                        break;
                    }

                    const node = moleculeNodes[nodeIndex];
                    const columnWidth = columnWidths[columnIndex];
                    candidatePositions.set(node.id(), {
                        x: columnStartX + (columnWidth / 2),
                        y: rowStartY + (rowHeight / 2)
                    });
                    columnStartX += columnWidth + gapX;
                }

                rowStartY += rowHeight + gapY;
            }

            bestCandidate = {
                score: score,
                positionsById: candidatePositions
            };
        }

        if (!bestCandidate) {
            return positionsById;
        }

        bestCandidate.positionsById.forEach((position, nodeId) => {
            positionsById.set(nodeId, {
                x: center.x + position.x,
                y: center.y + position.y
            });
        });

        return positionsById;
    }

    function buildStandaloneContactMapCirclePositions(cy) {
        const moleculeNodes = getTopLevelStandaloneContactMapMolecules(cy, { visibleOnly: false }).sort(compareNodeOrder);
        const positionsById = new Map();

        if (moleculeNodes.length === 0) {
            return positionsById;
        }

        const center = getStandaloneContactMapLayoutCenter(moleculeNodes);

        if (moleculeNodes.length === 1) {
            positionsById.set(moleculeNodes[0].id(), center);
            return positionsById;
        }

        const gap = 42;
        const footprintSizes = moleculeNodes.map((node) => getStandaloneContactMapMoleculeLayoutSize(node));
        const totalArcLength = footprintSizes.reduce((sum, size) => {
            return sum + Math.max(size.width, size.height) + gap;
        }, 0);
        const maxDimension = footprintSizes.reduce((maximum, size) => {
            return Math.max(maximum, size.width, size.height);
        }, 0);
        const radius = Math.max(
            totalArcLength / (2 * Math.PI),
            maxDimension * 1.15,
            120
        );
        const startAngle = -Math.PI / 2;

        moleculeNodes.forEach((node, index) => {
            const angle = startAngle + ((2 * Math.PI * index) / moleculeNodes.length);
            positionsById.set(node.id(), {
                x: center.x + (Math.cos(angle) * radius),
                y: center.y + (Math.sin(angle) * radius)
            });
        });

        return positionsById;
    }

    function buildStandaloneContactMapConcentricPositions(cy) {
        const moleculeNodes = getTopLevelStandaloneContactMapMolecules(cy, { visibleOnly: false }).sort(compareNodeOrder);
        const positionsById = new Map();

        if (moleculeNodes.length === 0) {
            return positionsById;
        }

        const center = getStandaloneContactMapLayoutCenter(moleculeNodes);

        if (moleculeNodes.length === 1) {
            positionsById.set(moleculeNodes[0].id(), center);
            return positionsById;
        }

        const tempElements = getStandaloneContactMapMoleculeLayoutElements(cy);
        const degreeById = new Map();
        tempElements.nodes.forEach((node) => {
            degreeById.set(node.data.id, 0);
        });
        tempElements.edges.forEach((edge) => {
            degreeById.set(edge.data.source, (degreeById.get(edge.data.source) || 0) + 1);
            degreeById.set(edge.data.target, (degreeById.get(edge.data.target) || 0) + 1);
        });

        const groupsByDegree = new Map();
        moleculeNodes.forEach((node) => {
            const degree = degreeById.get(node.id()) || 0;
            if (!groupsByDegree.has(degree)) {
                groupsByDegree.set(degree, []);
            }

            groupsByDegree.get(degree).push(node);
        });

        const degrees = Array.from(groupsByDegree.keys()).sort((left, right) => right - left);
        let previousRingRadius = 0;
        let previousRingMaxDimension = 0;
        const gap = 42;

        degrees.forEach((degree, groupIndex) => {
            const groupNodes = groupsByDegree.get(degree).sort(compareNodeOrder);
            const groupSizes = groupNodes.map((node) => getStandaloneContactMapMoleculeLayoutSize(node));
            const groupMaxDimension = groupSizes.reduce((maximum, size) => {
                return Math.max(maximum, size.width, size.height);
            }, 0);

            if (groupIndex === 0 && groupNodes.length === 1) {
                positionsById.set(groupNodes[0].id(), center);
                previousRingMaxDimension = groupMaxDimension;
                return;
            }

            const groupArcLength = groupSizes.reduce((sum, size) => {
                return sum + Math.max(size.width, size.height) + gap;
            }, 0);
            const minimumRadius = groupIndex === 0
                ? Math.max(groupMaxDimension * 1.15, 110)
                : previousRingRadius + (previousRingMaxDimension / 2) + (groupMaxDimension / 2) + 56;
            const radius = Math.max(
                groupArcLength / (2 * Math.PI),
                minimumRadius
            );
            const startAngle = (-Math.PI / 2) + (groupIndex % 2 === 0 ? 0 : (Math.PI / Math.max(groupNodes.length, 2)));

            groupNodes.forEach((node, index) => {
                const angle = startAngle + ((2 * Math.PI * index) / groupNodes.length);
                positionsById.set(node.id(), {
                    x: center.x + (Math.cos(angle) * radius),
                    y: center.y + (Math.sin(angle) * radius)
                });
            });

            previousRingRadius = radius;
            previousRingMaxDimension = groupMaxDimension;
        });

        return positionsById;
    }

    function buildStandaloneContactMapBreadthfirstPositions(cy) {
        const moleculeNodes = getTopLevelStandaloneContactMapMolecules(cy, { visibleOnly: false }).sort(compareNodeOrder);
        const positionsById = new Map();

        if (moleculeNodes.length === 0) {
            return positionsById;
        }

        const tempElements = getStandaloneContactMapMoleculeLayoutElements(cy);
        if (tempElements.edges.length === 0) {
            return buildStandaloneContactMapGridPositions(cy);
        }

        const center = getStandaloneContactMapLayoutCenter(moleculeNodes);
        const nodeById = new Map();
        const sizeById = new Map();
        const adjacencyById = new Map();

        moleculeNodes.forEach((node) => {
            nodeById.set(node.id(), node);
            sizeById.set(node.id(), getStandaloneContactMapMoleculeLayoutSize(node));
            adjacencyById.set(node.id(), new Set());
        });

        tempElements.edges.forEach((edge) => {
            adjacencyById.get(edge.data.source).add(edge.data.target);
            adjacencyById.get(edge.data.target).add(edge.data.source);
        });

        const degreeById = new Map();
        moleculeNodes.forEach((node) => {
            degreeById.set(node.id(), adjacencyById.get(node.id()).size);
        });

        const preferredRoots = moleculeNodes.slice().sort((left, right) => {
            const degreeDifference = (degreeById.get(right.id()) || 0) - (degreeById.get(left.id()) || 0);
            if (degreeDifference !== 0) {
                return degreeDifference;
            }

            return compareNodeOrder(left, right);
        });

        const visitedIds = new Set();
        const componentLayouts = [];
        const layerGapX = 80;
        const nodeGapY = 44;
        const componentGapX = 120;

        preferredRoots.forEach((rootNode) => {
            if (visitedIds.has(rootNode.id())) {
                return;
            }

            const queue = [rootNode.id()];
            const depthById = new Map([[rootNode.id(), 0]]);
            const componentNodeIds = [];
            visitedIds.add(rootNode.id());

            while (queue.length !== 0) {
                const currentId = queue.shift();
                componentNodeIds.push(currentId);

                const neighborIds = Array.from(adjacencyById.get(currentId)).sort((leftId, rightId) => {
                    const degreeDifference = (degreeById.get(rightId) || 0) - (degreeById.get(leftId) || 0);
                    if (degreeDifference !== 0) {
                        return degreeDifference;
                    }

                    return compareNodeOrder(nodeById.get(leftId), nodeById.get(rightId));
                });

                neighborIds.forEach((neighborId) => {
                    if (visitedIds.has(neighborId)) {
                        return;
                    }

                    visitedIds.add(neighborId);
                    depthById.set(neighborId, (depthById.get(currentId) || 0) + 1);
                    queue.push(neighborId);
                });
            }

            const layers = new Map();
            componentNodeIds.forEach((nodeId) => {
                const depth = depthById.get(nodeId) || 0;
                if (!layers.has(depth)) {
                    layers.set(depth, []);
                }

                layers.get(depth).push(nodeId);
            });

            const layerDepths = Array.from(layers.keys()).sort((left, right) => left - right);
            const layerWidths = layerDepths.map((depth) => {
                return layers.get(depth).reduce((maximum, nodeId) => {
                    return Math.max(maximum, sizeById.get(nodeId).width);
                }, 0);
            });
            const relativePositions = new Map();
            let layerStartX = 0;

            layerDepths.forEach((depth, layerIndex) => {
                const layerNodeIds = layers.get(depth).slice().sort((leftId, rightId) => {
                    const leftDegree = degreeById.get(leftId) || 0;
                    const rightDegree = degreeById.get(rightId) || 0;
                    if (leftDegree !== rightDegree) {
                        return rightDegree - leftDegree;
                    }

                    return compareNodeOrder(nodeById.get(leftId), nodeById.get(rightId));
                });
                const layerWidth = layerWidths[layerIndex];
                const stackHeight = layerNodeIds.reduce((sum, nodeId) => {
                    return sum + sizeById.get(nodeId).height;
                }, 0) + (Math.max(layerNodeIds.length - 1, 0) * nodeGapY);
                let nodeStartY = -stackHeight / 2;

                layerNodeIds.forEach((nodeId) => {
                    const nodeSize = sizeById.get(nodeId);
                    relativePositions.set(nodeId, {
                        x: layerStartX + (layerWidth / 2),
                        y: nodeStartY + (nodeSize.height / 2)
                    });
                    nodeStartY += nodeSize.height + nodeGapY;
                });

                layerStartX += layerWidth + layerGapX;
            });

            const centeredComponent = centerStandaloneContactMapRelativePositions(relativePositions, sizeById);
            componentLayouts.push(centeredComponent);
        });

        const totalWidth = componentLayouts.reduce((sum, componentLayout) => {
            return sum + componentLayout.width;
        }, 0) + (Math.max(componentLayouts.length - 1, 0) * componentGapX);
        let componentStartX = -totalWidth / 2;

        componentLayouts.forEach((componentLayout) => {
            const componentCenterX = componentStartX + (componentLayout.width / 2);
            componentLayout.positionsById.forEach((position, nodeId) => {
                positionsById.set(nodeId, {
                    x: center.x + componentCenterX + position.x,
                    y: center.y + position.y
                });
            });
            componentStartX += componentLayout.width + componentGapX;
        });

        return positionsById;
    }

    function getStandaloneContactMapMoleculeLayoutElements(cy) {
        const moleculeNodes = getTopLevelStandaloneContactMapMolecules(cy, { visibleOnly: false }).sort(compareNodeOrder);
        const seenEdgeKeys = new Set();

        return {
            nodes: moleculeNodes.map((moleculeNode) => {
                const size = getStandaloneContactMapMoleculeLayoutSize(moleculeNode);
                return {
                    data: {
                        id: moleculeNode.id(),
                        width: size.width,
                        height: size.height
                    },
                    position: {
                        x: moleculeNode.position('x'),
                        y: moleculeNode.position('y')
                    }
                };
            }),
            edges: cy.edges().filter((edge) => !edge.data('isPromotedEdge')).toArray().reduce((layoutEdges, edge, index) => {
                const sourceMolecule = getTopLevelStandaloneContactMapMolecule(edge.source());
                const targetMolecule = getTopLevelStandaloneContactMapMolecule(edge.target());
                if (!sourceMolecule || !targetMolecule) {
                    return layoutEdges;
                }

                const sourceId = sourceMolecule.id();
                const targetId = targetMolecule.id();
                if (!sourceId || !targetId || sourceId === targetId) {
                    return layoutEdges;
                }

                const edgeKey = [sourceId, targetId].sort().join('::');
                if (seenEdgeKeys.has(edgeKey)) {
                    return layoutEdges;
                }

                seenEdgeKeys.add(edgeKey);
                layoutEdges.push({
                    data: {
                        id: `standalone-layout-edge-${index}`,
                        source: sourceId,
                        target: targetId
                    }
                });

                return layoutEdges;
            }, [])
        };
    }

    function createStandaloneContactMapMoleculeLayoutOptions(layoutName) {
        switch (layoutName) {
            case 'grid':
                return {
                    name: 'grid',
                    fit: false,
                    avoidOverlap: true,
                    avoidOverlapPadding: 28,
                    nodeDimensionsIncludeLabels: true,
                    animate: false
                };
            case 'circle':
                return {
                    name: 'circle',
                    fit: false,
                    avoidOverlap: true,
                    spacingFactor: 1.1,
                    nodeDimensionsIncludeLabels: true,
                    animate: false
                };
            case 'concentric':
                return {
                    name: 'concentric',
                    fit: false,
                    avoidOverlap: true,
                    minNodeSpacing: 42,
                    spacingFactor: 1.08,
                    nodeDimensionsIncludeLabels: true,
                    animate: false
                };
            case 'breadthfirst':
                return {
                    name: 'breadthfirst',
                    fit: false,
                    directed: false,
                    avoidOverlap: true,
                    spacingFactor: 1.18,
                    nodeDimensionsIncludeLabels: true,
                    animate: false
                };
            case 'cose':
            default:
                return {
                    name: 'cose',
                    fit: false,
                    animate: false,
                    randomize: false,
                    nodeDimensionsIncludeLabels: true,
                    componentSpacing: 96,
                    nodeOverlap: 24,
                    idealEdgeLength: 150,
                    edgeElasticity: 90,
                    gravity: 0.75,
                    numIter: 1800,
                    initialTemp: 140,
                    coolingFactor: 0.95,
                    minTemp: 1,
                    nodeRepulsion: function (node) {
                        const width = Number(node.data('width')) || 120;
                        const height = Number(node.data('height')) || 72;
                        return Math.max(9000, width * height * 16);
                    }
                };
        }
    }

    function applyStandaloneContactMapMoleculePositions(cy, positionsById) {
        const molecules = getTopLevelStandaloneContactMapMolecules(cy, { visibleOnly: false });
        if (molecules.length === 0) {
            return;
        }

        cy.batch(() => {
            molecules.forEach((moleculeNode) => {
                const nextPosition = positionsById.get(moleculeNode.id());
                if (!nextPosition) {
                    return;
                }

                const currentPosition = moleculeNode.position();
                const deltaX = nextPosition.x - currentPosition.x;
                const deltaY = nextPosition.y - currentPosition.y;
                if (Math.abs(deltaX) <= 0.5 && Math.abs(deltaY) <= 0.5) {
                    return;
                }

                moleculeNode.shift({
                    x: deltaX,
                    y: deltaY
                });
            });
        });
    }

    function applyStandaloneContactMapLayout(cy, layoutName, options = {}) {
        if (!isStandaloneContactMapViewer()) {
            if (options.fitViewport !== false && typeof options.onFit === 'function') {
                options.onFit({
                    animate: options.animateFit !== false
                });
            }

            return;
        }

        ensureStandaloneContactMapPrepared(cy);
        cy.resize();
        const topLevelMolecules = getTopLevelStandaloneContactMapMolecules(cy, { visibleOnly: false });
        if (topLevelMolecules.length === 0) {
            if (options.fitViewport !== false && typeof options.onFit === 'function') {
                options.onFit({
                    animate: options.animateFit !== false
                });
            }

            return;
        }

        if (layoutName === 'preset') {
            cy.batch(() => {
                topLevelMolecules.forEach((moleculeNode) => {
                    const specifiedPosition = moleculeNode.data('specifiedPosition');
                    if (!specifiedPosition) {
                        return;
                    }

                    const deltaX = specifiedPosition.x - moleculeNode.position('x');
                    const deltaY = specifiedPosition.y - moleculeNode.position('y');
                    if (Math.abs(deltaX) <= 0.5 && Math.abs(deltaY) <= 0.5) {
                        return;
                    }

                    moleculeNode.shift({
                        x: deltaX,
                        y: deltaY
                    });
                });
            });

            restoreStandaloneContactMapCanonicalGeometry(cy);
            resolveStandaloneContactMapOverlaps(cy, { useStoredFootprint: true });

            if (options.fitViewport !== false && typeof options.onFit === 'function') {
                options.onFit({
                    animate: options.animateFit !== false
                });
            }

            return;
        }

        if (layoutName === 'grid') {
            applyStandaloneContactMapMoleculePositions(cy, buildStandaloneContactMapGridPositions(cy));
            restoreStandaloneContactMapCanonicalGeometry(cy);
            resolveStandaloneContactMapOverlaps(cy, { useStoredFootprint: true });

            if (options.fitViewport !== false && typeof options.onFit === 'function') {
                options.onFit({
                    animate: options.animateFit !== false
                });
            }

            return;
        }

        if (layoutName === 'breadthfirst') {
            applyStandaloneContactMapMoleculePositions(cy, buildStandaloneContactMapBreadthfirstPositions(cy));
            restoreStandaloneContactMapCanonicalGeometry(cy);
            resolveStandaloneContactMapOverlaps(cy, { useStoredFootprint: true });

            if (options.fitViewport !== false && typeof options.onFit === 'function') {
                options.onFit({
                    animate: options.animateFit !== false
                });
            }

            return;
        }

        if (layoutName === 'circle') {
            applyStandaloneContactMapMoleculePositions(cy, buildStandaloneContactMapCirclePositions(cy));
            restoreStandaloneContactMapCanonicalGeometry(cy);
            resolveStandaloneContactMapOverlaps(cy, { useStoredFootprint: true });

            if (options.fitViewport !== false && typeof options.onFit === 'function') {
                options.onFit({
                    animate: options.animateFit !== false
                });
            }

            return;
        }

        if (layoutName === 'concentric') {
            applyStandaloneContactMapMoleculePositions(cy, buildStandaloneContactMapConcentricPositions(cy));
            restoreStandaloneContactMapCanonicalGeometry(cy);
            resolveStandaloneContactMapOverlaps(cy, { useStoredFootprint: true });

            if (options.fitViewport !== false && typeof options.onFit === 'function') {
                options.onFit({
                    animate: options.animateFit !== false
                });
            }

            return;
        }

        const tempElements = getStandaloneContactMapMoleculeLayoutElements(cy);
        const effectiveLayoutName = tempElements.edges.length === 0
            && (layoutName === 'breadthfirst' || layoutName === 'cose')
            ? 'grid'
            : layoutName;
        const tempCy = cytoscape({
            headless: true,
            elements: tempElements,
            style: [
                {
                    selector: 'node',
                    style: {
                        'width': 'data(width)',
                        'height': 'data(height)',
                        'shape': 'round-rectangle'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'curve-style': 'bezier'
                    }
                }
            ],
            layout: {
                name: 'preset',
                fit: false
            }
        });

        tempCy.layout(createStandaloneContactMapMoleculeLayoutOptions(effectiveLayoutName)).run();
        const positionsById = new Map();
        tempCy.nodes().forEach((node) => {
            positionsById.set(node.id(), {
                x: node.position('x'),
                y: node.position('y')
            });
        });
        tempCy.destroy();

        applyStandaloneContactMapMoleculePositions(cy, positionsById);
        restoreStandaloneContactMapCanonicalGeometry(cy);
        resolveStandaloneContactMapOverlaps(cy, { useStoredFootprint: true });

        if (options.fitViewport !== false && typeof options.onFit === 'function') {
            options.onFit({
                animate: options.animateFit !== false
            });
        }
    }

    function updateViewModeButton() {
        if (!viewModeButton) {
            return;
        }

        const buttonLabel = currentViewMode === VIEW_MODE_DARK ? 'Day View' : 'Night View';
        viewModeButton.textContent = buttonLabel;
        viewModeButton.setAttribute('aria-label', buttonLabel);
    }

    function applyBodyViewMode() {
        const useOverridePalette = currentViewMode !== hostViewMode;
        document.body.dataset.currentViewMode = currentViewMode;

        if (useOverridePalette) {
            document.body.dataset.viewMode = currentViewMode;
        } else {
            delete document.body.dataset.viewMode;
        }
    }

    function setViewMode(mode, persist) {
        currentViewMode = mode === VIEW_MODE_LIGHT ? VIEW_MODE_LIGHT : VIEW_MODE_DARK;
        applyBodyViewMode();
        updateViewModeButton();

        if (persist) {
            persistViewMode(currentViewMode);
        }

        applyPlotTheme();
        applyGraphTheme();
    }

    if (viewModeButton) {
        viewModeButton.onclick = function () {
            setViewMode(currentViewMode === VIEW_MODE_DARK ? VIEW_MODE_LIGHT : VIEW_MODE_DARK, true);
        };
    }

    if (plotViewPlotButton) {
        plotViewPlotButton.onclick = function () {
            setPlotViewerMode('plot');
        };
    }

    if (plotViewDataButton) {
        plotViewDataButton.onclick = function () {
            setPlotViewerMode('data');
        };
    }

    setViewMode(currentViewMode, false);

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.command) {
            case 'plot':
                current_plot_data = [];
                currentPlotTableNames = Array.isArray(message.names) ? message.names.slice() : [];
                currentPlotTableColumns = Array.isArray(message.data)
                    ? message.data.map((column) => Array.isArray(column) ? column.slice() : [])
                    : [];
                plotDataTableRendered = false;
                if (plotDataTable) {
                    plotDataTable.innerHTML = '';
                }
                if (plotDataEmpty) {
                    plotDataEmpty.hidden = true;
                }
                updatePlotSourceSummary(currentPlotTableNames, currentPlotTableColumns);
                setPlotViewerMode('plot');

                const varList = document.getElementById('var-list');
                varList.innerHTML = '';

                for (let i = 0; i < message.names.length; i++) {
                    // names[0] is the x-axis label (e.g. "time"), data series start at index 1
                    if (i === 0) continue;

                    let seriesIndex = i - 1;
                    let color = plotSeriesColors[seriesIndex % plotSeriesColorCount];

                    let is_visible = seriesIndex < message.max_series;

                    let this_data = {
                        x: message.data[0],
                        y: message.data[i],
                        name: message.names[i],
                        visible: is_visible,
                        line: { color: color }
                    };
                    current_plot_data.push(this_data);

                    // Add to sidebar
                    const item = document.createElement('div');
                    item.className = 'var-item';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `var-${i}`;
                    checkbox.checked = is_visible;

                    const swatch = document.createElement('span');
                    swatch.style.color = color;
                    swatch.style.fontWeight = 'bold';
                    swatch.textContent = '—';

                    const label = document.createElement('label');
                    label.htmlFor = `var-${i}`;
                    // observable names come from the data file header (untrusted); use textContent, not innerHTML
                    label.textContent = message.names[i];

                    item.appendChild(checkbox);
                    item.appendChild(swatch);
                    item.appendChild(label);
                    item.onclick = (e) => {
                        if (e.target.tagName !== 'INPUT') {
                            const cb = item.querySelector('input');
                            cb.checked = !cb.checked;
                            updateVisibility(seriesIndex, cb.checked);
                        }
                    };
                    item.querySelector('input').onchange = (e) => {
                        updateVisibility(seriesIndex, e.target.checked);
                    };
                    varList.appendChild(item);
                }

                function updateVisibility(index, visible) {
                    current_plot_data[index].visible = visible;
                    Plotly.restyle('plot', { visible: visible }, [index]);
                }

                // Sidebar Filter
                document.getElementById('var-filter').oninput = (e) => {
                    const filter = e.target.value.toLowerCase();
                    document.querySelectorAll('.var-item').forEach(item => {
                        const label = item.querySelector('label').innerText.toLowerCase();
                        item.style.display = label.includes(filter) ? 'flex' : 'none';
                    });
                };

                // Show All / None
                document.getElementById('show-all').onclick = () => {
                    const indices = current_plot_data.map((_, i) => i);
                    Plotly.restyle('plot', { visible: true }, indices);
                    document.querySelectorAll('.var-item input').forEach(cb => cb.checked = true);
                };
                document.getElementById('show-none').onclick = () => {
                    const indices = current_plot_data.map((_, i) => i);
                    Plotly.restyle('plot', { visible: false }, indices);
                    document.querySelectorAll('.var-item input').forEach(cb => cb.checked = false);
                };

                // Axis scale controls
                function setAxisType(axis, type) {
                    let update = {};
                    update[axis + '.type'] = type;
                    Plotly.relayout('plot', update);
                }

                document.getElementById('xaxis-linear').onclick = function() {
                    setAxisType('xaxis', 'linear');
                    document.getElementById('xaxis-linear').classList.add('active');
                    document.getElementById('xaxis-log').classList.remove('active');
                };
                document.getElementById('xaxis-log').onclick = function() {
                    setAxisType('xaxis', 'log');
                    document.getElementById('xaxis-log').classList.add('active');
                    document.getElementById('xaxis-linear').classList.remove('active');
                };
                document.getElementById('yaxis-linear').onclick = function() {
                    setAxisType('yaxis', 'linear');
                    document.getElementById('yaxis-linear').classList.add('active');
                    document.getElementById('yaxis-log').classList.remove('active');
                };
                document.getElementById('yaxis-log').onclick = function() {
                    setAxisType('yaxis', 'log');
                    document.getElementById('yaxis-log').classList.add('active');
                    document.getElementById('yaxis-linear').classList.remove('active');
                };

                // Legend toggle
                document.getElementById('legend-on').onclick = function() {
                    Plotly.relayout('plot', { showlegend: true });
                    this.classList.add('active');
                    document.getElementById('legend-off').classList.remove('active');
                };
                document.getElementById('legend-off').onclick = function() {
                    Plotly.relayout('plot', { showlegend: false });
                    this.classList.add('active');
                    document.getElementById('legend-on').classList.remove('active');
                };

                // Line style controls
                document.getElementById('style-lines').onclick = function() {
                    Plotly.restyle('plot', { mode: 'lines' });
                    document.querySelectorAll('.control-group:last-child .control-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                };
                document.getElementById('style-markers').onclick = function() {
                    Plotly.restyle('plot', { mode: 'markers' });
                    document.querySelectorAll('.control-group:last-child .control-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                };
                document.getElementById('style-both').onclick = function() {
                    Plotly.restyle('plot', { mode: 'lines+markers' });
                    document.querySelectorAll('.control-group:last-child .control-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                };

                // Export buttons
                document.getElementById('export-png').onclick = () => exportImage('png');
                document.getElementById('export-svg').onclick = () => exportImage('svg');

                function getPlotExportSize(gd) {
                    const rect = gd.getBoundingClientRect();
                    const layout = gd._fullLayout || {};

                    return {
                        width: Math.max(1, Math.round(layout.width || rect.width || 1200)),
                        height: Math.max(1, Math.round(layout.height || rect.height || 800))
                    };
                }

                function exportImage(format) {
                    const gd = plotElement;
                    const size = getPlotExportSize(gd);
                    const exportOptions = {
                        format: format,
                        width: size.width,
                        height: size.height
                    };

                    if (format === 'png') {
                        exportOptions.scale = plotPngExportScale;
                    }

                    Plotly.toImage(gd, {
                        ...exportOptions
                    }).then(url => {
                        vscode.postMessage({
                            command: 'image',
                            type: format,
                            title: page_title,
                            folder: page_folder,
                            text: url
                        });
                    });
                }

                const plotTheme = getPlotTheme();
                let plot_options = {
                    showlegend: message.legend,
                    hovermode: 'closest',
                    margin: { t: 30, r: 30, b: 50, l: 60 },
                    autosize: true,
                    paper_bgcolor: plotTheme.paperBackground,
                    plot_bgcolor: plotTheme.plotBackground,
                    font: {
                        color: plotTheme.foreground
                    },
                    xaxis: {
                        title: {
                            text: message.names[0],
                            font: {
                                color: plotTheme.foreground
                            }
                        },
                        color: plotTheme.foreground,
                        gridcolor: plotTheme.grid,
                        zerolinecolor: plotTheme.zeroLine
                    },
                    yaxis: {
                        title: {
                            text: 'Concentration',
                            font: {
                                color: plotTheme.foreground
                            }
                        },
                        color: plotTheme.foreground,
                        gridcolor: plotTheme.grid,
                        zerolinecolor: plotTheme.zeroLine
                    },
                    legend: {
                        orientation: 'h',
                        y: -0.2,
                        bgcolor: plotTheme.legendBackground,
                        bordercolor: plotTheme.border,
                        borderwidth: 1,
                        font: {
                            color: plotTheme.foreground
                        }
                    }
                };

                let config = {
                    responsive: true,
                    displaylogo: false,
                    modeBarButtonsToRemove: ['toImage'],
                    modeBarButtonsToAdd: ['select2d', 'lasso2d']
                };

                plotReady = false;
                Plotly.newPlot('plot', current_plot_data, plot_options, config).then(() => {
                    plotReady = true;
                    applyPlotTheme();
                });

                // Lasso/box selection to filter visible series
                if (!plotElement.dataset.selectionHandlerBound) {
                    plotElement.on('plotly_selected', function(eventData) {
                        if (!eventData || !eventData.points || eventData.points.length === 0) {
                            // Empty selection — restore all series to their checkbox state
                            const checkboxes = document.querySelectorAll('.var-item input');
                            checkboxes.forEach((cb, idx) => {
                                current_plot_data[idx].visible = cb.checked;
                            });
                            Plotly.restyle('plot', { visible: current_plot_data.map(d => d.visible) });
                            return;
                        }
                        // Find which series have points in the selection
                        const selectedTraces = new Set(eventData.points.map(p => p.curveNumber));
                        current_plot_data.forEach((trace, idx) => {
                            trace.visible = selectedTraces.has(idx);
                        });
                        Plotly.restyle('plot', { visible: current_plot_data.map(d => d.visible) });
                        // Sync sidebar checkboxes
                        document.querySelectorAll('.var-item input').forEach((cb, idx) => {
                            cb.checked = current_plot_data[idx].visible;
                        });
                    });
                    plotElement.dataset.selectionHandlerBound = 'true';
                }

                break;
            case 'ruleviz-browser':
                const persistedRulevizBrowserViewState = resolveInitialGraphViewState();
                graphKind = typeof message.graphKind === 'string' ? message.graphKind : 'ruleviz';
                graphHasComponents = false;
                graphHasInternalStates = false;
                standaloneGraphPaletteKind = message.standaloneGraphPaletteKind === 'ruleviz'
                    ? 'ruleviz'
                    : null;
                showComponents = true;
                showInternalStates = true;
                showRegulatoryRuleBngl = persistedRulevizBrowserViewState.showRegulatoryRuleBngl;
                currentGraphLayoutName = persistedRulevizBrowserViewState.layoutName || 'breadthfirst';
                graphLayoutLocked = persistedRulevizBrowserViewState.layoutLocked;
                const requestedInitialRulevizView = message.initialView === 'pattern' ? 'pattern' : 'operation';

                if (currentCy) {
                    currentCy.destroy();
                    currentCy = null;
                }

                renderRulevizBrowser(message.views, requestedInitialRulevizView);

                const rulevizLayoutSelect = document.getElementById('layout_select');
                const rulevizLayoutLockButton = document.getElementById('layout_lock_button');
                const rulevizFitButton = document.getElementById('fit_button');
                const rulevizExportPngButton = document.getElementById('png_button');
                const rulevizExportGraphmlButton = document.getElementById('graphml_button');
                const rulevizViewToggleButton = document.getElementById('toggle_ruleviz_view_button');

                if (rulevizLayoutSelect) {
                    rulevizLayoutSelect.onchange = function () {
                        applyRulevizBrowserLayout(rulevizLayoutSelect.value);
                    };
                }

                if (rulevizLayoutLockButton) {
                    rulevizLayoutLockButton.onclick = function () {
                        graphLayoutLocked = !graphLayoutLocked;
                        applyRulevizBrowserLayoutLock();
                        updateLayoutLockButton(rulevizLayoutSelect);
                        persistGraphViewState();
                    };
                }

                if (rulevizFitButton) {
                    rulevizFitButton.onclick = function () {
                        applyRulevizBrowserFit({ animate: true });
                    };
                }

                if (rulevizExportPngButton) {
                    rulevizExportPngButton.onclick = function () {
                        exportRulevizBrowserPng().catch((error) => {
                            console.error(error);
                            vscode.postMessage({
                                command: 'alert',
                                text: 'Failed to export the standalone RuleViz PNG.'
                            });
                        });
                    };
                }

                if (rulevizExportGraphmlButton) {
                    rulevizExportGraphmlButton.onclick = function () {
                        exportRulevizBrowserGraphml();
                    };
                }

                if (rulevizViewToggleButton) {
                    rulevizViewToggleButton.onclick = function () {
                        const targetView = rulevizViewToggleButton.dataset.targetRulevizView;
                        if (!targetView) {
                            return;
                        }

                        setRulevizBrowserActiveView(targetView, {
                            fit: true,
                            animate: true
                        });
                    };
                }

                updateComponentsButton();
                updateInternalStatesButton();
                updateLayoutLockButton(rulevizLayoutSelect);
                updateRulevizViewButton();
                applyStandaloneGraphCanvasTheme();

                requestAnimationFrame(() => {
                    if (!isStandaloneRulevizBrowserActive()) {
                        return;
                    }

                    applyRulevizBrowserLayout(currentGraphLayoutName, { persist: false });
                    applyRulevizBrowserLayoutLock();
                    applyRulevizBrowserBnglVisibility();
                    applyRulevizBrowserFit({ animate: false });
                });

                break;
            case 'network':
                // parse GraphML & render with cytoscape.js
                const persistedGraphViewState = resolveInitialGraphViewState();
                destroyRulevizBrowser();
                configureToolbarForRulevizBrowser(false);
                graphKind = typeof message.graphKind === 'string' ? message.graphKind : 'other';
                graphHasComponents = false;
                graphHasInternalStates = false;
                standaloneGraphPaletteKind = (message.standaloneGraphPaletteKind === 'contactmap'
                    || message.standaloneGraphPaletteKind === 'regulatory'
                    || message.standaloneGraphPaletteKind === 'ruleviz_operation')
                    ? message.standaloneGraphPaletteKind
                    : (message.useContactMapViewerPalette ? 'contactmap' : null);
                const regulatoryRuleBnglByLabel = (message.regulatoryRuleBnglByLabel && typeof message.regulatoryRuleBnglByLabel === 'object')
                    ? Object.fromEntries(Object.entries(message.regulatoryRuleBnglByLabel).filter(([label, text]) => {
                        return typeof label === 'string' && typeof text === 'string' && label.trim().length > 0 && text.trim().length > 0;
                    }))
                    : {};
                showComponents = persistedGraphViewState.showComponents;
                showInternalStates = persistedGraphViewState.showInternalStates;
                showRegulatoryRuleBngl = persistedGraphViewState.showRegulatoryRuleBngl;
                currentGraphLayoutName = persistedGraphViewState.layoutName || 'preset';
                graphLayoutLocked = persistedGraphViewState.layoutLocked;

                // --- assumptions about structure of GraphML ---
                //
                // features of nodes:
                // - each node has XML-attribute "id"
                // - each node contains a <data> element, which contains the following elements:
                // -- <y:Fill> w/ XML-attribute "color"
                // -- <y:BorderStyle> w/ XML-attributes "width", "color"
                // -- <y:Shape> (not currently used)
                // -- <y:NodeLabel> w/ text content & XML-attributes "textColor", "fontStyle"
                // -- <y:Geometry> w/ XML-attributes "x", "y"
                // - when retrieving features of group nodes, note that they contain multiple
                //   instances of these elements (corresponding to each of the nested nodes
                //   in the group); assume that the elements describing the group node occur first
                //
                // hierarchy of nodes:
                // - group nodes are denoted by XML-attribute yfiles.foldertype="group"
                // - group nodes can contain regular nodes & graphs
                // - graphs can contain group nodes & regular nodes
                // - graphs are used in conjunction with group nodes;
                //   a graph is either at the top level or is the child of a group node
                //
                // features of edges:
                // - each edge has XML-attributes "id", "source", "target"
                // - each edge contains a <data> element, which contains the following elements:
                // -- <y:LineStyle> w/ XML-attributes "width", "color"
                // -- <y:Arrows> w/ XML-attribute "target"
                // -- <y:BendStyle> (not currently used)

                // get XML document corresponding to GraphML text
                const graphmlText = message.data;
                const xmlParser = new DOMParser();
                const xmlDoc = xmlParser.parseFromString(graphmlText, 'text/xml');
                
                // initialize collection of elements to be used for cytoscape rendering
                let cytoElements = {
                    nodes: [],
                    edges: []
                };
                let nodeKindsById = {};
                let nodeOrderCounter = 0;

                // --- add nodes from the XML document to the cytoscape collection ---

                // function to add a node (w/ features) to the cytoscape collection
                // node: element (with tag "node") from XML document
                // parentId: id of parent of node, null if none (ie. node is at top level)
                function addNode (node, parentId) {
                    // --- get features of the node, check that they exist, use defaults if not found ---
                    // background color
                    let backgroundColor = node.getElementsByTagName("y:Fill").item(0);
                    backgroundColor = (backgroundColor) ? backgroundColor.getAttribute("color") : null;
                    backgroundColor = (backgroundColor) ? backgroundColor : "#999999";
                    // border
                    let border = node.getElementsByTagName("y:BorderStyle").item(0);
                    let borderWidth = (border) ? border.getAttribute("width") : null;
                    let borderColor = (border) ? border.getAttribute("color") : null;
                    borderWidth = (borderWidth) ? borderWidth : "1";
                    borderColor = (borderColor) ? borderColor : "#000000";
                    let shape = node.getElementsByTagName("y:Shape").item(0);
                    shape = (shape) ? shape.getAttribute("type") : null;
                    // label
                    let label = node.getElementsByTagName("y:NodeLabel").item(0);
                    let labelText = (label) ? label.textContent : "";
                    let labelColor = (label) ? label.getAttribute("textColor") : null;
                    let labelWeight = (label) ? label.getAttribute("fontStyle") : null;
                    labelColor = (labelColor) ? labelColor : "#000000";
                    labelWeight = (labelWeight && (labelWeight == "bold")) ? "bold" : "normal";
                    let labelFontSize = (label) ? parseFloat(label.getAttribute("fontSize")) : NaN;
                    labelFontSize = (Number.isFinite(labelFontSize) && labelFontSize > 0) ? labelFontSize : 12;
                    // layout
                    let layout = node.getElementsByTagName("y:Geometry").item(0);
                    // - specifiedPosition object stores node position specified by graphml (undefined if not specified)
                    let specifiedPosition = undefined;
                    let nodeWidth = NaN;
                    let nodeHeight = NaN;
                    const nodeKind = graphKind === 'contactmap' ? getContactMapNodeKind(backgroundColor) : 'other';
                    const hasDirectChildren = getDirectChildNodeElements(node).length > 0;
                    const isRegulatoryProcessNode = graphKind === 'regulatory'
                        && (shape || '').toLowerCase() === 'ellipse';
                    if (layout) {
                        specifiedPosition = {
                            x: parseFloat(layout.getAttribute("x")),
                            y: parseFloat(layout.getAttribute("y"))
                        };
                        nodeWidth = parseFloat(layout.getAttribute("width"));
                        nodeHeight = parseFloat(layout.getAttribute("height"));
                    }
                    const defaultNodeDimensions = getContactMapDefaultNodeDimensions(nodeKind, hasDirectChildren);
                    const defaultNodeWidth = defaultNodeDimensions.width;
                    const defaultNodeHeight = defaultNodeDimensions.height;
                    const isStandaloneContactMapStyling = isStandaloneContactMapViewer();
                    const regulatoryRuleBnglText = isRegulatoryProcessNode
                        ? (regulatoryRuleBnglByLabel[labelText.trim()] || '')
                        : '';
                    const regulatoryRuleBnglCaptionId = regulatoryRuleBnglText
                        ? `${node.id}__rule_bngl_caption`
                        : '';
                    const regulatoryRuleBnglCaptionMetrics = regulatoryRuleBnglText
                        ? getRegulatoryRuleBnglCaptionMetrics(regulatoryRuleBnglText)
                        : null;
                    const minimumNodeWidth = isStandaloneContactMapStyling
                        ? getContactMapMinimumNodeWidth(nodeKind, labelText, hasDirectChildren)
                        : defaultNodeWidth;
                    const displayWidth = (Number.isFinite(nodeWidth) && nodeWidth > 0)
                        ? nodeWidth
                        : Math.max(defaultNodeWidth, minimumNodeWidth);
                    const displayHeight = (Number.isFinite(nodeHeight) && nodeHeight > 0) ? nodeHeight : defaultNodeHeight;
                    const labelMaxWidth = isStandaloneContactMapStyling
                        ? getContactMapLabelMaxWidth(nodeKind, displayWidth, hasDirectChildren)
                        : Math.max(48, displayWidth - 16);
                    const displayBorderWidth = isStandaloneContactMapStyling
                        ? getContactMapBorderWidth(nodeKind, borderWidth)
                        : (Number.isFinite(parseFloat(borderWidth)) ? parseFloat(borderWidth) : 1);
                    const nodeShape = getCytoscapeShape(shape, nodeKind);
                    const minZoomedFontSize = isStandaloneContactMapStyling
                        ? getContactMapMinZoomedFontSize(nodeKind)
                        : (graphKind === 'contactmap' ? 0 : (isStandaloneRegulatoryViewer() ? 0 : 12));
                    if (isStandaloneContactMapStyling) {
                        labelFontSize = getContactMapLabelFontSize(
                            nodeKind,
                            labelFontSize,
                            displayWidth,
                            displayHeight,
                            labelText,
                            hasDirectChildren
                        );
                        if (nodeKind === 'molecule') {
                            labelWeight = 'bold';
                        }
                    }
                    const labelValign = graphKind === 'regulatory'
                        ? 'center'
                        : (isStandaloneContactMapStyling
                            ? getContactMapLabelValign(nodeKind)
                            : 'top');
                    const labelHalign = isStandaloneContactMapStyling
                        ? getContactMapLabelHalign(nodeKind)
                        : 'center';
                    const labelJustification = isStandaloneContactMapStyling
                        ? getContactMapLabelJustification(nodeKind)
                        : 'center';
                    const labelMarginX = isStandaloneContactMapStyling
                        ? getContactMapLabelMarginX(nodeKind, displayWidth)
                        : 0;
                    const labelMarginY = isStandaloneContactMapStyling
                        ? getContactMapLabelMarginY(nodeKind, displayHeight)
                        : 0;
                    const labelBackgroundOpacity = isStandaloneContactMapStyling
                        ? getContactMapLabelBackgroundOpacity(nodeKind)
                        : 0;
                    const labelBackgroundPadding = isStandaloneContactMapStyling
                        ? getContactMapLabelBackgroundPadding(nodeKind)
                        : 0;
                    const compoundPadding = isStandaloneContactMapStyling
                        ? getContactMapCompoundPadding(nodeKind, hasDirectChildren)
                        : 20;
                    // - graph will be rendered with preset positions upon initialization
                    // - if node position is specified by graphml, use that, otherwise default to (0,0)
                    // - note: after initialization, a layout will be applied to nodes which do not have specified positions
                    // - position object stores current model position of node;
                    //   this is used for rendering and is updated by cytoscape to reflect current layout
                    let position = {
                        x: (specifiedPosition) ? specifiedPosition["x"] : 0,
                        y: (specifiedPosition) ? specifiedPosition["y"] : 0
                    };

                    // add the node to the collection
                    cytoElements["nodes"].push(
                        {data: {id: node.id,
                                parent: parentId,
                                backgroundColor: backgroundColor,
                                displayBackgroundColor: backgroundColor,
                                borderWidth: borderWidth,
                                displayBorderWidth: displayBorderWidth,
                                borderColor: borderColor,
                                displayBorderColor: borderColor,
                                nodeShape: nodeShape,
                                width: displayWidth,
                                height: displayHeight,
                                labelText: labelText,
                                defaultLabelText: labelText,
                                labelColor: labelColor,
                                displayLabelColor: labelColor,
                                displayLabelBackgroundColor: isStandaloneContactMapStyling
                                    ? getContactMapBaseFillColor(nodeKind, backgroundColor)
                                    : 'transparent',
                                labelWeight: labelWeight,
                                defaultLabelWeight: labelWeight,
                                labelFontSize: labelFontSize,
                                defaultLabelFontSize: labelFontSize,
                                labelMaxWidth: labelMaxWidth,
                                defaultLabelMaxWidth: labelMaxWidth,
                                labelValign: labelValign,
                                labelHalign: labelHalign,
                                labelJustification: labelJustification,
                                labelMarginX: labelMarginX,
                                labelMarginY: labelMarginY,
                                labelBackgroundOpacity: labelBackgroundOpacity,
                                labelBackgroundPadding: labelBackgroundPadding,
                                compoundPadding: compoundPadding,
                                minCompoundWidth: hasDirectChildren ? displayWidth : 0,
                                minCompoundHeight: hasDirectChildren ? displayHeight : 0,
                                minZoomedFontSize: minZoomedFontSize,
                                nodeKind: nodeKind,
                                isRegulatoryProcessNode: isRegulatoryProcessNode,
                                regulatoryRuleBnglText: regulatoryRuleBnglText,
                                regulatoryRuleBnglCaptionId: regulatoryRuleBnglCaptionId,
                                defaultWidth: displayWidth,
                                defaultHeight: displayHeight,
                                nodeOrder: nodeOrderCounter,
                                specifiedPosition: specifiedPosition},
                        position: position}
                    );
                    if (regulatoryRuleBnglCaptionMetrics && regulatoryRuleBnglCaptionId) {
                        cytoElements["nodes"].push(
                            {data: {id: regulatoryRuleBnglCaptionId,
                                    backgroundColor: 'transparent',
                                    displayBackgroundColor: 'transparent',
                                    borderWidth: 0,
                                    displayBorderWidth: 0,
                                    borderColor: 'transparent',
                                    displayBorderColor: 'transparent',
                                    nodeShape: 'round-rectangle',
                                    width: regulatoryRuleBnglCaptionMetrics.width,
                                    height: regulatoryRuleBnglCaptionMetrics.height,
                                    labelText: regulatoryRuleBnglText,
                                    defaultLabelText: regulatoryRuleBnglText,
                                    labelColor: '#000000',
                                    displayLabelColor: '#000000',
                                    displayLabelBackgroundColor: 'transparent',
                                    labelWeight: 'normal',
                                    defaultLabelWeight: 'normal',
                                    labelFontSize: regulatoryRuleBnglCaptionMetrics.fontSize,
                                    defaultLabelFontSize: regulatoryRuleBnglCaptionMetrics.fontSize,
                                    labelMaxWidth: regulatoryRuleBnglCaptionMetrics.labelMaxWidth,
                                    defaultLabelMaxWidth: regulatoryRuleBnglCaptionMetrics.labelMaxWidth,
                                    labelValign: 'center',
                                    labelHalign: 'center',
                                    labelJustification: 'center',
                                    labelMarginX: 0,
                                    labelMarginY: 0,
                                    labelBackgroundOpacity: 0,
                                    labelBackgroundPadding: 0,
                                    compoundPadding: 0,
                                    minCompoundWidth: 0,
                                    minCompoundHeight: 0,
                                    minZoomedFontSize: 0,
                                    nodeKind: 'other',
                                    isRegulatoryProcessNode: false,
                                    isRegulatoryRuleBnglCaption: true,
                                    regulatoryRuleOwnerId: node.id,
                                    defaultWidth: regulatoryRuleBnglCaptionMetrics.width,
                                    defaultHeight: regulatoryRuleBnglCaptionMetrics.height,
                                    nodeOrder: nodeOrderCounter + 0.1,
                                    specifiedPosition: undefined},
                            position: {
                                x: position.x,
                                y: position.y + (displayHeight / 2) + 12 + (regulatoryRuleBnglCaptionMetrics.height / 2)
                            },
                            grabbable: false,
                            selectable: false,
                            classes: `${REGULATORY_RULE_BNGL_CAPTION_CLASS} ${REGULATORY_RULE_BNGL_HIDDEN_CLASS}`}
                        );
                    }
                    nodeKindsById[node.id] = nodeKind;
                    nodeOrderCounter += 1;
                }

                // TEMPORARY, for testing purposes:
                //
                // choose grouped or flat node hierarchy
                let mode = "grouped";
                // let mode = "flat";
                //
                // for grouped mode, choose method of obtaining hierarchy information
                let method = "recursive";
                // let method = "property";

                if (mode == "grouped" && method == "recursive") {
                    let parentStack = []; // empty at top level
                    let graphmlRoot = xmlDoc.getElementsByTagName("graphml").item(0);

                    // recursive function to add child nodes of root to the
                    // cytoscape collection, preserving grouping/hierarchy
                    // root: element from XML document
                    function addChildNodes (root) {
                        let children = root.children;
                        for (const element of children) {
                            if (element.tagName == "graph") {
                                addChildNodes(element);
                            }
                            else if (element.tagName == "node") {
                                let parentId = null;
                                // if parentStack is not empty, use the last parentId added
                                if (parentStack.length != 0) {
                                    parentId = parentStack[parentStack.length - 1];
                                }

                                // if element is a group node,
                                // add it to the cytoscape collection and also add its children
                                if (element.getAttribute("yfiles.foldertype") == "group") {
                                    addNode(element, parentId);

                                    parentStack.push(element.id); // this group node is now the last on stack
                                    addChildNodes(element);
                                    parentStack.pop(); // after adding all nodes in the group, remove it from stack
                                }

                                // if element is a regular node,
                                // simply add it to the cytoscape collection
                                else {
                                    addNode(element, parentId);
                                }
                            }
                        }
                    }

                    addChildNodes(graphmlRoot);
                }

                if (mode == "grouped" && method == "property") {
                    let graphmlNodes = xmlDoc.getElementsByTagName("node");
                    for (const node of graphmlNodes) {
                        let parent = node.parentElement.parentElement; // node is inside graph is inside group node
                        let parentId = parent.id;
                        // check if node is at top level
                        if (parent.tagName == "graphml") {
                            parentId = null;
                        }
                        addNode(node, parentId);
                    }
                }

                if (mode == "flat") {
                    let graphmlNodes = xmlDoc.getElementsByTagName("node");
                    for (const node of graphmlNodes) {
                        addNode(node, null);
                    }
                }

                // --- add edges from the XML document to the cytoscape collection ---

                // function to add an edge (w/ features) to the cytoscape collection
                // edge: element (with tag "edge") from XML document
                function addEdge (edge) {
                    // --- get features of the edge, check that they exist, use defaults if not found ---
                    let source = edge.getAttribute("source");
                    let target = edge.getAttribute("target");
                    // line
                    let line = edge.getElementsByTagName("y:LineStyle").item(0);
                    let lineWidth = (line) ? line.getAttribute("width") : null;
                    let lineColor = (line) ? line.getAttribute("color") : null;
                    lineWidth = (lineWidth) ? lineWidth : "1";
                    lineColor = (lineColor) ? lineColor : "#000000";
                    // arrow
                    // - this will recognize only the "standard" arrow type as indicating a directed edge,
                    //   and set "none" (indicating an undirected edge) otherwise; adjust this if needed
                    let arrow = edge.getElementsByTagName("y:Arrows").item(0);
                    arrow = (arrow) ? arrow.getAttribute("target") : null;
                    arrow = (arrow && (arrow == "standard")) ? "triangle" : "none";
                    
                    // add the edge to the collection
                    const arrowColor = lineColor;
                    const sourceKind = nodeKindsById[source] || 'other';
                    const targetKind = nodeKindsById[target] || 'other';
                    cytoElements["edges"].push(
                        {data: {id: edge.id,
                                source: source,
                                target: target,
                                lineWidth: lineWidth,
                                lineColor: lineColor,
                                displayLineColor: lineColor,
                                arrowColor: arrowColor,
                                displayArrowColor: arrowColor,
                                connectsState: sourceKind === 'state' || targetKind === 'state',
                                connectsComponent: sourceKind !== 'molecule' || targetKind !== 'molecule',
                                arrow: arrow}}
                    );
                }

                let graphmlEdges = xmlDoc.getElementsByTagName("edge");
                for (const edge of graphmlEdges) {
                    addEdge(edge);
                }

                // --- set up graph ---
                // stylesheet
                const style = [
                    {
                        selector: 'node',
                        style: {
                            'background-color': 'data(displayBackgroundColor)',
                            'border-width': 'data(displayBorderWidth)',
                            'border-color': 'data(displayBorderColor)',
                            'shape': 'data(nodeShape)',
                            'width': 'data(width)',
                            'height': 'data(height)',
                            'label': 'data(labelText)',
                            'color': 'data(displayLabelColor)',
                            'font-weight': 'data(labelWeight)',
                            'font-size': 'data(labelFontSize)',
                            'text-valign': 'data(labelValign)',
                            'text-halign': 'data(labelHalign)',
                            'text-justification': 'data(labelJustification)',
                            'text-margin-x': 'data(labelMarginX)',
                            'text-margin-y': 'data(labelMarginY)',
                            'text-background-color': 'data(displayLabelBackgroundColor)',
                            'text-background-opacity': 'data(labelBackgroundOpacity)',
                            'text-background-padding': 'data(labelBackgroundPadding)',
                            'text-background-shape': 'round-rectangle',
                            'text-wrap': 'wrap',
                            'text-max-width': 'data(labelMaxWidth)',
                            'min-zoomed-font-size': 'data(minZoomedFontSize)'
                        }
                    },
                    {
                        selector: ':parent',
                        style: {
                            'padding': 'data(compoundPadding)',
                            'min-width': 'data(minCompoundWidth)',
                            'min-height': 'data(minCompoundHeight)'
                        }
                    },
                    {
                        selector: '.contact-map-structure-hidden',
                        style: {
                            'display': 'none'
                        }
                    },
                    {
                        selector: `.${REGULATORY_RULE_BNGL_CAPTION_CLASS}`,
                        style: {
                            'background-opacity': 0,
                            'border-opacity': 0,
                            'border-width': 0,
                            'events': 'no'
                        }
                    },
                    {
                        selector: `.${REGULATORY_RULE_BNGL_HIDDEN_CLASS}`,
                        style: {
                            'display': 'none'
                        }
                    },
                    {
                        selector: 'edge',
                        style: {
                            'width': 'data(lineWidth)',
                            'line-color': 'data(displayLineColor)',
                            'target-arrow-color': 'data(displayArrowColor)',
                            'target-arrow-shape': 'data(arrow)',
                            'curve-style': 'bezier'
                        }
                    }
                ];

                const hasSpecifiedPositions = cytoElements["nodes"].some((node) => {
                    return typeof node.data.specifiedPosition !== 'undefined';
                });
                graphHasComponents = graphKind === 'contactmap'
                    && cytoElements["nodes"].some((node) => node.data.nodeKind === 'site');
                graphHasInternalStates = graphKind === 'contactmap'
                    && cytoElements["nodes"].some((node) => node.data.nodeKind === 'state');
                const preferStandaloneRulevizOperationLayout = isStandaloneRulevizOperationViewer();
                const defaultLayoutName = preferStandaloneRulevizOperationLayout
                    ? 'cose'
                    : (hasSpecifiedPositions
                        ? 'preset'
                        : ((graphKind === 'contactmap' || graphKind === 'regulatory') ? 'cose' : 'breadthfirst'));
                const layoutSelect = document.getElementById('layout_select');
                const layoutLockButton = document.getElementById('layout_lock_button');
                const fitButton = document.getElementById('fit_button');
                const exportPngButton = document.getElementById('png_button');
                const exportGraphmlButton = document.getElementById('graphml_button');
                const toggleComponentsButton = document.getElementById('toggle_components_button');
                const toggleInternalStatesButton = document.getElementById('toggle_internal_states_button');
                const toggleRuleBnglButton = document.getElementById('toggle_rule_bngl_button');
                const regulatoryRuleBnglAvailable = isStandaloneRegulatoryViewer()
                    && cytoElements["nodes"].some((node) => node.data.isRegulatoryProcessNode && node.data.regulatoryRuleBnglText);
                showRegulatoryRuleBngl = showRegulatoryRuleBngl && regulatoryRuleBnglAvailable;

                const layoutFactories = {
                    preset: function () {
                        return {
                            name: 'preset',
                            fit: true,
                            padding: getGraphFitPadding()
                        };
                    },
                    breadthfirst: function () {
                        return {
                            name: 'breadthfirst',
                            fit: true,
                            padding: getGraphFitPadding(),
                            directed: true,
                            animate: false,
                            avoidOverlap: true,
                            nodeDimensionsIncludeLabels: true,
                            spacingFactor: preferStandaloneRulevizOperationLayout
                                ? 1.4
                                : (graphKind === 'regulatory'
                                ? 1.45
                                : (isStandaloneContactMapViewer() ? 1.4 : (graphKind === 'contactmap' ? 1.15 : 1.25)))
                        };
                    },
                    grid: function () {
                        return {
                            name: 'grid',
                            fit: true,
                            padding: getGraphFitPadding(),
                            avoidOverlap: true,
                            avoidOverlapPadding: preferStandaloneRulevizOperationLayout ? 32 : (isStandaloneContactMapViewer() ? 24 : 20),
                            nodeDimensionsIncludeLabels: true,
                            animate: false
                        };
                    },
                    circle: function () {
                        return {
                            name: 'circle',
                            fit: true,
                            padding: getGraphFitPadding(),
                            avoidOverlap: true,
                            nodeDimensionsIncludeLabels: true,
                            spacingFactor: preferStandaloneRulevizOperationLayout ? 1.28 : (isStandaloneContactMapViewer() ? 1.25 : 1.15),
                            animate: false
                        };
                    },
                    concentric: function () {
                        return {
                            name: 'concentric',
                            fit: true,
                            padding: getGraphFitPadding(),
                            avoidOverlap: true,
                            nodeDimensionsIncludeLabels: true,
                            animate: false,
                            minNodeSpacing: preferStandaloneRulevizOperationLayout
                                ? 72
                                : (graphKind === 'regulatory'
                                ? 60
                                : (isStandaloneContactMapViewer() ? 60 : 40)),
                            spacingFactor: preferStandaloneRulevizOperationLayout ? 1.24 : (isStandaloneContactMapViewer() ? 1.25 : 1.15)
                        };
                    },
                    cose: function () {
                        return {
                            name: 'cose',
                            fit: true,
                            padding: getGraphFitPadding(),
                            animate: false,
                            nodeDimensionsIncludeLabels: true,
                            componentSpacing: preferStandaloneRulevizOperationLayout
                                ? 180
                                : (graphKind === 'regulatory'
                                ? 100
                                : (isStandaloneContactMapViewer() ? 96 : (graphKind === 'contactmap' ? 28 : 80))),
                            nodeOverlap: preferStandaloneRulevizOperationLayout ? 18 : (graphKind === 'contactmap' ? 10 : 32),
                            idealEdgeLength: preferStandaloneRulevizOperationLayout
                                ? 110
                                : (graphKind === 'regulatory'
                                ? 180
                                : (isStandaloneContactMapViewer() ? 96 : (graphKind === 'contactmap' ? 72 : 150))),
                            edgeElasticity: preferStandaloneRulevizOperationLayout ? 100 : (isStandaloneContactMapViewer() ? 85 : (graphKind === 'contactmap' ? 90 : 120)),
                            nestingFactor: preferStandaloneRulevizOperationLayout ? 1.05 : (isStandaloneContactMapViewer() ? 0.95 : (graphKind === 'contactmap' ? 0.9 : 1.2)),
                            gravity: preferStandaloneRulevizOperationLayout ? 1 : (isStandaloneContactMapViewer() ? 0.95 : (graphKind === 'contactmap' ? 1.35 : 1)),
                            numIter: preferStandaloneRulevizOperationLayout ? 2200 : (isStandaloneContactMapViewer() ? 1800 : (graphKind === 'contactmap' ? 1400 : 2500)),
                            initialTemp: preferStandaloneRulevizOperationLayout ? 170 : (isStandaloneContactMapViewer() ? 150 : (graphKind === 'contactmap' ? 120 : 200)),
                            coolingFactor: preferStandaloneRulevizOperationLayout ? 0.96 : (isStandaloneContactMapViewer() ? 0.96 : (graphKind === 'contactmap' ? 0.97 : 0.95)),
                            minTemp: 1
                        };
                    }
                };
                const requestedInitialLayoutName = preferStandaloneRulevizOperationLayout && currentGraphLayoutName === 'preset'
                    ? undefined
                    : currentGraphLayoutName;
                const initialLayoutName = normalizeLayoutSelection(
                    requestedInitialLayoutName,
                    hasSpecifiedPositions,
                    defaultLayoutName,
                    layoutFactories
                );

                if (currentCy) {
                    currentCy.destroy();
                    currentCy = null;
                }

                // initialize graph
                const cy = cytoscape({
                    container: network,
                    elements: cytoElements,
                    style: style,
                    layout: {
                        name: 'preset',
                        fit: false
                    }
                });
                currentCy = cy;
                if (isStandaloneRegulatoryViewer()) {
                    cy.on('position', 'node', (event) => {
                        const movedNode = event.target;
                        if (!movedNode.data('isRegulatoryProcessNode')) {
                            return;
                        }

                        syncRegulatoryRuleBnglCaptionForRuleNode(movedNode);
                    });
                }
                applyGraphTheme();

                if (!hasSpecifiedPositions && layoutSelect) {
                    const presetOption = layoutSelect.querySelector('option[value="preset"]');
                    if (presetOption) {
                        presetOption.disabled = true;
                        presetOption.hidden = true;
                    }
                }

                if (layoutSelect) {
                    layoutSelect.value = initialLayoutName;
                }
                updateLayoutLockButton(layoutSelect);

                function fitGraph(options = {}) {
                    const animate = options.animate !== false;
                    const elementsToFit = cy.elements(':visible');
                    if (elementsToFit.length === 0) {
                        return;
                    }

                    const fitOptions = {
                        fit: {
                            eles: elementsToFit,
                            padding: getGraphFitPadding()
                        }
                    };

                    if (!animate) {
                        cy.fit(elementsToFit, getGraphFitPadding());
                        return;
                    }

                    cy.animate({
                        ...fitOptions,
                        duration: 250
                    });
                }

                function createLayoutOptions(layoutName) {
                    const createLayout = layoutFactories[layoutName] || layoutFactories.breadthfirst;
                    return createLayout();
                }

                function getGraphElementsForLayout() {
                    return cy.elements(':visible').not(`.${REGULATORY_RULE_BNGL_CAPTION_CLASS}`);
                }

                function syncRegulatoryRuleBnglCaptionForRuleNode(ruleNode) {
                    if (!ruleNode || ruleNode.length === 0) {
                        return;
                    }

                    const captionId = String(ruleNode.data('regulatoryRuleBnglCaptionId') || '');
                    if (!captionId) {
                        return;
                    }

                    const captionNode = cy.getElementById(captionId);
                    if (!captionNode || captionNode.length === 0) {
                        return;
                    }

                    const ruleHeight = Number(ruleNode.data('defaultHeight')) || Number(ruleNode.data('height')) || 48;
                    const captionHeight = Number(captionNode.data('height')) || 28;
                    const position = ruleNode.position();
                    const captionGap = 12;

                    captionNode.position({
                        x: position.x,
                        y: position.y + (ruleHeight / 2) + captionGap + (captionHeight / 2)
                    });
                }

                function syncRegulatoryRuleBnglCaptionPositions() {
                    if (!isStandaloneRegulatoryViewer()) {
                        return;
                    }

                    cy.nodes().forEach((node) => {
                        if (!node.data('isRegulatoryProcessNode')) {
                            return;
                        }

                        syncRegulatoryRuleBnglCaptionForRuleNode(node);
                    });
                }

                function applyLayout(layoutName, options = {}) {
                    const normalizedLayoutName = normalizeLayoutSelection(
                        layoutName,
                        hasSpecifiedPositions,
                        defaultLayoutName,
                        layoutFactories
                    );
                    const animateFit = options.animateFit !== false;
                    currentGraphLayoutName = normalizedLayoutName;
                    persistGraphViewState();

                    if (layoutSelect) {
                        layoutSelect.value = normalizedLayoutName;
                    }

                    if (isStandaloneContactMapViewer()) {
                        applyStandaloneContactMapLayout(cy, normalizedLayoutName, {
                            animateFit: animateFit,
                            fitViewport: true,
                            onFit: fitGraph
                        });
                        return;
                    }

                    if (normalizedLayoutName === 'preset') {
                        cy.nodes().forEach(function(node) {
                            const specifiedPosition = node.data('specifiedPosition');
                            if (specifiedPosition) {
                                node.position({
                                    x: specifiedPosition.x,
                                    y: specifiedPosition.y
                                });
                            }
                        });
                        syncRegulatoryRuleBnglCaptionPositions();
                        fitGraph({ animate: animateFit });
                        return;
                    }

                    const layout = getGraphElementsForLayout().layout(createLayoutOptions(normalizedLayoutName));
                    layout.one('layoutstop', () => {
                        if (currentCy !== cy) {
                            return;
                        }

                        syncRegulatoryRuleBnglCaptionPositions();
                        if (showRegulatoryRuleBngl && regulatoryRuleBnglAvailable) {
                            fitGraph({ animate: animateFit });
                        }
                    });
                    layout.run();
                }

                function applyRegulatoryRuleBnglMode(options = {}) {
                    if (!isStandaloneRegulatoryViewer()) {
                        updateRegulatoryRuleBnglButton(false);
                        return;
                    }

                    const shouldShowRuleBngl = showRegulatoryRuleBngl && regulatoryRuleBnglAvailable;
                    cy.batch(() => {
                        cy.nodes(`.${REGULATORY_RULE_BNGL_CAPTION_CLASS}`).forEach((node) => {
                            node.toggleClass(REGULATORY_RULE_BNGL_HIDDEN_CLASS, !shouldShowRuleBngl);
                        });
                    });

                    syncRegulatoryRuleBnglCaptionPositions();
                    cy.style().update();
                    updateRegulatoryRuleBnglButton(regulatoryRuleBnglAvailable);

                    if (options.fit === false) {
                        return;
                    }

                    if (graphLayoutLocked || currentGraphLayoutName === 'preset') {
                        fitGraph({ animate: options.animate !== false });
                        return;
                    }

                    fitGraph({ animate: options.animate !== false });
                }

                function exportGraphPng() {
                    const graphBackground = getGraphExportBackgroundColor();
                    const uri = cy.png({
                        output: 'base64uri',
                        bg: graphBackground,
                        full: true,
                        scale: graphPngExportScale
                    });

                    vscode.postMessage({
                        command: 'image',
                        type: 'png',
                        title: page_title,
                        folder: page_folder,
                        text: uri
                    });
                }

                function getGraphExportBackgroundColor() {
                    if (isStandaloneContactMapViewer()) {
                        return getContactMapViewerPalette().background;
                    }

                    if (isStandaloneRegulatoryViewer()) {
                        return getRegulatoryViewerPalette().background;
                    }

                    const fallbackBackground = cssVar('--viewer-background', '#ffffff');
                    const backgroundColor = window.getComputedStyle(network).backgroundColor;
                    const parsedBackground = parseColor(backgroundColor);

                    if (!parsedBackground || parsedBackground.a === 0) {
                        return fallbackBackground;
                    }

                    return toCssColor(parsedBackground);
                }

                function getNodeGeometryForGraphmlExport(node) {
                    const storedWidth = node.isParent()
                        ? (
                            Number(node.data('layoutFootprintWidth'))
                            || Number(node.data('minCompoundWidth'))
                            || Number(node.data('width'))
                        )
                        : Number(node.data('width'));
                    const storedHeight = node.isParent()
                        ? (
                            Number(node.data('layoutFootprintHeight'))
                            || Number(node.data('minCompoundHeight'))
                            || Number(node.data('height'))
                        )
                        : Number(node.data('height'));
                    const width = storedWidth > 0
                        ? storedWidth
                        : getNodeLayoutSize(node).width;
                    const height = storedHeight > 0
                        ? storedHeight
                        : getNodeLayoutSize(node).height;
                    const position = node.position();

                    return {
                        x: position.x - (width / 2),
                        y: position.y - (height / 2),
                        width: width,
                        height: height
                    };
                }

                function findGraphmlGeometryContainer(graphNode) {
                    const searchRoots = Array.from(graphNode.children || []).filter((child) => child.tagName === 'data');
                    const roots = searchRoots.length !== 0 ? searchRoots : [graphNode];

                    for (const root of roots) {
                        const descendants = Array.from(root.getElementsByTagName('*'));
                        const preferredContainer = descendants.find((element) => {
                            return element.tagName === 'y:ShapeNode'
                                || element.tagName === 'y:GenericNode'
                                || element.tagName === 'y:GroupNode';
                        });

                        if (preferredContainer) {
                            return preferredContainer;
                        }

                        const fallbackContainer = descendants.find((element) => element.tagName.startsWith('y:'));
                        if (fallbackContainer) {
                            return fallbackContainer;
                        }
                    }

                    return null;
                }

                function serializeGraphmlWithCurrentLayout() {
                    const exportDoc = xmlDoc.cloneNode(true);
                    const serializer = new XMLSerializer();
                    const yNamespace = exportDoc.lookupNamespaceURI('y') || 'http://www.yworks.com/xml/graphml';

                    Array.from(exportDoc.getElementsByTagName('node')).forEach((graphNode) => {
                        const nodeId = graphNode.getAttribute('id');
                        if (!nodeId) {
                            return;
                        }

                        const cyNode = cy.getElementById(nodeId);
                        if (!cyNode || cyNode.length === 0) {
                            return;
                        }

                        const geometry = getNodeGeometryForGraphmlExport(cyNode);
                        const geometryContainer = findGraphmlGeometryContainer(graphNode);
                        if (!geometryContainer) {
                            return;
                        }

                        let geometryElement = geometryContainer.getElementsByTagName('y:Geometry').item(0);
                        if (!geometryElement) {
                            geometryElement = exportDoc.createElementNS(yNamespace, 'y:Geometry');
                            geometryContainer.insertBefore(geometryElement, geometryContainer.firstChild);
                        }

                        geometryElement.setAttribute('x', geometry.x.toFixed(2));
                        geometryElement.setAttribute('y', geometry.y.toFixed(2));
                        geometryElement.setAttribute('width', geometry.width.toFixed(2));
                        geometryElement.setAttribute('height', geometry.height.toFixed(2));
                    });

                    return serializer.serializeToString(exportDoc);
                }

                function exportGraphml() {
                    vscode.postMessage({
                        command: 'graphml-export',
                        title: page_title + '_layout',
                        folder: page_folder,
                        text: serializeGraphmlWithCurrentLayout()
                    });
                }

                if (layoutLockButton) {
                    layoutLockButton.onclick = function () {
                        graphLayoutLocked = !graphLayoutLocked;
                        updateLayoutLockButton(layoutSelect);
                        persistGraphViewState();
                    };
                }

                if (layoutSelect) {
                    layoutSelect.onchange = function () {
                        applyLayout(layoutSelect.value, { animateFit: true });
                    };
                }

                if (fitButton) {
                    fitButton.onclick = function () {
                        fitGraph({ animate: true });
                    };
                }

                if (exportPngButton) {
                    exportPngButton.onclick = exportGraphPng;
                }

                if (exportGraphmlButton) {
                    exportGraphmlButton.onclick = exportGraphml;
                }

                if (toggleComponentsButton) {
                    toggleComponentsButton.onclick = function () {
                        showComponents = !showComponents;
                        updateComponentsButton();
                        updateInternalStatesButton();
                        applyContactMapStructureVisibility();
                        persistGraphViewState();
                    };
                }

                if (toggleInternalStatesButton) {
                    toggleInternalStatesButton.onclick = function () {
                        showInternalStates = !showInternalStates;
                        updateComponentsButton();
                        updateInternalStatesButton();
                        applyContactMapStructureVisibility();
                        persistGraphViewState();
                    };
                }

                if (toggleRuleBnglButton) {
                    toggleRuleBnglButton.onclick = function () {
                        showRegulatoryRuleBngl = !showRegulatoryRuleBngl;
                        applyRegulatoryRuleBnglMode({ fit: false });
                        persistGraphViewState();
                    };
                }

                updateComponentsButton();
                updateInternalStatesButton();
                updateRegulatoryRuleBnglButton(regulatoryRuleBnglAvailable);

                if (isStandaloneContactMapViewer()) {
                    ensureStandaloneContactMapPrepared(cy);
                }

                applyRegulatoryRuleBnglMode({ fit: false });
                applyContactMapStructureVisibility();

                if (isStandaloneContactMapViewer()) {
                    requestAnimationFrame(() => {
                        if (currentCy !== cy) {
                            return;
                        }

                        cy.resize();
                        applyLayout(initialLayoutName, { animateFit: false });
                    });
                } else {
                    applyLayout(initialLayoutName, { animateFit: false });
                }

                break;
        }
    });
    
    vscode.postMessage({
        command: 'ready',
    });
}());
