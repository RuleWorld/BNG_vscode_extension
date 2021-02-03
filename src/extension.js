// Author: Ali Sinan Saglam
// Email: asinansaglam@gmail.com
// Github: https://github.com/ASinanSaglam/

// Extension code heavily inspired by the examples from
// https://github.com/microsoft/vscode-extension-samples
// Webview code heavily modified from
// https://github.com/microsoft/vscode-extension-samples/tree/master/webview-sample

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

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
		// TODO: Wait until it's done
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
	let disposable5 = vscode.commands.registerCommand(webviewCommandName, () => {PlotPanel.create(context.extensionUri)});
	context.subscriptions.push(disposable5);

	if (vscode.window.registerWebviewPanelSerializer) {
		// Make sure we register a serializer in activation event
		vscode.window.registerWebviewPanelSerializer(PlotPanel.viewType, {
			async deserializeWebviewPanel(webviewPanel, state) {
				// Reset the webview options so we use latest uri for `localResourceRoots`.
				webviewPanel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] };
				let fname = vscode.window.activeTextEditor.document.fileName;
				let extension = fname.split(".").pop();
				PlotPanel.revive(webviewPanel, extension);
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
	/** @type {PlotPanel[]} */
	static panels = [];
	/** @type {Number} */
	static cur_planel_id = 0;
	/** @type {String} */
	static viewType = "plot";
	/** @type {vscode.Uri} */
	static _extensionUri;
	/** @type {String[]} */
	static fnames = [];
	/** @type {String[]} */
	static fpaths = [];
	/** @type {String[]} */
	static extensions = [];
	/** @type {String[]} */
	static viewTitles = []
	/**	@type {vscode.WebviewPanel} */
	_panel;
	/**	@type {String} */
	_ext;
	/**	@type {String} */
	_text;
	/**	@type {String} */
	_name;
	/**	@type {Boolean} */
	_visible = false;
	/** @type {any} */
	_data = undefined;
	/** @type {vscode.Disposable[]} */
	_disposables = [];
	/** @type {String} */
	_nonce;
	/** @type {vscode.Uri} */
	scriptUri;
	/** @type {vscode.Uri} */
	plotlyUri;
	/** @type {vscode.Uri} */
	cytoUri
	/** @type {vscode.Uri} */
	cytoGMLUri;
	/** @type {vscode.Uri} */
	jqUri
	/** @type {vscode.Uri} */
	stylesMainUri

	/**
	 * Tracks plot panel
	 * @param {vscode.WebviewPanel} panel
	 * @param {String} extension
	 * @param {String} text
	 */
	constructor (panel, extension, text) {
		// set our stuff
		this._panel = panel;
		this._ext = extension;
		this._text = text;
		this._name = PlotPanel.get_current_name();
		// initial html
		this._setup();
		// listen to dispose
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
		// // Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				if (this._panel.visible && !this._visible) {
					this._visible = true;
					// this._show();
				} else if (!this._panel.visible && this._visible) {
					this._visible = false;
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
						vscode.window.showInformationMessage(message.text);
						return;
					case 'refresh':
						this._show();
						return;
				}
			},
			null,
			this._disposables
		);
	} 

	/**
	 * 
	 * @param {vscode.WebviewPanel} panel 
	 * @param {String} extension 
	 */
	static revive(panel, extension) {
		// get current text
		let text = vscode.window.activeTextEditor.document.getText();
		PlotPanel.panels.push(new PlotPanel(panel, extension, text))
	}

	_setup() {
		// set nonce 
		this._nonce = get_nonce();

		// get webview to pass to set_html functions
		const webview = this._panel.webview;
		
		// Local path to main script run in the webview
		const scriptPathOnDisk = vscode.Uri.joinPath(PlotPanel._extensionUri, 'media', 'main.js');
		// And the uri we use to load this script in the webview
		this.scriptUri = webview.asWebviewUri(scriptPathOnDisk);
		// Local path to main script run in the webview
		const plotlyOnDisk = vscode.Uri.joinPath(PlotPanel._extensionUri, 'media', 'plotly-latest.min.js');
		// And the uri we use to load this script in the webview
		this.plotlyUri = webview.asWebviewUri(plotlyOnDisk);
		// Local path to main script run in the webview
		const cytoOnDisk = vscode.Uri.joinPath(PlotPanel._extensionUri, 'media', 'cytoscape.min.js');
		const cytoGMLOnDisk = vscode.Uri.joinPath(PlotPanel._extensionUri, 'media', 'cytoscape-graphml.js');
		const jqOnDisk = vscode.Uri.joinPath(PlotPanel._extensionUri, 'media', 'jquery-3.5.1.min.js');
		// And the uri we use to load this script in the webview
		this.cytoUri = webview.asWebviewUri(cytoOnDisk);
		this.cytoGMLUri = webview.asWebviewUri(cytoGMLOnDisk);
		this.jqUri = webview.asWebviewUri(jqOnDisk);
		// Local path to css styles
		const stylesPathMainPath = vscode.Uri.joinPath(PlotPanel._extensionUri, 'media', 'main.css');
		// Uri to load styles into webview
		this.stylesMainUri = webview.asWebviewUri(stylesPathMainPath);
		// set visibility to figure out updates
		this._visible = true;
		// content depends on the extension
		this._panel.title = `${this._ext}/${this._name}`;
		this._show();
	}

	_show() {
		// get webview to pass to set_html functions
		const webview = this._panel.webview;
		// content depends on the extension
		switch (this._ext) {
			case "gml":
				this._set_gml(webview);
				return;
			case "gdat":
			case "cdat":
			case "scan":
				this._set_plot(webview);
				return;
		}
	}

	/**
	 * 
	 * @param {vscode.Webview} webview 
	 */
	_set_gml(webview) {
		
		// Local path to css styles
		// const styleResetPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css');
		const stylesPathMainPath = vscode.Uri.joinPath(PlotPanel._extensionUri, 'media', 'main.css');

		// Uri to load styles into webview
		//const stylesResetUri = webview.asWebviewUri(styleResetPath);
		const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);
		
		// Finally set the HTML
		webview.html = `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" style-src ${webview.cspSource}; script-src 'nonce-${this._nonce}';>
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${this.stylesMainUri}" rel="stylesheet">
				<title>GML viewer</title>
			</head>
			<body>
				<h1 id="head">${this._ext}/${this._name}</h1>
				<div id="network"></div>
				<script nonce="${this._nonce}" src="${this.jqUri}" type="text/javascript"></script>
				<script nonce="${this._nonce}" src="${this.cytoUri}" type="text/javascript"></script>
				<script nonce="${this._nonce}" src="${this.scriptUri}" type="text/javascript"></script>
			</body>
			</html>`;

		// now we'll parse the editor text and turn it into a 
		// data format we can pass along to the webview that's open
		webview.postMessage({
			command: 'network',
			context: 'data',
			data: this._load_gml(this._text)
		});
	}
	
	_load_gml(text) {
		return JSON.parse(text)
	}

	/**
	 * 
	 * @param {vscode.Webview} webview 
	 */
	_set_plot(webview) {		
		// Finally set the HTML
		webview.html = `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" style-src ${webview.cspSource}; script-src 'nonce-${this._nonce}';>
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${this.stylesMainUri}" rel="stylesheet">
				<title>Plotly viewer</title>
			</head>
			<body>
				<div id="head_div"><h1 id="head">${this._ext}/${this._name}</h1></div>
				<div id="plot"></div>
				<div id="top_buttons">
				<button id="refresh_button" class="button" type="button">Refresh</button>
				</div>
				<script nonce="${this._nonce}" src="${this.jqUri}" type="text/javascript"></script>
				<script nonce="${this._nonce}" src="${this.plotlyUri}" type="text/javascript"></script>
				<script nonce="${this._nonce}" src="${this.scriptUri}" type="text/javascript"></script>
			</body>
			</html>`;
		// now we'll parse the editor text and turn it into a 
		// data format we can pass along to the webview that's open
		if (this._data == undefined) {
			this._data =  this.parse_dat(this._text);
		} 

		webview.postMessage({
			command: 'plot',
			context: 'data',
			names: this._data[0],
			data: this._data[1]
		});
	}

	/**
	 * 
	 * @param {String} text 
	 */
	parse_dat(text) {
		// we want to split the newlines
		let lines = text.split(/([\n\r])/).filter( e => e.trim().length > 0 );
		// and we want to split by the whitespace and remove 
		// any element that's pure whitespace so we are left with 
		// just the numbers
		let splt_lines = lines.map(
			w => w.split(/(\s+)/).filter(
				e => e.trim().length > 0
			)
		);
		// we now will take each column and return the data for each 
		// name such that name[0] and data[0] is the name of the x
		// axis and name[1:] and data[1:] are the rest 
		let names = splt_lines[0].slice(1,splt_lines[0].length);
		let data = splt_lines.slice(1,splt_lines.length);
		data = 	data[0].map(
			(_,colIndex) => data.map(row => row[colIndex])
		);
		return [names,data];
	}

	dispose() {
		// clear panel
		this._panel = undefined;
		// clean up
		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	// public methods to get current values of certain variables
	static get_current_panel() {
		return PlotPanel.panels[PlotPanel.cur_planel_id]
	}

	static get_current_title() {
		return PlotPanel.viewTitles[PlotPanel.cur_planel_id]
	}

	static get_current_extension() {
		return PlotPanel.extensions[PlotPanel.cur_planel_id]
	}

	static get_current_path() {
		return PlotPanel.fpaths[PlotPanel.cur_planel_id]
	}

	static get_current_name() {
		return PlotPanel.fnames[PlotPanel.cur_planel_id]
	}

	/**
	 * 
	 * @param {vscode.Uri} extensionUri 
	 */
	static create(extensionUri) {
		// set extensionUri
		PlotPanel._extensionUri = extensionUri;
		// we want to pop open a new tab on the side
		let column = vscode.ViewColumn.Beside;
		// we want the extension to determine the type of 
		// file we want to write
		let fpath = vscode.window.activeTextEditor.document.fileName;
		let extension = fpath.split(".").pop();
		let title = "Unknown";
		if (extension == "gml") {
			title = "GML Viewer";
		} else if (extension == "gdat" || extension == "cdat") {
			title = "Plot viewer";
		} else if (extension == "scan") {
			title = "Scan Plot";
		}
		// TODO: this is a hack to find basename, find where
		// the real basename function is that works with URIs
		let li_u = fpath.lastIndexOf('/')+1;
		let li_w = fpath.lastIndexOf('\\')+1;
		let li_f = Math.max(li_u,li_w);
		let name = fpath.substring(li_f);
		let fname = name.replace("."+extension, "");
		// add to our lists
		PlotPanel.extensions.push(extension);
		PlotPanel.viewTitles.push(title);
		PlotPanel.fpaths.push(fpath);
		PlotPanel.fnames.push(fname);
		// create panel
		const panel = vscode.window.createWebviewPanel(
			PlotPanel.viewType,
			PlotPanel.get_current_title(),
			column || vscode.ViewColumn.Beside,
			{ enableScripts: true, 
			  localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
			  retainContextWhenHidden: true
			}
		);
		// get current text
		let text = vscode.window.activeTextEditor.document.getText();
		// add the panel to our list
		let new_panel = new PlotPanel(panel, extension, text);
		PlotPanel.panels.push(new_panel);
		PlotPanel.cur_planel_id += 1;
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

exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
