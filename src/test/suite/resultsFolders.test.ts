import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    getStandaloneGraphPaletteKind,
    getGraphmlVisualizationKind,
    getResultsBaseFolderUri,
    getResultsRootFolderName,
    getResultsRetentionPolicy,
    getResultsRetentionPolicyLabel,
    getResultsRunFolderUri,
    isGeneratedResultsRunFolderName,
    parseGeneratedResultsRunFolderTimestamp,
    resolveResultsBaseFolderPath,
    shouldDeleteGeneratedResultsRunFolder,
    shouldUseStandaloneContactMapPalette,
    shouldUseStandaloneRegulatoryPalette,
    shouldUseStandaloneRulevizLayout,
    shouldUseStandaloneRulevizOperationLayout,
} from '../../resultsFolders';

suite('Results Folders', () => {
    test('uses results_<model> naming for managed results roots', () => {
        const filePath = path.join('/tmp', 'examples', 'nfkb.bngl');
        assert.strictEqual(getResultsRootFolderName(filePath), 'results_nfkb');
    });

    test('recognizes generated timestamp run folder names', () => {
        assert.strictEqual(isGeneratedResultsRunFolderName('2026_05_18__12_34_56'), true);
        assert.strictEqual(isGeneratedResultsRunFolderName('results_nfkb'), false);
        assert.strictEqual(isGeneratedResultsRunFolderName('2026-05-18'), false);
    });

    test('uses keep_all results retention by default', () => {
        const fakeConfig = {
            get: () => null
        } as unknown as vscode.WorkspaceConfiguration;

        assert.strictEqual(getResultsRetentionPolicy(fakeConfig), 'keep_all');
        assert.strictEqual(getResultsRetentionPolicyLabel('keep_all'), 'Keep all runs');
    });

    test('reads configured results retention policies', () => {
        const fakeConfig = {
            get: (key: string) => key === 'general.results_retention' ? 'delete_older_than_1d' : null
        } as unknown as vscode.WorkspaceConfiguration;

        assert.strictEqual(getResultsRetentionPolicy(fakeConfig), 'delete_older_than_1d');
        assert.strictEqual(
            getResultsRetentionPolicyLabel('delete_older_than_1h'),
            'Delete timestamped run folders older than 1 hour'
        );
        assert.strictEqual(
            getResultsRetentionPolicyLabel('delete_older_than_1w'),
            'Delete timestamped run folders older than 1 week'
        );
        assert.strictEqual(
            getResultsRetentionPolicyLabel('purge_existing'),
            'Purge all pre-existing timestamped run folders'
        );
    });

    test('parses generated results run folder timestamps', () => {
        const timestampMs = parseGeneratedResultsRunFolderTimestamp('2026_05_18__12_34_56');
        assert.strictEqual(timestampMs, new Date(2026, 4, 18, 12, 34, 56, 0).getTime());
        assert.strictEqual(parseGeneratedResultsRunFolderTimestamp('invalid'), undefined);
    });

    test('identifies stale generated run folders from retention policy', () => {
        const now = new Date(2026, 4, 19, 13, 0, 0, 0).getTime();

        assert.strictEqual(
            shouldDeleteGeneratedResultsRunFolder('2026_05_19__11_59_59', 'delete_older_than_1h', now),
            true
        );
        assert.strictEqual(
            shouldDeleteGeneratedResultsRunFolder('2026_05_19__12_30_01', 'delete_older_than_1h', now),
            false
        );
        assert.strictEqual(
            shouldDeleteGeneratedResultsRunFolder('2026_05_18__11_59_59', 'delete_older_than_1d', now),
            true
        );
        assert.strictEqual(
            shouldDeleteGeneratedResultsRunFolder('2026_05_11__12_59_59', 'delete_older_than_1w', now),
            true
        );
        assert.strictEqual(
            shouldDeleteGeneratedResultsRunFolder('2026_05_16__13_00_01', 'delete_older_than_1w', now),
            false
        );
        assert.strictEqual(
            shouldDeleteGeneratedResultsRunFolder('2026_05_19__12_30_01', 'purge_existing', now),
            true
        );
        assert.strictEqual(
            shouldDeleteGeneratedResultsRunFolder('2026_05_19__12_30_01', 'keep_all', now),
            false
        );
    });

    test('detects standalone contact maps only when no other graphml outputs are present', () => {
        const filePath = path.join('/tmp', 'results_nfkb', '2026_05_18__12_34_56', 'nfkb_contactmap.graphml');
        assert.strictEqual(
            shouldUseStandaloneContactMapPalette(filePath, ['nfkb.bngl', 'nfkb_contactmap.graphml']),
            true
        );
        assert.strictEqual(
            shouldUseStandaloneContactMapPalette(filePath, ['nfkb.bngl', 'nfkb_contactmap.graphml', 'nfkb_regulatory.graphml']),
            false
        );
    });

    test('detects standalone regulatory graphs only when no other graphml outputs are present', () => {
        const filePath = path.join('/tmp', 'results_nfkb', '2026_05_18__12_34_56', 'nfkb_regulatory.graphml');
        assert.strictEqual(
            shouldUseStandaloneRegulatoryPalette(filePath, ['nfkb.bngl', 'nfkb_regulatory.graphml']),
            true
        );
        assert.strictEqual(
            shouldUseStandaloneRegulatoryPalette(filePath, ['nfkb.bngl', 'nfkb_contactmap.graphml', 'nfkb_regulatory.graphml']),
            false
        );
    });

    test('returns the standalone palette kind for supported single-graph outputs', () => {
        assert.strictEqual(
            getStandaloneGraphPaletteKind('/tmp/nfkb_contactmap.graphml', ['nfkb_contactmap.graphml']),
            'contactmap'
        );
        assert.strictEqual(
            getStandaloneGraphPaletteKind('/tmp/nfkb_regulatory.graphml', ['nfkb_regulatory.graphml']),
            'regulatory'
        );
        assert.strictEqual(
            getStandaloneGraphPaletteKind('/tmp/nfkb_ruleviz_operation.graphml', ['nfkb_ruleviz_operation.graphml']),
            'ruleviz_operation'
        );
    });

    test('classifies graphml visualization kinds from filenames', () => {
        assert.strictEqual(getGraphmlVisualizationKind('/tmp/nfkb_contactmap.graphml'), 'contactmap');
        assert.strictEqual(getGraphmlVisualizationKind('/tmp/nfkb_regulatory.graphml'), 'regulatory');
        assert.strictEqual(getGraphmlVisualizationKind('/tmp/nfkb_ruleviz_operation.graphml'), 'ruleviz_operation');
        assert.strictEqual(getGraphmlVisualizationKind('/tmp/nfkb_ruleviz_pattern.graphml'), 'ruleviz_pattern');
        assert.strictEqual(getGraphmlVisualizationKind('/tmp/nfkb_notes.txt'), 'other');
    });

    test('detects standalone RuleViz (Operation) only when no other graphml outputs are present', () => {
        const filePath = path.join('/tmp', 'results_nfkb', '2026_05_18__12_34_56', 'nfkb_ruleviz_operation.graphml');
        assert.strictEqual(
            shouldUseStandaloneRulevizOperationLayout(filePath, ['nfkb.bngl', 'nfkb_ruleviz_operation.graphml']),
            true
        );
        assert.strictEqual(
            shouldUseStandaloneRulevizOperationLayout(filePath, ['nfkb.bngl', 'nfkb_ruleviz_operation.graphml', 'nfkb_contactmap.graphml']),
            false
        );
    });

    test('detects standalone RuleViz when operation and pattern outputs share the same folder', () => {
        const operationPath = path.join('/tmp', 'results_nfkb', '2026_05_18__12_34_56', 'nfkb_ruleviz_operation__R1.graphml');
        const patternPath = path.join('/tmp', 'results_nfkb', '2026_05_18__12_34_56', 'nfkb_ruleviz_pattern__R1.graphml');

        assert.strictEqual(
            shouldUseStandaloneRulevizLayout(operationPath, [
                'nfkb.bngl',
                'nfkb_ruleviz_operation__R1.graphml',
                'nfkb_ruleviz_pattern__R1.graphml'
            ]),
            true
        );
        assert.strictEqual(
            shouldUseStandaloneRulevizLayout(patternPath, [
                'nfkb.bngl',
                'nfkb_ruleviz_operation__R1.graphml',
                'nfkb_ruleviz_pattern__R1.graphml'
            ]),
            true
        );
        assert.strictEqual(
            shouldUseStandaloneRulevizLayout(operationPath, [
                'nfkb.bngl',
                'nfkb_ruleviz_operation__R1.graphml',
                'nfkb_ruleviz_pattern__R1.graphml',
                'nfkb_contactmap.graphml'
            ]),
            false
        );
    });

    test('uses the model folder when no custom results base is configured', () => {
        const modelPath = path.join('/tmp', 'examples', 'nfkb_test.bngl');
        const fakeConfig = {
            get: () => null
        } as unknown as vscode.WorkspaceConfiguration;

        const resultsBaseUri = getResultsBaseFolderUri(fakeConfig, vscode.Uri.file(modelPath));
        assert.strictEqual(resultsBaseUri.fsPath, path.dirname(modelPath));
    });

    test('uses the configured absolute results base folder', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bngl-results-test-'));
        const customBase = path.join(tmpDir, 'custom_out');
        const modelPath = path.join(tmpDir, 'nfkb_test.bngl');
        const fakeConfig = {
            get: (key: string) => key === 'general.result_folder' ? customBase : null
        } as unknown as vscode.WorkspaceConfiguration;

        try {
            const modelUri = vscode.Uri.file(modelPath);
            const runUri = getResultsRunFolderUri(fakeConfig, modelUri, '2026_05_19__01_02_03');
            assert.strictEqual(runUri.fsPath, path.join(customBase, 'results_nfkb_test', '2026_05_19__01_02_03'));
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    test('resolves relative custom results folders from the workspace folder', () => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        assert.ok(workspaceRoot, 'expected an active workspace folder in the test environment');

        const modelDir = fs.mkdtempSync(path.join(workspaceRoot!, 'tmp-results-folder-test-'));
        const modelPath = path.join(modelDir, 'nfkb_test.bngl');

        try {
            fs.writeFileSync(modelPath, 'begin model\nend model\n', 'utf8');

            const resolvedPath = resolveResultsBaseFolderPath('custom-output', vscode.Uri.file(modelPath));
            assert.strictEqual(resolvedPath, path.join(workspaceRoot!, 'custom-output'));
        } finally {
            fs.rmSync(modelDir, { recursive: true, force: true });
        }
    });
});
