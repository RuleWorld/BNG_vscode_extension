// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	// TODO: Re-write this as TypeScript and use the compiler instead
	// This line of code will only be executed once when your extension is activated

	const runCommandName = 'bng.run_bngl';
	const plotgdatCommandName = 'bng.plot_gdat';
	const plotcdatCommandName = 'bng.plot_cdat';

	function runCommandHandler() {
		// first we try to grab our terminal and create one if it doesn't exist
		let term = vscode.window.terminals.find(i => i.name == "bngl_term");
		if (term == undefined) {
			term = vscode.window.createTerminal("bngl_term");
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
		let term_cmd = `cd ${new_fold_uri.fsPath}|bionetgen -i ${copy_path.fsPath}`;
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
		let term_cmd = `bionetgen -i ${fpath} -o ${outpath} plot`;
		// focus on the terminal and run the command
		term.show();
		term.sendText(term_cmd);
		let outUri = vscode.Uri.file(outpath);
		checkImage(outpath, 10000).then(() => {
			vscode.window.showInformationMessage(`Done plotting ${fpath} to ${outpath} with exit code`); 		
			vscode.commands.executeCommand('vscode.open', outUri);
		});
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
		let term_cmd = `bionetgen -i ${fpath} -o ${outpath} plot`;
		// focus on the terminal and run the command
		term.show();
		term.sendText(term_cmd);
		// We need to async check if the image exists and if it does
		// we let the user know and open the image
		let outUri = vscode.Uri.file(outpath);
		checkImage(outpath, 10000).then(() => {
			vscode.window.showInformationMessage(`Done plotting ${fpath} to ${outpath} with exit code`); 		
			vscode.commands.executeCommand('vscode.open', outUri);
		});
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
}

/**
 * @param {string} outpath
 * @param {number} [timeout]
 */
function checkImage(outpath, timeout) {
	return new Promise(function (resolve, reject) {
		var timer = setTimeout(function () {
			watcher.close();
			reject(new Error(`Image wasn't plotted within ${timeout} miliseconds`))
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

exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}