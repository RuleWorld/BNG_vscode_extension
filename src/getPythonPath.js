// inspired by:
// https://github.com/microsoft/vscode-python/issues/11294
// https://github.com/formulahendry/vscode-code-runner/blob/2bed9aeeabc1118a5f3d75e47bdbcfaf412765ed/src/utility.ts#L6
// https://code.visualstudio.com/api/references/vscode-api

// note that this relies on the structure of the python extension & its API
// https://github.com/microsoft/vscode-python/wiki/AB-Experiments
// https://github.com/microsoft/vscode-python/blob/main/src/client/api.ts
// https://github.com/microsoft/vscode-python/blob/main/src/client/apiTypes.ts

const vscode = require('vscode');

// get path to the python interpreter to be used for installing bionetgen
async function getPythonPath() {
    // package python extension with this extension? extensionDependencies?
    // warn user that they need to set an interpreter path?

    // will this break things?
    const defaultPath = "python";

    const pythonExt = vscode.extensions.getExtension('ms-python.python');
    if (typeof pythonExt === 'undefined') {
        vscode.window.showInformationMessage("Python extension undefined.");
        return defaultPath;
    }
	
    const flagValue = pythonExt.packageJSON.featureFlags.usingNewInterpreterStorage;
    // new: the path to the current workspace interpreter is kept in VS Code’s persistent storage, and
    // there is also a python.defaultInterpreterPath setting (which does not pick up changes if user selects interpreter)
    // old: the path to the interpreter is stored in the python.pythonPath setting

    if (flagValue) {
        // attempt to retrieve pythonPath through API

        if (!pythonExt.isActive) {
            await pythonExt.activate();
        }

        // is this (resource) needed? would it make more sense to get a global setting? see below
        const doc = vscode.window.activeTextEditor.document;

        // @type {{execCommand: (string[] | undefined)}}
        // an object which contains an array of strings for the command to execute a python interpreter
        const executionDetails = pythonExt.exports.settings.getExecutionDetails(doc.uri);
        // when no resource is provided, the setting scoped to the first workspace folder is returned,
        // and if no folder is present, it returns the global setting

        // @type {(string[] | undefined)}
        // undefined: empty pythonPath string; no interpreter set
        const execCommand = executionDetails["execCommand"];

        if (typeof execCommand !== 'undefined' && execCommand) {
            // @type {string}
            const pythonPath = execCommand.join(" ");

            return pythonPath;
        }
        else {
            // if pythonPath cannot be retrieved through API, attempt to retrieve defaultInterpreterPath through settings

            vscode.window.showInformationMessage("pythonPath undefined, attempting to retrieve defaultInterpreterPath");

            const defaultInterpreterPath = vscode.workspace.getConfiguration("python").get("defaultInterpreterPath");
        
            if (typeof defaultInterpreterPath !== 'undefined' && defaultInterpreterPath) {
                return defaultInterpreterPath;
            }
            else {
                vscode.window.showInformationMessage("defaultInterpreterPath undefined");
                return defaultPath;
            }
        }
	} else {
        // attempt to retrieve pythonPath through settings
        
		const pythonPath = vscode.workspace.getConfiguration("python").get("pythonPath");

        if (typeof pythonPath !== 'undefined' && pythonPath) {
            return pythonPath;
        }
        else {
            vscode.window.showInformationMessage("pythonPath undefined");
            return defaultPath;
        }
	}
}

module.exports = {
    getPythonPath
}