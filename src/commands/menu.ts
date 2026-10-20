import * as vscode from 'vscode';

interface BngMenuItem extends vscode.QuickPickItem {
    cmd: string;
}

export async function menuCommandHandler() {
    const editor = vscode.window.activeTextEditor;
    const ext = editor?.document.fileName.split('.').pop()?.toLowerCase();

    const items: BngMenuItem[] = [];
    if (ext === 'bngl') {
        items.push(
            { label: '$(play) Simulate', description: 'Run the current BNGL model', cmd: 'bng.run_bngl' },
            { label: '$(graph) Contact Map', description: 'Generate only the contact map GraphML', cmd: 'bng.run_contactmap' },
            { label: '$(type-hierarchy) Regulatory Graph', description: 'Generate only the regulatory graph GraphML', cmd: 'bng.run_regulatory' },
            { label: '$(type-hierarchy) RuleViz', description: 'Generate standalone RuleViz outputs with operation and pattern views', cmd: 'bng.run_ruleviz' },
            { label: '$(folder) Results Folder...', description: 'Choose where generated results are written', cmd: 'bng.results_folder' },
        );
    }
    if (['gdat', 'cdat', 'scan'].includes(ext || '')) {
        items.push(
            { label: '$(pulse) Plot', description: 'Open built-in plot viewer', cmd: 'bng.webview' },
        );
    }
    if (ext === 'graphml') {
        items.push(
            { label: '$(type-hierarchy) View', description: 'Open network graph viewer', cmd: 'bng.webview' },
        );
    }
    items.push(
        { label: '$(close-all) Close Generated Tabs', description: 'Close open plots, graph views, and generated artifact files', cmd: 'bng.close_generated_artifacts' },
        { label: '$(tools) Install', description: 'Check and install PyBioNetGen', cmd: 'bng.setup' },
        { label: '$(cloud-upload) Upgrade', description: 'Upgrade PyBioNetGen to latest version', cmd: 'bng.upgrade' },
    );

    const pick = await vscode.window.showQuickPick(items, { placeHolder: 'BioNetGen: Select an action' });
    if (pick) {
        try {
            await vscode.commands.executeCommand(pick.cmd);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`BioNetGen command failed: ${message}`);
        }
    }
}
