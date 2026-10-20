import * as vscode from 'vscode';
import * as path from 'path';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { ProcessManager, ProcessManagerProvider, TrackedProcessObject } from './utils/processManagement';
import { getGeneratedArtifactTabs } from './utils/generatedArtifacts';
import { PlotPanel } from './plotting/PlotPanel';
import { createRunHandler, createVizHandler, createContactMapHandler, createRegulatoryGraphHandler, createRulevizHandler, createResultsFolderHandler, createSetupHandler, createUpgradeHandler, CommandContext } from './commands/handlers';
import { menuCommandHandler } from './commands/menu';
import { bnglFoldingProvider } from './folding/foldingProvider';

const PYBNG_VERSION = '0.5.0';

let client: LanguageClient | undefined;

interface ManageProcessQuickPickItem extends vscode.QuickPickItem {
	action: 'stop_all' | 'reveal' | 'show_output' | 'stop_one';
	process?: TrackedProcessObject;
}

function getTrackedProcessDisplayLabel(processObject: TrackedProcessObject): string {
	if (processObject.label) {
		return processObject.label;
	}

	if (processObject.modelPath) {
		return path.basename(processObject.modelPath);
	}

	return processObject.name.split(/[\\\/]/).pop()?.replace('.exe', '') || 'unknown';
}

async function revealProcessManagerView() {
	await vscode.commands.executeCommand('workbench.view.explorer');
	try {
		await vscode.commands.executeCommand('processManagerTreeView.focus');
	} catch {
		// ignore if VS Code cannot focus the contributed view directly
	}
}

export function activate(context: vscode.ExtensionContext) {
	// Start the language server
	const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc },
	};
	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'bngl' }],
	};
	client = new LanguageClient('bnglLanguageServer', 'BNGL Language Server', serverOptions, clientOptions);
	client.start();
	context.subscriptions.push({ dispose: () => { client?.stop(); } });
	const processManager = new ProcessManager();
	const channel = vscode.window.createOutputChannel('BNGL');

	const ctx: CommandContext = {
		processManager,
		channel,
		pybngVersion: PYBNG_VERSION,
		extensionContext: context,
	};

	const activeJobsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	activeJobsStatusBarItem.name = 'BNG Active Jobs';
	activeJobsStatusBarItem.command = 'bng.manage_processes';
	context.subscriptions.push(activeJobsStatusBarItem);

	const updateActiveJobsStatus = () => {
		const activeProcesses = processManager.getTrackedProcesses();
		const activeSimulations = processManager.getTrackedProcesses('simulation');

		if (activeProcesses.length === 0) {
			activeJobsStatusBarItem.hide();
			void vscode.commands.executeCommand('setContext', 'bng.hasActiveProcesses', false);
			return;
		}

		const primaryProcesses = activeSimulations.length > 0 ? activeSimulations : activeProcesses;
		const primaryLabel = activeSimulations.length > 0 ? 'run' : 'job';
		const primaryCount = primaryProcesses.length;
		const preview = primaryProcesses
			.slice(0, 5)
			.map((processObject) => {
				const description = processObject.description ? ` - ${processObject.description}` : '';
				return `• ${getTrackedProcessDisplayLabel(processObject)}${description}`;
			})
			.join('\n');
		const remainingCount = Math.max(primaryProcesses.length - 5, 0);
		const tooltipLines = [
			`BioNetGen has ${activeProcesses.length} active job${activeProcesses.length === 1 ? '' : 's'}.`,
			preview,
			remainingCount > 0 ? `• ${remainingCount} more` : '',
			'Click to manage active jobs.'
		].filter((line) => line.length > 0);

		activeJobsStatusBarItem.text = `$(sync~spin) BNG: ${primaryCount} ${primaryLabel}${primaryCount === 1 ? '' : 's'} active`;
		activeJobsStatusBarItem.tooltip = tooltipLines.join('\n');
		activeJobsStatusBarItem.show();
		void vscode.commands.executeCommand('setContext', 'bng.hasActiveProcesses', true);
	};

	context.subscriptions.push(processManager.onDidChangeTrackedProcesses(updateActiveJobsStatus));

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('bng.run_bngl', createRunHandler(ctx)),
		vscode.commands.registerCommand('bng.run_contactmap', createContactMapHandler(ctx)),
		vscode.commands.registerCommand('bng.run_regulatory', createRegulatoryGraphHandler(ctx)),
		vscode.commands.registerCommand('bng.run_ruleviz', createRulevizHandler(ctx)),
		vscode.commands.registerCommand('bng.run_viz', createVizHandler(ctx)),
		vscode.commands.registerCommand('bng.results_folder', createResultsFolderHandler(ctx)),
		vscode.commands.registerCommand('bng.webview', () => PlotPanel.create(context.extensionUri)),
		vscode.commands.registerCommand('bng.close_generated_artifacts', async () => {
			const closedPanelCount = PlotPanel.disposeAll();
			const artifactTabs = getGeneratedArtifactTabs(vscode.window.tabGroups.all);

			if (closedPanelCount === 0 && artifactTabs.length === 0) {
				vscode.window.showInformationMessage('No generated artifact tabs are open.');
				return;
			}

			let closedArtifactTabCount = 0;
			if (artifactTabs.length > 0) {
				const closed = await vscode.window.tabGroups.close(artifactTabs, true);
				if (!closed) {
					const closedCount = closedPanelCount;
					vscode.window.showInformationMessage(
						closedCount > 0
							? `Closed ${closedCount} generated artifact tab${closedCount === 1 ? '' : 's'}, but some file tabs could not be closed.`
							: 'Could not close all generated artifact tabs.'
					);
					return;
				}

				closedArtifactTabCount = artifactTabs.length;
			}

			const closedCount = closedPanelCount + closedArtifactTabCount;
			if (closedCount === 0) {
				vscode.window.showInformationMessage('No generated artifact tabs are open.');
				return;
			}

			vscode.window.showInformationMessage(`Closed ${closedCount} generated artifact tab${closedCount === 1 ? '' : 's'}.`);
		}),
		vscode.commands.registerCommand('bng.setup', createSetupHandler(ctx)),
		vscode.commands.registerCommand('bng.upgrade', createUpgradeHandler(ctx)),
		vscode.commands.registerCommand('bng.process_cleanup', () => processManager.killAllProcesses()),
		vscode.commands.registerCommand('bng.kill_process', (processObject) => processManager.killProcess(processObject)),
		vscode.commands.registerCommand('bng.manage_processes', async () => {
			const activeProcesses = processManager.getTrackedProcesses();
			if (activeProcesses.length === 0) {
				vscode.window.showInformationMessage('No active BioNetGen jobs.');
				return;
			}

			const items: ManageProcessQuickPickItem[] = [
				{
					label: '$(stop-circle) Stop All Active Jobs',
					detail: 'Kill every tracked BioNetGen job.',
					action: 'stop_all'
				},
				{
					label: '$(list-tree) Reveal BNG Process Manager',
					detail: 'Open the Explorer view with the active process tree.',
					action: 'reveal'
				},
				{
					label: '$(output) Show BNGL Output',
					detail: 'Open the BNGL output channel.',
					action: 'show_output'
				},
				...activeProcesses.map((processObject) => ({
					label: `$(stop-circle) Stop ${getTrackedProcessDisplayLabel(processObject)}`,
					description: processObject.description,
					detail: processObject.resultsFolder || processObject.modelPath || processObject.name,
					action: 'stop_one' as const,
					process: processObject
				}))
			];

			const pick = await vscode.window.showQuickPick(items, {
				title: `${activeProcesses.length} Active BioNetGen Job${activeProcesses.length === 1 ? '' : 's'}`,
				placeHolder: 'Choose an action'
			});

			if (!pick) {
				return;
			}

			if (pick.action === 'stop_all') {
				await processManager.killAllProcesses();
				vscode.window.showInformationMessage('Stopping all active BioNetGen jobs.');
				return;
			}

			if (pick.action === 'reveal') {
				await revealProcessManagerView();
				return;
			}

			if (pick.action === 'show_output') {
				channel.show();
				return;
			}

			if (pick.process) {
				await processManager.killProcess(pick.process);
				vscode.window.showInformationMessage(`Stopping ${getTrackedProcessDisplayLabel(pick.process)}.`);
			}
		}),
		vscode.commands.registerCommand('bng.menu', menuCommandHandler),
	);

	// Process manager tree view
	const processManagerProvider = new ProcessManagerProvider(processManager);
	const treeView = vscode.window.createTreeView('processManagerTreeView', {
		treeDataProvider: processManagerProvider,
	});
	context.subscriptions.push(processManagerProvider, treeView);
	vscode.commands.executeCommand('setContext', 'bng.processManagerActive', true);
	updateActiveJobsStatus();

	// Auto-install check (runs after commands are registered)
	const config = vscode.workspace.getConfiguration('bngl');
	if (config.get<boolean>('general.auto_install')) {
		channel.appendLine('Checking PyBioNetGen installation ...');
		vscode.commands.executeCommand('bng.setup');
	}

	// Folding provider
	context.subscriptions.push(
		vscode.languages.registerFoldingRangeProvider({ language: 'bngl' }, bnglFoldingProvider),
	);
}

export function deactivate(): Thenable<unknown> | undefined {
	// return the thenable so the extension host waits for child-process cleanup before shutdown
	return vscode.commands.executeCommand('bng.process_cleanup');
}
