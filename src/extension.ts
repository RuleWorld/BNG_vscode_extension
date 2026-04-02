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
		let fname = path.basename(editor.document.fileName);

		const config = vscode.workspace.getConfiguration("bngl");
		const def_folder = config.get<string | null>("general.result_folder");
		let curr_workspace_uri: vscode.Uri;
		if (def_folder) {
			curr_workspace_uri = vscode.Uri.file(def_folder);
		} else {
			curr_workspace_uri = vscode.Uri.file(path.dirname(editor.document.uri.fsPath));
		}

		let fname_noext = fname.replace(".bngl", "");
		const fold_name = get_time_stamped_folder_name();
		let new_fold_uri = vscode.Uri.joinPath(curr_workspace_uri, fname_noext, fold_name);
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
				}).catch(() => {});
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
						try {
							openGdat(new_fold_uri, fname_noext, context);
						} catch (err: any) {
							bngl_channel.appendLine(err);
						}
					}
				}
			}).catch(() => {});
		}
	}

	async function vizCommandHandler() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;
		let fname = path.basename(editor.document.fileName);

		const config = vscode.workspace.getConfiguration("bngl");
		const def_folder = config.get<string | null>("general.result_folder");
		let curr_workspace_uri: vscode.Uri;
		if (def_folder) {
			curr_workspace_uri = vscode.Uri.file(def_folder);
		} else {
			curr_workspace_uri = vscode.Uri.file(path.dirname(editor.document.uri.fsPath));
		}

		let fname_noext = fname.replace(".bngl", "");
		const fold_name = get_time_stamped_folder_name();
		let new_fold_uri = vscode.Uri.joinPath(curr_workspace_uri, fname_noext, fold_name);
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

	async function plotDatCommandHandler() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;
		const config = vscode.workspace.getConfiguration("bngl");

		let fpath = editor.document.fileName;
		let fname = path.basename(fpath);
		let split = fname.split('.');
		let ext = split.pop();
		let fname_noext = split.join('.');
		let outpath = fpath.replace(fname, `${fname_noext}_${ext}.png`);

		vscode.window.showInformationMessage(`Started plotting ${fpath} to ${outpath}`);

		if (config.get<boolean>("general.enable_terminal_runner")) {
			let term = vscode.window.terminals.find(i => i.name === "bngl_term");
			if (!term) {
				term = vscode.window.createTerminal("bngl_term");
			}
			term.show();
			let term_cmd: string;
			if (ext === "gdat" || ext === "scan") {
				term_cmd = `bionetgen -d -req "${PYBNG_VERSION}" plot -i "${fpath}" -o "${outpath}" --legend`;
			} else {
				term_cmd = `bionetgen -d -req "${PYBNG_VERSION}" plot -i "${fpath}" -o "${outpath}"`;
			}
			term.sendText(term_cmd);

			let outUri = vscode.Uri.file(outpath);
			let timeout_mili = 10000;
			checkImage(outpath, timeout_mili).then(() => {
				vscode.window.showInformationMessage(`Done plotting ${fpath} to ${outpath}`);
				vscode.commands.executeCommand('vscode.open', outUri);
			}).catch(() => {
				vscode.window.showInformationMessage(`Plotting didn't finish within ${timeout_mili} miliseconds.`);
			});
		} else {
			let process: Promise<number | null>;
			let term_cmd: string;
			if (ext === "gdat" || ext === "scan") {
				term_cmd = `bionetgen -d -req "${PYBNG_VERSION}" plot -i "${fpath}" -o "${outpath}" --legend`;
				process = spawnAsync('bionetgen', ['-d', '-req', PYBNG_VERSION, 'plot', '-i', fpath, '-o', outpath, '--legend'], bngl_channel, processManager);
			} else {
				term_cmd = `bionetgen -d -req "${PYBNG_VERSION}" plot -i "${fpath}" -o "${outpath}"`;
				process = spawnAsync('bionetgen', ['-d', '-req', PYBNG_VERSION, 'plot', '-i', fpath, '-o', outpath], bngl_channel, processManager);
			}
			bngl_channel.appendLine(term_cmd);

			process.then((exitCode) => {
				if (exitCode) {
					vscode.window.showInformationMessage("Plotting failed, see BNGL output channel for details.");
					bngl_channel.show();
				}
				else {
					vscode.window.showInformationMessage("Done plotting.");
					let outUri = vscode.Uri.file(outpath);
					if (fs.existsSync(outpath)) {
						vscode.commands.executeCommand('vscode.open', outUri);
					} else {
						vscode.window.showInformationMessage("Could not open plot image file, see BNGL output channel for details.");
						bngl_channel.show();
					}
				}
			}).catch(() => {});
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
	context.subscriptions.push(vscode.commands.registerCommand('bng.plot_dat', plotDatCommandHandler));
	context.subscriptions.push(vscode.commands.registerCommand('bng.webview', () => { PlotPanel.create(context.extensionUri) }));
	context.subscriptions.push(vscode.commands.registerCommand('bng.setup', setupCommandHandler));
	context.subscriptions.push(vscode.commands.registerCommand('bng.upgrade', upgradeCommandHandler));
	context.subscriptions.push(vscode.commands.registerCommand('bng.process_cleanup', () => { processManager.killAllProcesses() }));
	context.subscriptions.push(vscode.commands.registerCommand('bng.kill_process', (processObject) => { processManager.killProcess(processObject) }));

	vscode.window.createTreeView('processManagerTreeView', {treeDataProvider: new ProcessManagerProvider(processManager)});
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

function openGdat(new_fold_uri: vscode.Uri, fname_noext: string, context: vscode.ExtensionContext) {
	var files = fs.readdirSync(new_fold_uri.fsPath);
	var outGdatPath;
	for (var i = 0; i < files.length; i++) {
		let fileInfo = files[i].split(".");
		let ext = fileInfo.pop();
		let name = fileInfo.pop();
		if (name === fname_noext && ext === "gdat") {
			outGdatPath = path.join(new_fold_uri.fsPath, files[i]);
			break;
		}
		if (outGdatPath === undefined && ext === "gdat") {
			outGdatPath = path.join(new_fold_uri.fsPath, files[i]);
		}
	}
	if (outGdatPath) {
		let outGdatUri = vscode.Uri.file(outGdatPath);
		vscode.commands.executeCommand('vscode.open', outGdatUri).then(() => {
			PlotPanel.create(context.extensionUri);
		});
	}
}

function checkImage(outpath: string, timeout: number): Promise<void> {
	return new Promise((resolve, reject) => {
		var timer = setTimeout(() => {
			watcher.close();
			reject();
		}, timeout);
		if (fs.existsSync(outpath)) {
			clearTimeout(timer);
			resolve();
			return;
		}
		var dir = path.dirname(outpath);
		var basename = path.basename(outpath);
		var watcher = fs.watch(dir, (eventType, filename) => {
			if (eventType === "rename" && filename === basename) {
				clearTimeout(timer);
				watcher.close();
				resolve();
			}
		});
	});
}

function checkGdat(outpath: string, timeout: number): Promise<void> {
	return new Promise((resolve, reject) => {
		var timer = setTimeout(() => {
			watcher.close();
			reject();
		}, timeout);
		var watcher = fs.watch(outpath, (eventType, filename) => {
			if (!filename) return;
			let ext = filename.split(".").pop();
			if (eventType === "rename" && ext === "gdat") {
				clearTimeout(timer);
				watcher.close();
				resolve();
			}
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
					this._send_figure_data();
					return;
				case 'image':
					this._save_image(message);
					return;
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
				<div id="plot"></div>
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
		const uri = vscode.Uri.joinPath(folder, `${message.title}.${message.type}`);
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
