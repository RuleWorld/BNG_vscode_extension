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
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnAsync } = require('./utils/spawnAsync.js');
const { getPythonPath } = require('./utils/getPythonPath.js');
const { ProcessManager, ProcessManagerProvider } = require('./utils/processManagement.js');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	// TODO: Re-write this as TypeScript and use the compiler instead

	// Initialize process manager
	var processManager = new ProcessManager();

	// Get an ouput channel
	var bngl_channel = vscode.window.createOutputChannel("BNGL");

	// Check if the auto-setup configuration option is turned on
	var config = vscode.workspace.getConfiguration("bngl");
	if (config.general.auto_install) {
		bngl_channel.appendLine("Running BNG auto-install ...");
		vscode.commands.executeCommand('bng.setup');
	}

	let PYBNG_VERSION = "0.5.0"

	// function that deals with running bngl files
	async function runCommandHandler() {
		// find basename of the file we are working with
		let fname = vscode.window.activeTextEditor.document.fileName;
		fname = path.basename(fname);

		// pull configuration
		var config = vscode.workspace.getConfiguration("bngl");
		// always dump the results in the same folder as the bngl
		// unless the user has specified a folder in settings
		let def_folder = config.general.result_folder;
		if (def_folder != null) {
			// Gets the folder defined in configuration
			var curr_workspace_uri = vscode.Uri.file(def_folder);
		} else {
			// Gets the folder the file is in and uses that for results
			var curr_workspace_uri = vscode.Uri.file(vscode.window.activeTextEditor.document.uri.fsPath.replace(fname, ""));
		}

		// remove extension of file (TODO: check to make sure extension exists)
		let fname_noext = fname.replace(".bngl", "");
		// get folder URI to make the new folder
		const fold_name = get_time_stamped_folder_name();
		let new_fold_uri = vscode.Uri.joinPath(curr_workspace_uri, fname_noext, fold_name);
		// set the path to be copied to
		let copy_path = vscode.Uri.joinPath(new_fold_uri, fname);
		// get current file path
		let curr_doc_uri = vscode.window.activeTextEditor.document.uri;

		// create new directory and copy the file into our new folder
		// FIXME: if a file of the same name as the folder exists
		// this command fails to run. At least let the user know
		await vscode.workspace.fs.createDirectory(new_fold_uri);
		await vscode.workspace.fs.copy(curr_doc_uri, copy_path);

		// run bngl file as specified in term_cmd
		let term_cmd = `bionetgen -req "${PYBNG_VERSION}" run -i "${copy_path.fsPath}" -o "${new_fold_uri.fsPath}" -l "${new_fold_uri.fsPath}"`;
		// let the user know it is running
		vscode.window.showInformationMessage(`Started running ${fname} in folder ${fname_noext}/${fold_name}`);
		// use either terminal or spawn depending on user setting
		if (config.general.enable_terminal_runner) {
			// first we try to grab our terminal and create one if it doesn't exist
			let term = vscode.window.terminals.find(i => i.name == "bngl_term");
			if (term == undefined) {
				term = vscode.window.createTerminal("bngl_term");
			}
			// focus on the terminal and run the command
			term.show();
			term.sendText(term_cmd);

			// if auto_open setting is enabled, try to open a gdat file
			if (config.general.auto_open) {
				// start a watcher
				let timeout_mili = 120000;
				checkGdat(new_fold_uri.fsPath, timeout_mili).then(() => {
					// we have a gdat in our folder, grab one and open
					openGdat();
				}).catch(() => {
					// if checkGdat() cannot find a gdat file before timeout, do nothing
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
	
					// if auto_open setting is enabled, try to open a gdat file
					if (config.general.auto_open) {
						try {
							openGdat();
						}
						catch (err) {
							// in case reading from the new directory fails
							bngl_channel.appendLine(err);
						}
					}
				}
			}).catch(() => {
				// this promise is not expected to ever reject, even if exitCode is nonzero (see spawnAsync.js)
			});
		}

		// look for & open a gdat file
		// (preferably model_name.gdat, if that doesn't exist then use first gdat found)
		function openGdat() {
			var files = fs.readdirSync(new_fold_uri.fsPath); // read from new directory
			var outGdatPath;
			// look for gdat file
			for (var i = 0; i < files.length; i++) {
				let fileInfo = files[i].split("."); // array containing filename, extension
				let ext = fileInfo.pop();
				let name = fileInfo.pop();
				// if it exists, save the path of model_name.gdat
				if (name == fname_noext && ext == "gdat") {
					outGdatPath = path.join(new_fold_uri.fsPath, files[i]);
					break
				}
				// otherwise, save the path of the first gdat found and keep looking for model_name.gdat
				if (outGdatPath == undefined && ext == "gdat") {
					outGdatPath = path.join(new_fold_uri.fsPath, files[i]);
				}
			}
			// check if gdat file was found & open it if so
			if (typeof outGdatPath !== 'undefined' && outGdatPath) {
				let outGdatUri = vscode.Uri.file(outGdatPath);
				// should open in webview
				vscode.commands.executeCommand('vscode.open', outGdatUri).then(() => {
					PlotPanel.create(context.extensionUri);
					// might be nice to only show the webview and not the gdat itself?
					// not sure if it's possible to open webview without having the gdat open
					// or how to close the gdat tab after it's no longer the active one
				});
			}
			else {
				bngl_channel.appendLine("Did not auto-open gdat file.");
			}
		}
	}

	// function that deals with visualizing bngl files
	async function vizCommandHandler() {
		// find basename of the file we are working with
		let fname = vscode.window.activeTextEditor.document.fileName;
		fname = path.basename(fname);

		// pull configuration
		var config = vscode.workspace.getConfiguration("bngl");
		// always dump the results in the same folder as the bngl
		// unless the user has specified a folder in settings
		let def_folder = config.general.result_folder;
		if (def_folder != null) {
			// Gets the folder defined in configuration
			var curr_workspace_uri = vscode.Uri.file(def_folder);
		} else {
			// Gets the folder the file is in and uses that for results
			var curr_workspace_uri = vscode.Uri.file(vscode.window.activeTextEditor.document.uri.fsPath.replace(fname, ""));
		}
		
		// remove extension of file (TODO: check to make sure extension exists)
		let fname_noext = fname.replace(".bngl", "");
		// get folder URI to make the new folder
		const fold_name = get_time_stamped_folder_name();
		let new_fold_uri = vscode.Uri.joinPath(curr_workspace_uri, fname_noext, fold_name);
		// set the path to be copied to
		let copy_path = vscode.Uri.joinPath(new_fold_uri, fname);
		// get current file path
		let curr_doc_uri = vscode.window.activeTextEditor.document.uri;
		
		// Create new directory and copy the file into our new folder
		// FIXME: if a file of the same name as the folder exists
		// this command fails to run. At least let the user know
		await vscode.workspace.fs.createDirectory(new_fold_uri);
		await vscode.workspace.fs.copy(curr_doc_uri, copy_path);

		// run visualization as specified in term_cmd
		let term_cmd = `bionetgen -req "${PYBNG_VERSION}" visualize -i "${copy_path.fsPath}" -o "${new_fold_uri.fsPath}" -t "all"`;
		// let the user know it is running
		vscode.window.showInformationMessage(`Started visualizing ${fname} in folder ${fname_noext}/${fold_name}`);
		// use either terminal or spawn depending on user setting
		if (config.general.enable_terminal_runner) {
			// first we try to grab our terminal and create one if it doesn't exist
			let term = vscode.window.terminals.find(i => i.name == "bngl_term");
			if (term == undefined) {
				term = vscode.window.createTerminal("bngl_term");
			}
			// focus on the terminal and run the command
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

	// one function for plotting gdat/cdat/scan files
	async function plotDatCommandHandler() {
		// pull configuration
		var config = vscode.workspace.getConfiguration("bngl");
		
		// find basename of the file we are working with
		let fpath = vscode.window.activeTextEditor.document.fileName;
		let fname = path.basename(fpath);
		// get extension 
		let split = fname.split('.');
		let ext = split.pop();
		// filename without the extension
		let fname_noext = split.join('.');
		// set the path to be copied to
		let outpath = fpath.replace(fname, `${fname_noext}_${ext}.png`);
		
		// run plotting as specified in term_cmd (set below, depends on extension of file)
		let term_cmd;
		// let the user know it is running
		vscode.window.showInformationMessage(`Started plotting ${fpath} to ${outpath}`);
		// use either terminal or spawn depending on user setting
		if (config.general.enable_terminal_runner) {
			// first we try to grab our terminal and create one if it doesn't exist
			let term = vscode.window.terminals.find(i => i.name == "bngl_term");
			if (term == undefined) {
				term = vscode.window.createTerminal("bngl_term");
			}
			// focus on the terminal and run the command
			term.show();
			if (ext == "gdat" || ext == "scan") {
				term_cmd = `bionetgen -d -req "${PYBNG_VERSION}" plot -i "${fpath}" -o "${outpath}" --legend`;
				term.sendText(term_cmd);
			} else {
				term_cmd = `bionetgen -d -req "${PYBNG_VERSION}" plot -i "${fpath}" -o "${outpath}"`;
				term.sendText(term_cmd);
			}

			// let's check to see if our image file is created within 10s & open it if so
			let outUri = vscode.Uri.file(outpath);
			let timeout_mili = 10000;
			checkImage(outpath, timeout_mili).then(() => {
				vscode.window.showInformationMessage(`Done plotting ${fpath} to ${outpath}`);
				vscode.commands.executeCommand('vscode.open', outUri);
			}).catch(() => {
				vscode.window.showInformationMessage(`Plotting didn't finish within ${timeout_mili} miliseconds.`);
			});
		} else {
			let process;
			if (ext == "gdat" || ext == "scan") {
				term_cmd = `bionetgen -d -req "${PYBNG_VERSION}" plot -i "${fpath}" -o "${outpath}" --legend`;
				process = spawnAsync('bionetgen', ['-d', '-req', PYBNG_VERSION, 'plot', '-i', fpath, '-o', outpath, '--legend'], bngl_channel, processManager);
			} else {
				term_cmd = `bionetgen -d -req "${PYBNG_VERSION}" plot -i "${fpath}" -o "${outpath}"`;
				process = spawnAsync('bionetgen', ['-d', '-req', PYBNG_VERSION, 'plot', '-i', fpath, '-o', outpath], bngl_channel, processManager);
			}
			bngl_channel.appendLine(term_cmd);

			// once plotting process has closed, check whether the image file has been created & open it if so
			process.then((exitCode) => {
				if (exitCode) {
					vscode.window.showInformationMessage("Plotting failed, see BNGL output channel for details.");
					bngl_channel.show();
				}
				else {
					vscode.window.showInformationMessage("Done plotting.");

					// try to open image file
					let outUri = vscode.Uri.file(outpath);
					fs.access(outpath, fs.constants.F_OK, function (err) {
						if (!err) {
							vscode.commands.executeCommand('vscode.open', outUri);
						}
						else {
							bngl_channel.appendLine(err.toString());
							vscode.window.showInformationMessage("Could not open plot image file, see BNGL output channel for details.");
							bngl_channel.show();
						}
					});
				}
			}).catch(() => {
				// this promise is not expected to ever reject, even if exitCode is nonzero (see spawnAsync.js)
			});
		}
	}

	// command to handle installation of bionetgen
	// called when extension is activated
	async function setupCommandHandler() {
		bngl_channel.appendLine("Checking for perl.");
		const perlCheckExitCode = await spawnAsync('perl', ['-v'], bngl_channel, processManager);
		
		// if perl is not installed (exit code is not 0), tell user to install it
		if (perlCheckExitCode) {
			bngl_channel.appendLine("Could not find perl.");
			vscode.window.showInformationMessage("You must install Perl (https://www.perl.org/get.html). We recommend Strawberry Perl for Windows. We recommend Strawberry Perl (https://strawberryperl.com/) for Windows.");
			bngl_channel.show();
		}
		else {
			bngl_channel.appendLine("Found perl.");
		}

		bngl_channel.appendLine("Getting python path.");
		const pythonPath = await getPythonPath(bngl_channel);
		// if getPythonPath() cannot find a particular path to python, it will log the reason to bngl_channel and return "python" by default
		bngl_channel.appendLine("Found python path: " + pythonPath);

		bngl_channel.appendLine("Checking for bionetgen.");
		const bngCheckExitCode = await spawnAsync(pythonPath, ['-m', 'pip', 'show', 'bionetgen'], bngl_channel, processManager);
		// if spawnAsync() cannot run the python at pythonPath, it will log an error to bngl_channel
		
		// if bionetgen is not installed (exit code is not 0), proceed with setup
		// note that this will also run (and fail) if there is an issue running the python at pythonPath
		if (bngCheckExitCode) {
			bngl_channel.appendLine("Installing PyBNG for python: " + pythonPath);
			vscode.window.showInformationMessage("Setting up BNG for the following Python: " + pythonPath);
			
			// spawn child process to run pip install
			const installExitCode = await spawnAsync(pythonPath, ['-m', 'pip', 'install', 'bionetgen', '--upgrade'], bngl_channel, processManager);
			
			if (installExitCode) {
				bngl_channel.appendLine("pip install failed for python: " + pythonPath);
				vscode.window.showInformationMessage("BNG setup failed, see BNGL output channel for details.");
				bngl_channel.show();
			}
			else {
				bngl_channel.appendLine("pip install succeeded for python: " + pythonPath);
				vscode.window.showInformationMessage("BNG setup complete.");
			}
		}
		else {
			bngl_channel.appendLine("Found bionetgen.");
			// todo: check version of bionetgen? prompt user to upgrade?
		}
	}

	// command to manually upgrade bionetgen
	async function upgradeCommandHandler() {
		bngl_channel.appendLine("Running BNG upgrade ...");

		bngl_channel.appendLine("Getting python path.");
		const pythonPath = await getPythonPath(bngl_channel);
		bngl_channel.appendLine("Found python path: " + pythonPath);
		
		bngl_channel.appendLine("Upgrading PyBNG for python: " + pythonPath);
		vscode.window.showInformationMessage("Upgrading BNG for the following Python: " + pythonPath);
					
		// spawn child process to run pip upgrade
		const upgradeExitCode = await spawnAsync(pythonPath, ['-m', 'pip', 'install', 'bionetgen', '--upgrade'], bngl_channel, processManager);
		
		if (upgradeExitCode) {
			bngl_channel.appendLine("pip upgrade failed for python: " + pythonPath);
			vscode.window.showInformationMessage("BNG upgrade failed, see BNGL output channel for details.");
			bngl_channel.show();
		}
		else {
			bngl_channel.appendLine("pip upgrade successful for python: " + pythonPath);
			vscode.window.showInformationMessage("BNG upgrade complete.");
		}
	}

	// names of the commands we want to register
	const runCommandName = 'bng.run_bngl';
	const vizCommandName = 'bng.run_viz';
	const plotDatCommandName = 'bng.plot_dat';
	const webviewCommandName = 'bng.webview';
	const setupCommandName = 'bng.setup';
	const upgradeCommandName = 'bng.upgrade';
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable1 = vscode.commands.registerCommand(runCommandName, runCommandHandler);
	context.subscriptions.push(disposable1);
	// this is the command to visualize 
	let disposable2 = vscode.commands.registerCommand(vizCommandName, vizCommandHandler);
	context.subscriptions.push(disposable2);
	// these are the plotting commands for gdat/cdat/scan files
	let disposable3 = vscode.commands.registerCommand(plotDatCommandName, plotDatCommandHandler);
	context.subscriptions.push(disposable3);
	// this one generates the webview panel for built-in plotting
	let disposable4 = vscode.commands.registerCommand(webviewCommandName, () => { PlotPanel.create(context.extensionUri) });
	context.subscriptions.push(disposable4);
	// this command handles installation of bionetgen
	let disposable5 = vscode.commands.registerCommand(setupCommandName, setupCommandHandler);
	context.subscriptions.push(disposable5);
	// this one upgrades bionetgen
	let disposable6 = vscode.commands.registerCommand(upgradeCommandName, upgradeCommandHandler);
	context.subscriptions.push(disposable6);

	// commands for process management
	// - kill_process is hidden from command palette (see package.json) because it can only work through tree view
	context.subscriptions.push(vscode.commands.registerCommand('bng.process_cleanup', () => { processManager.killAllProcesses() }));
	context.subscriptions.push(vscode.commands.registerCommand('bng.kill_process', (processObject) => { processManager.killProcess(processObject) }));

	let processManagerTreeView = vscode.window.createTreeView('processManagerTreeView', {treeDataProvider: new ProcessManagerProvider(processManager)});
	vscode.commands.executeCommand('setContext', 'bng.processManagerActive', true); // show process manager tree view only when extension is active
	
	// TODO make this work
	// resurrect webview 
	// if (vscode.window.registerWebviewPanelSerializer) {
	// 	// Make sure we register a serializer in activation event
	// 	vscode.window.registerWebviewPanelSerializer(PlotPanel.viewType, {
	// 		async deserializeWebviewPanel(webviewPanel, state) {
	// 			// Reset the webview options so we use latest uri for `localResourceRoots`.
	// 			webviewPanel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] };
	// 			let fname = vscode.window.activeTextEditor.document.fileName;
	// 			let extension = fname.split(".").pop();
	// 			PlotPanel.revive(webviewPanel, extension);
	// 		}
	// 	});
	// }
}

/**
 * @param {string} outpath
 * @param {number} [timeout]
 */
function checkImage(outpath, timeout) {
	// this returns a promise that will wait until 
	// a file given by outpath is found or a timeout
	// limit is reached
	return new Promise(function (resolve, reject) {
		// timer that closes watcher if timeout is reached
		var timer = setTimeout(function () {
			watcher.close();
			reject();
		}, timeout);
		// checks a path to see if it returns F_OK which 
		// indicates that the file is visible/exists
		fs.access(outpath, fs.constants.F_OK, function (err) {
			if (!err) {
				clearTimeout(timer);
				watcher.close();
				resolve();
			}
		});
		// checks a folder to see if a file is renamed 
		// into the file we are watching out for
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

/**
 * @param {string} outpath
 * @param {number} [timeout]
 */
function checkGdat(outpath, timeout) {
	// this returns a promise that will wait until 
	// a folder given by outpath is found or a timeout
	// limit is reached
	return new Promise(function (resolve, reject) {
		// timer that closes watcher if timeout is reached
		var timer = setTimeout(function () {
			watcher.close();
			reject();
		}, timeout);
		// checks a folder to see if a gdat shows up
		var watcher = fs.watch(outpath, function (eventType, filename) {
			// get the extension of the file
			let ext = filename.split(".").pop();
			// if it's a gdat file, resolve the promise
			if (eventType == "rename" && ext == "gdat") {
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
	static ffolds = [];
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
	/** @type {vscode.TextDocument} */
	_document;
	// /** @type {} */
	_config
	/** @type {vscode.Uri} */
	scriptUri;
	/** @type {vscode.Uri} */
	plotlyUri;
	/** @type {vscode.Uri} */
	cytoUri
	/** @type {vscode.Uri} */
	cytoGraphMLUri;
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
	constructor(panel, extension, text) {
		// get config
		this._config = vscode.workspace.getConfiguration("bngl");
		// set our stuff
		this._panel = panel;
		this._ext = extension;
		this._text = text;
		this._name = PlotPanel.get_current_name();
		// listen to dispose
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
		// // Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				if (this._panel.visible && !this._visible) {
					this._visible = true;
					// this._set_html();
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
					// just for debugging
					case 'debug':
						console.log(message.text);
						return;
					// this is just for webpanel to send msg to the user
					case 'alert':
						vscode.window.showInformationMessage(message.text);
						return;
					// redraws the entire panel
					case 'refresh':
						switch (message.context) {
							case 'view':
								this._set_html();
								return;
						}
						return;
					case 'ready':
						this._send_figure_data();
					// this is an image to save, the webview can't do this directly
					case 'image':
						switch (message.type) {
							case 'png':
								let fu = vscode.Uri.file(message.folder);
								// absolute path to the file we want to save
								let iu = vscode.Uri.joinPath(fu, `${message.title}.png`);
								// extract png data in base64
								let png_data = message.text.replace("data:image/png;base64,", "");
								// decode base64 string and get a buffer/uint8arr
								let buf = Buffer.from(png_data, 'base64');
								// save the file
								vscode.workspace.fs.writeFile(iu, buf);
								// let user know
								vscode.window.showInformationMessage(
									`image saved to ${iu.fsPath}`
								);
								return;
							case 'svg':
								let sfu = vscode.Uri.file(message.folder);
								// absolute path to the file we want to save
								let siu = vscode.Uri.joinPath(sfu, `${message.title}.svg`);
								// extract svg data which is already decoded to a string
								var svg_dec = decodeURIComponent(message.text);
								// remove identifer?
								var svg_str = svg_dec.replace("data:image/svg+xml,", "");
								// create a buffer to save to a file
								let sbuf = Buffer.from(svg_str);
								// save the file
								vscode.workspace.fs.writeFile(siu, sbuf);
								// let user know
								vscode.window.showInformationMessage(
									`image saved to ${siu.fsPath}`
								);
								return;
						}
				}
			},
			null,
			this._disposables
		);
		// initial html	
		this._setup();
	}

	// /**
	//  * @param {vscode.WebviewPanel} panel 
	//  * @param {String} extension 
	//  */
	// static revive(panel, extension) {
	// 	// TODO this needs to actually revive the panel at some point
	// 	// get current text
	// 	let text = vscode.window.activeTextEditor.document.getText();
	// 	PlotPanel.panels.push(new PlotPanel(panel, extension, text))
	// }

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
		const cytoGraphMLOnDisk = vscode.Uri.joinPath(PlotPanel._extensionUri, 'media', 'cytoscape-graphml.js');
		const jqOnDisk = vscode.Uri.joinPath(PlotPanel._extensionUri, 'media', 'jquery-3.5.1.min.js');
		// And the uri we use to load this script in the webview
		this.cytoUri = webview.asWebviewUri(cytoOnDisk);
		this.cytoGraphMLUri = webview.asWebviewUri(cytoGraphMLOnDisk);
		this.jqUri = webview.asWebviewUri(jqOnDisk);
		// Local path to css styles
		const stylesPathMainPath = vscode.Uri.joinPath(PlotPanel._extensionUri, 'media', 'main.css');
		// Uri to load styles into webview
		this.stylesMainUri = webview.asWebviewUri(stylesPathMainPath);
		// content depends on the extension
		this._panel.title = `${this._ext}/${this._name}`;
		// show
		this._set_html();
	}

	_set_html() {
		// get webview to pass to set_html functions
		const webview = this._panel.webview;
		// content depends on the extension
		switch (this._ext) {
			case "graphml":
				this._set_graphml_html(webview);
				return;
			case "gdat":
			case "cdat":
			case "scan":
				this._set_plot_html(webview);
				return;
		}
	}

	_send_figure_data() {
		// get webview to pass to set_html functions
		const webview = this._panel.webview;
		// content depends on the extension
		switch (this._ext) {
			case "graphml":
				this._send_graphml_data(webview);
				return;
			case "gdat":
			case "cdat":
			case "scan":
				this._send_plot_data(webview);
				return;
		}
	}

	/**
	 * 
	 * @param {vscode.Webview} webview 
	 */
	_set_graphml_html(webview) {

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
			</head>
			<body>
				<div id="page_title" style="display: none;">${this._name}_${this._ext}</div>
				<div id="folder" style="display: none;">${PlotPanel.get_current_folder()}</div>
				<div id="network"></div>
				<div id="top_buttons">
				  <button id="layout_button" class="button" type="button">Redo Layout</button>
				  <button id="png_button" class="button" type="button">Save as PNG</button>
				</div>
				<script nonce="${this._nonce}" src="${this.jqUri}" type="text/javascript"></script>
				<script nonce="${this._nonce}" src="${this.cytoUri}" type="text/javascript"></script>
				<script nonce="${this._nonce}" src="${this.scriptUri}" type="text/javascript"></script>
			</body>
			</html>`;
	}

	/**
	 * 
	 * 
	 */
	_send_graphml_data(webview) {
		// now we'll parse the editor text and turn it into a 
		// data format we can pass along to the webview that's open
		webview.postMessage({
			command: 'network',
			context: 'data',
			data: this._text
		});
	}

	/**
	 * 
	 * 
	 */
	_send_plot_data(webview) {
		// now we'll parse the editor text and turn it into a 
		// data format we can pass along to the webview that's open
		webview.postMessage({
			command: 'plot',
			context: 'data',
			names: this._data[0],
			data: this._data[1],
			legend: this._config.plotting.legend,
			max_series: this._config.plotting.max_series_count,
			menus: this._config.plotting.menus,
		});
	}

	/**
	 * 
	 * @param {vscode.Webview} webview 
	 */
	_set_plot_html(webview) {
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
			</head>
			<body>
				<div id="page_title" style="display: none;">${this._name}_${this._ext}</div>
				<div id="folder" style="display: none;">${PlotPanel.get_current_folder()}</div>
				<div id="plot"></div>	
				<script nonce="${this._nonce}" src="${this.jqUri}" type="text/javascript"></script>
				<script nonce="${this._nonce}" src="${this.plotlyUri}" type="text/javascript"></script>
				<script nonce="${this._nonce}" src="${this.scriptUri}" type="text/javascript"></script>
			</body>
			</html>`;
		// now we'll parse the editor text and turn it into a 
		// data format we can pass along to the webview that's open
		if (this._data == undefined) {
			this._data = this.parse_dat(this._text);
		}
	}

	/**
	 * 
	 * @param {String} text 
	 */
	parse_dat(text) {
		// we want to split the newlines
		let lines = text.split(/([\n\r])/).filter(e => e.trim().length > 0);
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
		let names = splt_lines[0].slice(1, splt_lines[0].length);
		let data = splt_lines.slice(1, splt_lines.length);
		data = data[0].map(
			(_, colIndex) => data.map(row => row[colIndex])
		);
		return [names, data];
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

	static get_current_folder() {
		return PlotPanel.ffolds[PlotPanel.cur_planel_id]
	}

	/**
	 * 
	 * @param {vscode.Uri} extensionUri 
	 */
	static create(extensionUri) {
		// set extensionUri
		PlotPanel._extensionUri = extensionUri;
		// we want to pop open a new tab on the side
		let column = vscode.ViewColumn.Active;
		// we want the extension to determine the type of 
		// file we want to write
		let fpath = vscode.window.activeTextEditor.document.fileName;
		let extension = fpath.split(".").pop();
		let title = "Unknown";
		if (extension == "graphml") {
			title = "GraphML Viewer";
		} else if (extension == "gdat" || extension == "cdat") {
			title = "Plot viewer";
		} else if (extension == "scan") {
			title = "Scan Plot";
		}
		// TODO: this is a hack to find basename, find where
		// the real basename function is that works with URIs
		let li_u = fpath.lastIndexOf('/') + 1;
		let li_w = fpath.lastIndexOf('\\') + 1;
		let li_f = Math.max(li_u, li_w);
		let folder = fpath.substring(0, li_f);
		let name = fpath.substring(li_f);
		let fname = name.replace("." + extension, "");
		// add to our lists
		PlotPanel.extensions.push(extension);
		PlotPanel.viewTitles.push(title);
		PlotPanel.fpaths.push(fpath);
		PlotPanel.fnames.push(fname);
		PlotPanel.ffolds.push(folder);
		// create panel
		const panel = vscode.window.createWebviewPanel(
			PlotPanel.viewType,
			PlotPanel.get_current_title(),
			column || vscode.ViewColumn.Active,
			{
				enableScripts: true,
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

function get_time_stamped_folder_name() {
	// make a folder friendly time stamp
	const date = new Date();
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, '0');
	const day = `${date.getDate()}`.padStart(2, '0');
	const hours = `${date.getHours()}`.padStart(2, '0');
	const minutes = `${date.getMinutes()}`.padStart(2, '0');
	const seconds = `${date.getSeconds()}`.padStart(2, '0');
	const fold_name = `${year}_${month}_${day}__${hours}_${minutes}_${seconds}`
	return fold_name;
}

// this method is called when your extension is deactivated
function deactivate() {
	vscode.commands.executeCommand('bng.process_cleanup');
}

module.exports = {
	activate,
	deactivate
}
