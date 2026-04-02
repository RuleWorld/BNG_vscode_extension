import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawnAsync } from './utils/spawnAsync';
import { getPythonPath } from './utils/getPythonPath';
import { ProcessManager, ProcessManagerProvider } from './utils/processManagement';

export function activate(context: vscode.ExtensionContext) {
	const processManager = new ProcessManager();
	const bngl_channel = vscode.window.createOutputChannel("BNGL");

	const config = vscode.workspace.getConfiguration("bngl");
	if (config.get<boolean>("general.auto_install")) {
		bngl_channel.appendLine("Running BNG auto-install ...");
		vscode.commands.executeCommand('bng.setup');
	}

	const PYBNG_VERSION = "0.5.0";

	async function runCommandHandler() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;
		const docUri = editor.document.uri;
		const fname = path.basename(docUri.fsPath);

		const config = vscode.workspace.getConfiguration("bngl");
		const def_folder = config.get<string | null>("general.result_folder");
		let curr_workspace_uri: vscode.Uri;
		if (def_folder) {
			curr_workspace_uri = vscode.Uri.file(def_folder);
		} else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			curr_workspace_uri = vscode.workspace.workspaceFolders[0].uri;
		} else {
			curr_workspace_uri = vscode.Uri.file(path.dirname(docUri.fsPath));
		}

		const fname_noext = fname.endsWith('.bngl') ? fname.slice(0, -5) : fname;
		const fold_name = get_time_stamped_folder_name();
		const new_fold_uri = vscode.Uri.joinPath(curr_workspace_uri, fname_noext, fold_name);
		let copy_path = vscode.Uri.joinPath(new_fold_uri, fname);
		let curr_doc_uri = editor.document.uri;

		await vscode.workspace.fs.createDirectory(new_fold_uri);
		await vscode.workspace.fs.copy(curr_doc_uri, copy_path);

		let term_cmd = `bionetgen -req "${PYBNG_VERSION}" run -i "${copy_path.fsPath}" -o "${new_fold_uri.fsPath}" -l "${new_fold_uri.fsPath}"`;
		vscode.window.showInformationMessage(`Started running ${fname} in folder ${fname_noext}/${fold_name}`);

		if (config.get<boolean>("general.enable_terminal_runner")) {
			let term = vscode.window.terminals.find(i => i.name === "bngl_term");
			if (!term) {
				term = vscode.window.createTerminal("bngl_term");
			}
			term.show();
			term.sendText(term_cmd);

			if (config.get<boolean>("general.auto_open")) {
				let timeout_mili = 120000;
				checkGdat(new_fold_uri.fsPath, timeout_mili).then(() => {
					openGdat(new_fold_uri, fname_noext, context);
				}).catch((err) => {
					bngl_channel.appendLine(`Error auto-opening GDAT: ${err}`);
				});
			}
		} else {
			bngl_channel.appendLine(term_cmd);
			const process = spawnAsync('bionetgen', ['-req', PYBNG_VERSION, 'run', '-i', copy_path.fsPath, '-o', new_fold_uri.fsPath, '-l', new_fold_uri.fsPath], bngl_channel, processManager);
			process.then((exitCode) => {
				if (exitCode) {
					vscode.window.showInformationMessage("Something went wrong, see BNGL output channel for details.");
					bngl_channel.show();
				}
				else {
					vscode.window.showInformationMessage("Finished running successfully.");
					if (config.get<boolean>("general.auto_open")) {
						openGdat(new_fold_uri, fname_noext, context).catch (err => {
							bngl_channel.appendLine(`Error auto-opening GDAT: ${err}`);
						});
					}
				}
			}).catch((err) => {
				bngl_channel.appendLine(`Process execution error: ${err}`);
			});
		}
	}

	async function vizCommandHandler() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;
		const docUri = editor.document.uri;
		const fname = path.basename(docUri.fsPath);

		const config = vscode.workspace.getConfiguration("bngl");
		const def_folder = config.get<string | null>("general.result_folder");
		let curr_workspace_uri: vscode.Uri;
		if (def_folder) {
			curr_workspace_uri = vscode.Uri.file(def_folder);
		} else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			curr_workspace_uri = vscode.workspace.workspaceFolders[0].uri;
		} else {
			curr_workspace_uri = vscode.Uri.file(path.dirname(docUri.fsPath));
		}

		const fname_noext = fname.endsWith('.bngl') ? fname.slice(0, -5) : fname;
		const fold_name = get_time_stamped_folder_name();
		const new_fold_uri = vscode.Uri.joinPath(curr_workspace_uri, fname_noext, fold_name);
		let copy_path = vscode.Uri.joinPath(new_fold_uri, fname);
		let curr_doc_uri = editor.document.uri;

		await vscode.workspace.fs.createDirectory(new_fold_uri);
		await vscode.workspace.fs.copy(curr_doc_uri, copy_path);

		let term_cmd = `bionetgen -req "${PYBNG_VERSION}" visualize -i "${copy_path.fsPath}" -o "${new_fold_uri.fsPath}" -t "all"`;
		vscode.window.showInformationMessage(`Started visualizing ${fname} in folder ${fname_noext}/${fold_name}`);

		if (config.get<boolean>("general.enable_terminal_runner")) {
			let term = vscode.window.terminals.find(i => i.name === "bngl_term");
			if (!term) {
				term = vscode.window.createTerminal("bngl_term");
			}
			term.show();
			term.sendText(term_cmd);
		} else {
			bngl_channel.appendLine(term_cmd);
			const exitCode = await spawnAsync('bionetgen', ['-req', PYBNG_VERSION, 'visualize', '-i', copy_path.fsPath, '-o', new_fold_uri.fsPath, '-t', 'all'], bngl_channel, processManager);
			if (exitCode) {
				vscode.window.showInformationMessage("Something went wrong, see BNGL output channel for details.");
				bngl_channel.show();
			}
			else {
				vscode.window.showInformationMessage("Finished visualizing successfully.");
			}
		}
	}


	async function setupCommandHandler() {
		bngl_channel.appendLine("Checking for perl.");
		const perlCheckExitCode = await spawnAsync('perl', ['-v'], bngl_channel, processManager);

		if (perlCheckExitCode) {
			bngl_channel.appendLine("Could not find perl.");
			vscode.window.showInformationMessage("You must install Perl (https://www.perl.org/get.html). We recommend Strawberry Perl for Windows.");
			bngl_channel.show();
		} else {
			bngl_channel.appendLine("Found perl.");
		}

		bngl_channel.appendLine("Getting python path.");
		const pythonPath = await getPythonPath(bngl_channel);
		bngl_channel.appendLine("Found python path: " + pythonPath);

		bngl_channel.appendLine("Checking for bionetgen.");
		const bngCheckExitCode = await spawnAsync(pythonPath, ['-m', 'pip', 'show', 'bionetgen'], bngl_channel, processManager);

		if (bngCheckExitCode) {
			bngl_channel.appendLine("Installing PyBNG for python: " + pythonPath);
			vscode.window.showInformationMessage("Setting up BNG for the following Python: " + pythonPath);
			const installExitCode = await spawnAsync(pythonPath, ['-m', 'pip', 'install', 'bionetgen', '--upgrade'], bngl_channel, processManager);
			if (installExitCode) {
				bngl_channel.appendLine("pip install failed for python: " + pythonPath);
				vscode.window.showInformationMessage("BNG setup failed, see BNGL output channel for details.");
				bngl_channel.show();
			} else {
				bngl_channel.appendLine("pip install succeeded for python: " + pythonPath);
				vscode.window.showInformationMessage("BNG setup complete.");
			}
		} else {
			bngl_channel.appendLine("Found bionetgen.");
		}
	}

	async function upgradeCommandHandler() {
		bngl_channel.appendLine("Running BNG upgrade ...");
		const pythonPath = await getPythonPath(bngl_channel);
		bngl_channel.appendLine("Found python path: " + pythonPath);
		vscode.window.showInformationMessage("Upgrading BNG for the following Python: " + pythonPath);
		const upgradeExitCode = await spawnAsync(pythonPath, ['-m', 'pip', 'install', 'bionetgen', '--upgrade'], bngl_channel, processManager);
		if (upgradeExitCode) {
			bngl_channel.appendLine("pip upgrade failed for python: " + pythonPath);
			vscode.window.showInformationMessage("BNG upgrade failed, see BNGL output channel for details.");
			bngl_channel.show();
		} else {
			bngl_channel.appendLine("pip upgrade successful for python: " + pythonPath);
			vscode.window.showInformationMessage("BNG upgrade complete.");
		}
	}

	context.subscriptions.push(vscode.commands.registerCommand('bng.run_bngl', runCommandHandler));
	context.subscriptions.push(vscode.commands.registerCommand('bng.run_viz', vizCommandHandler));
	context.subscriptions.push(vscode.commands.registerCommand('bng.plot_dat', () => { PlotPanel.create(context.extensionUri) }));
	context.subscriptions.push(vscode.commands.registerCommand('bng.webview', () => { PlotPanel.create(context.extensionUri) }));
	context.subscriptions.push(vscode.commands.registerCommand('bng.setup', setupCommandHandler));
	context.subscriptions.push(vscode.commands.registerCommand('bng.upgrade', upgradeCommandHandler));
	context.subscriptions.push(vscode.commands.registerCommand('bng.process_cleanup', () => { processManager.killAllProcesses() }));
	context.subscriptions.push(vscode.commands.registerCommand('bng.kill_process', (processObject) => { processManager.killProcess(processObject) }));

	const treeView = vscode.window.createTreeView('processManagerTreeView', {treeDataProvider: new ProcessManagerProvider(processManager)});
	context.subscriptions.push(treeView);
	vscode.commands.executeCommand('setContext', 'bng.processManagerActive', true);

	context.subscriptions.push(
		vscode.languages.registerFoldingRangeProvider({ language: 'bngl' }, {
			provideFoldingRanges(document) {
				const ranges: vscode.FoldingRange[] = [];
				const beginStack: { line: number, name: string }[] = [];

				function normalizeName(name: string) {
					let n = name.trim().toLowerCase();
					n = n.split('#')[0].trim();
					if (n === 'reaction rules' || n === 'rules') return 'rules';
					if (n === 'molecule types' || n === 'molecules') return 'molecules';
					if (n === 'seed species' || n === 'species') return 'species';
					return n;
				}

				for (let i = 0; i < document.lineCount; i++) {
					const lineText = document.lineAt(i).text;
					const trimmed = lineText.trimStart();

					const beginMatch = trimmed.match(/^begin\s+(.+)/i);
					if (beginMatch) {
						const name = normalizeName(beginMatch[1]);
						beginStack.push({ line: i, name: name });
						continue;
					}
					const endMatch = trimmed.match(/^end\s+(.+)/i);
					if (endMatch && beginStack.length > 0) {
						const endName = normalizeName(endMatch[1]);
						for (let j = beginStack.length - 1; j >= 0; j--) {
							if (beginStack[j].name === endName) {
								ranges.push(new vscode.FoldingRange(beginStack[j].line, i, vscode.FoldingRangeKind.Region));
								beginStack.splice(j);
								break;
							}
						}
						continue;
					}

					const metaMatch = trimmed.match(/^#@\w+/);
					if (metaMatch) {
						let endLine = i;
						for (let j = i + 1; j < document.lineCount; j++) {
							const nextTrimmed = document.lineAt(j).text.trimStart();
							if (nextTrimmed.match(/^#@\w+/) || nextTrimmed === '' || !nextTrimmed.startsWith('#')) {
								break;
							}
							endLine = j;
						}
						if (endLine > i) {
							ranges.push(new vscode.FoldingRange(i, endLine, vscode.FoldingRangeKind.Comment));
						}
					}
				}
				return ranges;
			}
		})
	);
}

async function openGdat(new_fold_uri: vscode.Uri, fname_noext: string, context: vscode.ExtensionContext) {
	const files = await vscode.workspace.fs.readDirectory(new_fold_uri);
	let outGdatUri: vscode.Uri | undefined;

	for (const [name, type] of files) {
		if (type !== vscode.FileType.File) continue;

		const ext = path.extname(name).substring(1);
		const base = path.basename(name, path.extname(name));

		if (base === fname_noext && ext === "gdat") {
			outGdatUri = vscode.Uri.joinPath(new_fold_uri, name);
			break;
		}
		if (!outGdatUri && ext === "gdat") {
			outGdatUri = vscode.Uri.joinPath(new_fold_uri, name);
		}
	}

	if (outGdatUri) {
		await vscode.commands.executeCommand('vscode.open', outGdatUri);
		PlotPanel.create(context.extensionUri);
	}
}

function checkGdat(outDir: string, timeout: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			watcher.dispose();
			reject(new Error("Timeout waiting for GDAT"));
		}, timeout);

		const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(outDir, "*.gdat"));
		watcher.onDidCreate(() => {
			clearTimeout(timer);
			watcher.dispose();
			resolve();
		});
	});
}

class PlotPanel {
	public static currentPanels = new Map<string, PlotPanel>();
	public static readonly viewType = "plot";

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, private _fpath: string) {
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
					// The webview is ready, send data.
					this._send_figure_data();
					return;
				case 'image':
					this._save_image(message);
					return;
			}
		}, null, this._disposables);

		// Also send data if the panel becomes visible again
		this._panel.onDidChangeViewState(e => {
			if (this._panel.visible) {
				this._send_figure_data();
			}
		}, null, this._disposables);
	}

	public static create(extensionUri: vscode.Uri) {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		const fpath = editor.document.fileName;
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		if (PlotPanel.currentPanels.has(fpath)) {
			PlotPanel.currentPanels.get(fpath)?._panel.reveal(column);
			return;
		}

		const extension = path.extname(fpath).substring(1);
		let title = "Unknown";
		if (extension === "graphml") title = "GraphML Viewer";
		else if (extension === "gdat" || extension === "cdat") title = "Plot viewer";
		else if (extension === "scan") title = "Scan Plot";

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

		PlotPanel.currentPanels.set(fpath, new PlotPanel(panel, extensionUri, fpath));
	}

	private _setup() {
		const webview = this._panel.webview;
		const nonce = get_nonce();
		const extension = path.extname(this._fpath).substring(1);
		const fname = path.basename(this._fpath, path.extname(this._fpath));

		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
		const plotlyUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'plotly-latest.min.js'));
		const cytoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'cytoscape.min.js'));
		const jqUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'jquery-3.5.1.min.js'));
		const stylesMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

		const folder = path.dirname(this._fpath);

		webview.html = this._get_html(webview, nonce, fname, extension, folder, stylesMainUri, jqUri, cytoUri, plotlyUri, scriptUri);
	}

	private _get_html(webview: vscode.Webview, nonce: string, fname: string, ext: string, folder: string, stylesMainUri: vscode.Uri, jqUri: vscode.Uri, cytoUri: vscode.Uri, plotlyUri: vscode.Uri, scriptUri: vscode.Uri) {
		let content = '';
		if (ext === "graphml") {
			content = `
				<div id="network"></div>
				<div id="top_buttons">
				  <button id="layout_button" class="button" type="button">Redo Layout</button>
				  <button id="png_button" class="button" type="button">Save as PNG</button>
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
					<div class="sidebar-footer">
						<button id="export-png">Export PNG</button>
						<button id="export-svg" class="secondary">Export SVG</button>
					</div>
				</div>
				<div id="plot-container">
					<div id="plot"></div>
				</div>
				<script nonce="${nonce}" src="${jqUri}"></script>
				<script nonce="${nonce}" src="${plotlyUri}"></script>
			`;
		}

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${stylesMainUri}" rel="stylesheet">
			</head>
			<body>
				<div id="page_title" style="display: none;">${fname}_${ext}</div>
				<div id="folder" style="display: none;">${folder}</div>
				${content}
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}

	private _send_figure_data() {
		const ext = path.extname(this._fpath).substring(1);
		const text = fs.readFileSync(this._fpath, 'utf8');
		const config = vscode.workspace.getConfiguration("bngl");

		if (ext === "graphml") {
			this._panel.webview.postMessage({ command: 'network', context: 'data', data: text });
		} else {
			const data = this.parse_dat(text);
			this._panel.webview.postMessage({
				command: 'plot',
				context: 'data',
				names: data[0],
				data: data[1],
				legend: config.get("plotting.legend"),
				max_series: config.get("plotting.max_series_count"),
				menus: config.get("plotting.menus"),
			});
		}
	}

	private parse_dat(text: string): [string[], string[][]] {
		let lines = text.split(/[\n\r]+/).filter(e => e.trim().length > 0);
		let splt_lines = lines.map(w => w.trim().split(/\s+/));
		let names = splt_lines[0].slice(1);
		let data = splt_lines.slice(1);
		let transposed = data[0].map((_, colIndex) => data.map(row => row[colIndex]));
		return [names, transposed];
	}

	private _save_image(message: any) {
		const folder = vscode.Uri.file(message.folder);
		const uri = vscode.Uri.joinPath(folder, `${message.title}_${message.type}.${message.type === 'png' ? 'png' : 'svg'}`);
		let data: Buffer;
		if (message.type === 'png') {
			data = Buffer.from(message.text.replace("data:image/png;base64,", ""), 'base64');
		} else {
			data = Buffer.from(decodeURIComponent(message.text).replace("data:image/svg+xml,", ""));
		}
		vscode.workspace.fs.writeFile(uri, data).then(() => {
			vscode.window.showInformationMessage(`Image saved to ${uri.fsPath}`);
		});
	}

	public dispose() {
		PlotPanel.currentPanels.delete(this._fpath);
		this._panel.dispose();
		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) x.dispose();
		}
	}
}

function get_nonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

function get_time_stamped_folder_name() {
	const date = new Date();
	return `${date.getFullYear()}_${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getDate().toString().padStart(2, '0')}__${date.getHours().toString().padStart(2, '0')}_${date.getMinutes().toString().padStart(2, '0')}_${date.getSeconds().toString().padStart(2, '0')}`;
}

export function deactivate() {
	vscode.commands.executeCommand('bng.process_cleanup');
}
