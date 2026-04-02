import * as vscode from 'vscode';

// get path to the python interpreter to be used for installing bionetgen, write relevant info to output channel
export async function getPythonPath(channel?: vscode.OutputChannel): Promise<string> {
    // if no particular path can be found, return defaultPath
    const defaultPath = "python";

    const pythonExt = vscode.extensions.getExtension('ms-python.python');
    if (typeof pythonExt === 'undefined') {
        if (channel) {
            channel.appendLine("Python extension undefined.");
        }
        return defaultPath;
    }

    const flagValue = pythonExt.packageJSON.featureFlags.usingNewInterpreterStorage;

    if (flagValue) {
        if (!pythonExt.isActive) {
            try {
                await pythonExt.activate();
            } catch (e: any) {
                if (channel) {
                    channel.appendLine("Python extension could not be activated.");
                    channel.appendLine(e);
                }
                return defaultPath;
            }
        }

        let doc = vscode.window.activeTextEditor;
        let resource: vscode.Uri | undefined = undefined;
        if (doc) {
            resource = doc.document.uri;
        }

        let executionDetails;
        if (resource) {
            executionDetails = pythonExt.exports.settings.getExecutionDetails(resource);
        }
        else {
            executionDetails = pythonExt.exports.settings.getExecutionDetails();
        }

        const execCommand = executionDetails?.["execCommand"] as string[] | undefined;

        if (execCommand && execCommand.length > 0) {
            return execCommand.join(" ");
        }
        else {
            if (channel) {
                channel.appendLine("pythonPath undefined, attempting to retrieve defaultInterpreterPath.");
            }

            const defaultInterpreterPath = vscode.workspace.getConfiguration("python").get<string>("defaultInterpreterPath");

            if (defaultInterpreterPath) {
                return defaultInterpreterPath;
            }
            else {
                if (channel) {
                    channel.appendLine("defaultInterpreterPath undefined.");
                }
                return defaultPath;
            }
        }
	} else {
		const pythonPath = vscode.workspace.getConfiguration("python").get<string>("pythonPath");

        if (pythonPath) {
            return pythonPath;
        }
        else {
            if (channel) {
                channel.appendLine("pythonPath undefined.");
            }
            return defaultPath;
        }
	}
}
