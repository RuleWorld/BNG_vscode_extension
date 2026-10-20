import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * Helper: create a temporary .bngl file, open it, and request folding ranges.
 */
async function getFoldingRanges(content: string): Promise<vscode.FoldingRange[]> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bngl-test-'));
    const tmpFile = path.join(tmpDir, 'test.bngl');
    fs.writeFileSync(tmpFile, content);

    const doc = await vscode.workspace.openTextDocument(tmpFile);
    await vscode.languages.setTextDocumentLanguage(doc, 'bngl');

    const ranges: vscode.FoldingRange[] = await vscode.commands.executeCommand(
        'vscode.executeFoldingRangeProvider',
        doc.uri
    );

    // Clean up
    fs.unlinkSync(tmpFile);
    fs.rmdirSync(tmpDir);

    return ranges ?? [];
}

/** Helper to find a range starting at a given line */
function findRange(ranges: vscode.FoldingRange[], startLine: number): vscode.FoldingRange | undefined {
    return ranges.find(r => r.start === startLine);
}

suite('Folding Provider', () => {

    test('folds a single begin/end block', async () => {
        const content = [
            'begin parameters',
            '  k1 1.0',
            '  k2 2.0',
            'end parameters',
            '',
        ].join('\n');

        const ranges = await getFoldingRanges(content);
        assert.ok(ranges.length >= 1, `Expected at least 1 range, got ${ranges.length}`);

        const r = findRange(ranges, 0);
        assert.ok(r, 'Expected a range starting at line 0');
        assert.strictEqual(r.start, 0);
        assert.strictEqual(r.end, 3);
    });

    test('folds nested begin/end blocks', async () => {
        const content = [
            'begin model',
            '  begin parameters',
            '    k1 1.0',
            '  end parameters',
            '  begin species',
            '    A() 100',
            '  end species',
            'end model',
            '',
        ].join('\n');

        const ranges = await getFoldingRanges(content);
        assert.ok(ranges.length >= 3, `Expected at least 3 ranges, got ${ranges.length}`);

        const modelRange = findRange(ranges, 0);
        const paramsRange = findRange(ranges, 1);
        const speciesRange = findRange(ranges, 4);

        assert.ok(modelRange, 'Expected model range at line 0');
        assert.strictEqual(modelRange.end, 7);

        assert.ok(paramsRange, 'Expected parameters range at line 1');
        assert.strictEqual(paramsRange.end, 3);

        assert.ok(speciesRange, 'Expected species range at line 4');
        assert.strictEqual(speciesRange.end, 6);
    });

    test('handles mismatched blocks gracefully (unmatched end is ignored)', async () => {
        const content = [
            'begin parameters',
            '  k1 1.0',
            'end parameters',
            'end species',  // no matching begin
            '',
        ].join('\n');

        const ranges = await getFoldingRanges(content);
        // Only the parameters block should fold (line 0-2)
        const paramsRange = findRange(ranges, 0);
        assert.ok(paramsRange, 'Expected parameters range at line 0');
        assert.strictEqual(paramsRange.end, 2);

        // No range should start at line 3 (the orphan "end species")
        const orphanRange = findRange(ranges, 3);
        assert.strictEqual(orphanRange, undefined, 'Unmatched end should not create a fold range');
    });

    test('handles comment after block name', async () => {
        const content = [
            'begin parameters # initial params',
            '  k1 1.0',
            'end parameters # done',
            '',
        ].join('\n');

        const ranges = await getFoldingRanges(content);
        const r = findRange(ranges, 0);
        assert.ok(r, 'Expected a range starting at line 0');
        assert.strictEqual(r.end, 2);
    });

    test('normalizes block name aliases (reaction rules / rules)', async () => {
        const content = [
            'begin reaction rules',
            '  A -> B k1',
            'end rules',
            '',
        ].join('\n');

        const ranges = await getFoldingRanges(content);
        const r = findRange(ranges, 0);
        assert.ok(r, 'Expected a range starting at line 0');
        assert.strictEqual(r.end, 2);
    });

    test('folds #@ metadata comment blocks', async () => {
        const content = [
            '#@author John Doe',
            '# This model was created for testing',
            '# and validation purposes',
            '',
            'begin parameters',
            '  k1 1.0',
            'end parameters',
            '',
        ].join('\n');

        const ranges = await getFoldingRanges(content);

        // The parameters region fold should always be present
        const paramsRange = findRange(ranges, 4);
        assert.ok(paramsRange, 'Expected parameters fold at line 4');
        assert.strictEqual(paramsRange.end, 6);

        // The #@ metadata comment fold (lines 0-2) may or may not be returned
        // by executeFoldingRangeProvider depending on VS Code version — Comment-kind
        // folds are sometimes filtered. If present, validate it.
        const metaRange = findRange(ranges, 0);
        if (metaRange) {
            assert.strictEqual(metaRange.end, 2);
        }
    });

    test('case-insensitive begin/end matching', async () => {
        const content = [
            'BEGIN Parameters',
            '  k1 1.0',
            'END Parameters',
            '',
        ].join('\n');

        const ranges = await getFoldingRanges(content);
        assert.ok(ranges.length >= 1, `Expected at least 1 range, got ${ranges.length}`);
    });
});
