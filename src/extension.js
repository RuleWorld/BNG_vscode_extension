// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const { setFlagsFromString } = require('v8');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	// TODO: Re-write this as TypeScript and use the compiler instead
	// This line of code will only be executed once when your extension is activated

	const runCommandName      = 'bng.run_bngl';
	const plotgdatCommandName = 'bng.plot_gdat';
	const plotcdatCommandName = 'bng.plot_cdat';
	const plotscanCommandName = 'bng.plot_scan';
	const webviewCommandName = 'bng.webview';

	function runCommandHandler() {
		// first we try to grab our terminal and create one if it doesn't exist
		// TOOD: Instantiate terminal appropriately depending on the OS 
		// you can get the OS via os.platform(). Options are:
		// linux/win32/darwin
		let term = vscode.window.terminals.find(i => i.name == "bngl_term");
		if (term == undefined) {
			let plt = os.platform();
			if (plt.toString() == "win32") {
				term = vscode.window.createTerminal("bngl_term");
			} else if (plt.toString() == "linux") {
				term = vscode.window.createTerminal("bngl_term");
			} else if (plt.toString() == "darwin") {
				term = vscode.window.createTerminal("bngl_term");
			} else {
				vscode.window.showInformationMessage(`OS ${plt} is not supported, using default terminal options`);
				term = vscode.window.createTerminal("bngl_term");
			}
		}
		// next we make a folder friendly time stamp
		const date = new Date();
		const year = date.getFullYear();
		const month = `${date.getMonth() + 1}`.padStart(2, '0');
		const day =`${date.getDate()}`.padStart(2, '0');
		const fold_name = `${year}_${month}_${day}_${date.getHours()}_${date.getMinutes()}`
		// Get workspace URI
		let curr_workspace_uri = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri).uri;
		// find basename of the file we are working with
		let fname = vscode.window.activeTextEditor.document.fileName;
		// TODO: this is a hack to find basename, find where
		// the real basename function is that works with URIs
		let li_u = fname.lastIndexOf('/')+1;
		let li_w = fname.lastIndexOf('\\')+1;
		let li_f = Math.max(li_u,li_w);
		fname = fname.substring(li_f);
		let fname_noext = fname.replace(".bngl", "");
		// Get folder URI to make the new folder
		let new_fold_uri = vscode.Uri.joinPath(curr_workspace_uri, fname_noext, fold_name);
		// Create new directory 
		vscode.workspace.fs.createDirectory(new_fold_uri);
		// get current file path
		let curr_doc_uri = vscode.window.activeTextEditor.document.uri;
		// set the path to be copied to
		let copy_path = vscode.Uri.joinPath(new_fold_uri, fname);
		// copy the file into our new folder
		vscode.workspace.fs.copy(curr_doc_uri, copy_path);
		// set the terminal command we want to run
		let term_cmd = `bionetgen run -i ${copy_path.fsPath} -o ${new_fold_uri.fsPath}`;
		// focus on the terminal and run the command
		term.show();
		term.sendText(term_cmd);
		// Done running, let the user know
		vscode.window.showInformationMessage(`Done running ${fname} in folder ${fname_noext}/${fold_name}`);
	}
	function plotgdatCommandHandler() {
		let term = vscode.window.terminals.find(i => i.name == "bngl_term");
		if (term == undefined) {
			term = vscode.window.createTerminal("bngl_term");
		}
		// find basename of the file we are working with
		let fpath = vscode.window.activeTextEditor.document.fileName;
		// TODO: this is a hack to find basename, find where
		// the real basename function is that works with URIs
		let li_u = fpath.lastIndexOf('/')+1;
		let li_w = fpath.lastIndexOf('\\')+1;
		let li_f = Math.max(li_u,li_w);
		let fname = fpath.substring(li_f);
		let fname_noext = fname.replace(".gdat", "");
		// set the path to be copied to
		let outpath = fpath.replace(fname, `${fname_noext}_gdat.png`);
		// set the terminal command we want to run
		let term_cmd = `bionetgen plot -i ${fpath} -o ${outpath} --legend`;
		// focus on the terminal and run the command
		term.show();
		term.sendText(term_cmd);
		let outUri = vscode.Uri.file(outpath);
		let timeout_mili = 10000;

		checkImage(outpath, timeout_mili).then(() => {
			vscode.window.showInformationMessage(`Done plotting ${fpath} to ${outpath} with exit code`); 		
			vscode.commands.executeCommand('vscode.open', outUri);
		}).catch(() => {
				vscode.window.showInformationMessage(`Plotting didn't finish within ${timeout_mili} miliseconds`); 			
			}
		);
	}
	function plotcdatCommandHandler() {
		let term = vscode.window.terminals.find(i => i.name == "bngl_term");
		if (term == undefined) {
			term = vscode.window.createTerminal("bngl_term");
		}
		// find basename of the file we are working with
		let fpath = vscode.window.activeTextEditor.document.fileName;
		// TODO: this is a hack to find basename, find where
		// the real basename function is that works with URIs
		let li_u = fpath.lastIndexOf('/')+1;
		let li_w = fpath.lastIndexOf('\\')+1;
		let li_f = Math.max(li_u,li_w);
		let fname = fpath.substring(li_f);
		let fname_noext = fname.replace(".cdat", "");
		// set the path to be copied to
		let outpath = fpath.replace(fname, `${fname_noext}_cdat.png`);
		// set the terminal command we want to run
		let term_cmd = `bionetgen plot -i ${fpath} -o ${outpath}`;
		// focus on the terminal and run the command
		term.show();
		term.sendText(term_cmd);
		// We need to async check if the image exists and if it does
		// we let the user know and open the image
		let outUri = vscode.Uri.file(outpath);
		let timeout_mili = 10000;
		checkImage(outpath, timeout_mili).then(() => {
			vscode.window.showInformationMessage(`Done plotting ${fpath} to ${outpath} with exit code`); 		
			vscode.commands.executeCommand('vscode.open', outUri);
		}).catch(() => {
				vscode.window.showInformationMessage(`Plotting didn't finish within ${timeout_mili} miliseconds`); 			
			}
		);
	}
	function plotscanCommandHandler() {
		let term = vscode.window.terminals.find(i => i.name == "bngl_term");
		if (term == undefined) {
			term = vscode.window.createTerminal("bngl_term");
		}
		// find basename of the file we are working with
		let fpath = vscode.window.activeTextEditor.document.fileName;
		// TODO: this is a hack to find basename, find where
		// the real basename function is that works with URIs
		let li_u = fpath.lastIndexOf('/')+1;
		let li_w = fpath.lastIndexOf('\\')+1;
		let li_f = Math.max(li_u,li_w);
		let fname = fpath.substring(li_f);
		let fname_noext = fname.replace(".scan", "");
		// set the path to be copied to
		let outpath = fpath.replace(fname, `${fname_noext}_scan.png`);
		// set the terminal command we want to run
		let term_cmd = `bionetgen plot -i ${fpath} -o ${outpath} --legend`;
		// focus on the terminal and run the command
		term.show();
		term.sendText(term_cmd);
		let outUri = vscode.Uri.file(outpath);
		let timeout_mili = 10000;

		checkImage(outpath, timeout_mili).then(() => {
			vscode.window.showInformationMessage(`Done plotting ${fpath} to ${outpath} with exit code`); 		
			vscode.commands.executeCommand('vscode.open', outUri);
		}).catch(() => {
				vscode.window.showInformationMessage(`Plotting didn't finish within ${timeout_mili} miliseconds`); 			
			}
		);
	}
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable1 = vscode.commands.registerCommand(runCommandName, runCommandHandler);
	context.subscriptions.push(disposable1);
	let disposable2 = vscode.commands.registerCommand(plotgdatCommandName, plotgdatCommandHandler);
	context.subscriptions.push(disposable2);
	let disposable3 = vscode.commands.registerCommand(plotcdatCommandName, plotcdatCommandHandler);
	context.subscriptions.push(disposable3);
	let disposable4 = vscode.commands.registerCommand(plotscanCommandName, plotscanCommandHandler);
	context.subscriptions.push(disposable4);
	let disposable5 = vscode.commands.registerCommand(webviewCommandName, PlotPanel.createOrShow);
	context.subscriptions.push(disposable5);

	if (vscode.window.registerWebviewPanelSerializer) {
		// Make sure we register a serializer in activation event
		vscode.window.registerWebviewPanelSerializer(PlotPanel.viewType, {
			async deserializeWebviewPanel(webviewPanel, state) {
				console.log(`Got state: ${state}`);
				// Reset the webview options so we use latest uri for `localResourceRoots`.
				webviewPanel.webview.options = { enableScripts: true };
				PlotPanel.revive(webviewPanel, ".gml");
			}
		});
	}
}

/**
 * @param {string} outpath
 * @param {number} [timeout]
 */
function checkImage(outpath, timeout) {
	return new Promise(function (resolve, reject) {
		var timer = setTimeout(function () {
			watcher.close();
			reject();
		}, timeout);

		fs.access(outpath, fs.constants.F_OK, function (err) {
			if (!err) {
				clearTimeout(timer);
				watcher.close();
				resolve();
			}
		});
		var dir = path.dirname(outpath);
		var basename = path.basename(outpath);
		var watcher = fs.watch(dir, function (eventType, filename) {
			if (eventType == "rename" && filename == basename) {
				clearTimeout(timer);
				watcher.close();
				resolve();
			}
		});
	}
	)
}

class PlotPanel {
	/** @type {PlotPanel} */
	static cur_panel;
	/** @type {String} */
	static viewType = "plot";
	/** @type {vscode.WebviewPanel} */
	_panel;
	/** @type {String} */
	cur_ext;
	/** @type {String} */
	viewTitle;
	/** @type {vscode.Disposable[]} */
	_disposables = [];

	/**
	 * Tracks plot panel
	 * @param {vscode.WebviewPanel} panel
	 * @param {String} extension
	 */
	constructor (panel, extension) {
		// setting current panel and extension
		this._panel = panel;
		this._cur_ext = extension;
		// decide on type and title depending on extension
		if (extension == "gml") {
			this.viewTitle = "GML viewer";
		} else if (extension == "gdat" || extension == "cdat" || extension == "scan") {
			this.viewTitle = "Plot viewer";
		} else {
			this.viewTitle = "Undefined plot";
		}
		// initial html
		this._update();
		// listen to dispose
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				if (this._panel.visible) {
					this._update();
				}
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
				}
			},
			null,
			this._disposables
		);
	} 

	static revive(panel, extension) {
		PlotPanel.cur_panel = new PlotPanel(panel, extension)
	}

	_update() {
		const webview = this._panel.webview;
		// content depends on the extension
		switch (this._cur_ext) {
			case "gml":
				this._set_gml(webview);
				return;
			case "plot":
				this._set_plot(webview);
				return;
		}
	}

	_set_gml(webview) {
		webview.html = `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<title>GML Viewer</title>
		</head>
		<body>
			<h1 id="GML">We will show a network plot here</h1>
		</body>
		</html>`;
	}

	_set_plot(webwview) {
		webwview.html
		return;
	}

	dispose() {
		PlotPanel.cur_panel = undefined;
		// clean up
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	static createOrShow() {
		// we want to pop open a new tab on the side
		let column = vscode.ViewColumn.Beside;
		// we want the extension to determine the type of 
		// html we want to write
		let fname = vscode.window.activeTextEditor.document.fileName;
		let extension = fname.split(".").pop();

		if (PlotPanel.cur_panel) {
			PlotPanel.cur_panel._panel.reveal(column);
			return;
		}
		const panel = vscode.window.createWebviewPanel(
			PlotPanel.viewType,
			"GML Viewer",
			column || vscode.ViewColumn.Beside,
			{ enableScripts: true }
		);

		PlotPanel.cur_panel = new PlotPanel(panel, extension)
	}
}
/*
function webviewCommandHandler() {
	// let panel = vscode.window.createWebviewPanel();
	const panel = vscode.window.createWebviewPanel(
		"gmlTesting",
		"GML TEST",
		vscode.ViewColumn.One,
		{ enableScripts: true }
	);
	panel.webview.html = `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<title>Cat Coding</title>
	</head>
	<body>
		<h1 id="lines-of-code-counter">0</h1>
	</body>
	</html>`
}
*/

exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
