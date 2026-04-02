import * as cp from 'child_process';
import { ProcessManager } from './processManagement';
import * as vscode from 'vscode';

// spawn child process to run the given command, write results to output channel
export async function spawnAsync(command: string, args: string[], channel?: vscode.OutputChannel, processManager?: ProcessManager): Promise<number | null> {

    // expect this promise to resolve; reject is not used because this seems to cause strange behavior in VS Code
    return new Promise((resolve, reject) => {
        const newProcess = cp.spawn(command, args);
        const pid = newProcess.pid;
        if (processManager && pid) {
            processManager.add(pid, command);
        }
            
        // expose errors with the process itself
        newProcess.on('error', (err) => {
            if (channel) {
                channel.appendLine(err.message);
            }
        });

        // expose the standard output of the command (what is normally printed)
        newProcess.stdout.on('data', (data) => {
            if (channel) {
                channel.append(data.toString());
            }
        });

        // expose any errors that occur while the process is running
        newProcess.stderr.on('data', (data) => {
            if (channel) {
                channel.append(data.toString());
            }
        });

        // expose and return the exit code with which the process finished
        newProcess.on('close', (code) => {
            if (channel) {
                channel.appendLine(`process exited with code ${code}`);
            }
            if (processManager && pid) {
                processManager.delete(pid);
            }
            resolve(code);
        });
    });
}
