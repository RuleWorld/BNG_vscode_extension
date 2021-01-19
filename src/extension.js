// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	// console.log('Congratulations, your extension "bng" is now active!');

	const commandName = 'bng.helloWorld';

	function commandHandler() {
		// first we try to grab our terminal and create one if it doesn't exist
		let term = vscode.window.terminals.find(i => i.name == "bngl_term");
		if (term == undefined) {
			term = vscode.window.createTerminal("bngl_term");
		}
		// TODO: Make sure we have perl in our environment or raise an 
		// error 

		// TODO: make sure we have BNGPATH in our terminal environment
		// or raise an error

		// next we make a folder friendly time stamp
		// TODO: Update this, at the moment it just gives the current date in
		// miliseconds
		const fold_name = Date.now().toString();
		// Get workspace URI 
		let curr_workspace_uri = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri).uri;
		// Get folder URI to make the new folder
		let new_fold_uri = vscode.Uri.joinPath(curr_workspace_uri, fold_name);
		// Create new directory 
		vscode.workspace.fs.createDirectory(new_fold_uri);
		// get current file path
		let curr_doc_uri = vscode.window.activeTextEditor.document.uri;
		let copy_path = vscode.Uri.joinPath(new_fold_uri, "test.bngl");
		// vscode.window.showInformationMessage(`copying from: ${curr_doc_uri.toString()} to ${copy_path.toString()}`)
		vscode.workspace.fs.copy(curr_doc_uri, copy_path);
		// TODO: and now we need the terminal to go into that folder
		// and now run perl ${BNGPATH}/BNG2.pl ${CUR_BNGL_FILE}
		term.sendText("perl -v");
		// Done running, let the user know
		vscode.window.showInformationMessage('Done running');
	}
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand(commandName, commandHandler);

	context.subscriptions.push(disposable);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
