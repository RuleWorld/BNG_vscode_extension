import * as vscode from 'vscode';
import { CommandSpec, createCommandSpec } from './commandSpec';

function getActiveResource(): vscode.Uri | undefined {
    return vscode.window.activeTextEditor?.document.uri;
}

// get the Python command to be used for installing bionetgen, write relevant info to output channel
export async function getPythonCommand(channel?: vscode.OutputChannel): Promise<CommandSpec> {
    const defaultCommand = createCommandSpec('python');
    const pythonExt = vscode.extensions.getExtension('ms-python.python');
    if (!pythonExt) {
        if (channel) {
            channel.appendLine('Python extension undefined.');
        }
        return defaultCommand;
    }

    if (!pythonExt.isActive) {
        try {
            await pythonExt.activate();
        } catch (e: any) {
            if (channel) {
                channel.appendLine('Python extension could not be activated.');
                channel.appendLine(String(e));
            }
            return defaultCommand;
        }
    }

    const resource = getActiveResource();
    const getExecutionDetails = pythonExt.exports?.settings?.getExecutionDetails;
    if (typeof getExecutionDetails === 'function') {
        const executionDetails = resource ? getExecutionDetails(resource) : getExecutionDetails();
        const execCommand = executionDetails?.execCommand as string[] | undefined;

        if (execCommand?.length) {
            return createCommandSpec(execCommand[0], execCommand.slice(1));
        }

        if (channel) {
            channel.appendLine('Python execution details did not include execCommand.');
        }
    }

    const pythonConfig = vscode.workspace.getConfiguration('python', resource);
    const defaultInterpreterPath = pythonConfig.get<string>('defaultInterpreterPath');
    if (defaultInterpreterPath) {
        return createCommandSpec(defaultInterpreterPath);
    }

    if (channel) {
        channel.appendLine('defaultInterpreterPath undefined, attempting to retrieve legacy pythonPath.');
    }

    const pythonPath = pythonConfig.get<string>('pythonPath');
    if (pythonPath) {
        return createCommandSpec(pythonPath);
    }

    if (channel) {
        channel.appendLine('pythonPath undefined.');
    }

    return defaultCommand;
}

export async function getPythonPath(channel?: vscode.OutputChannel): Promise<string> {
    return (await getPythonCommand(channel)).command;
}
