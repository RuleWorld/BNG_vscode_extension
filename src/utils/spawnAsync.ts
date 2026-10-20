import * as cp from 'child_process';
import { ProcessManager, TrackedProcessMetadata } from './processManagement';
import * as vscode from 'vscode';
import { CommandSpec } from './commandSpec';

export interface SpawnAsyncOptions {
    tracking?: TrackedProcessMetadata;
    onSpawn?: (process: cp.ChildProcess, pid: number | undefined) => void;
}

// spawn child process to run the given command, write results to output channel
export async function spawnAsync(
    spec: CommandSpec,
    channel?: vscode.OutputChannel,
    processManager?: ProcessManager,
    options?: SpawnAsyncOptions
): Promise<number> {

    // expect this promise to resolve; reject is not used because this seems to cause strange behavior in VS Code
    return new Promise((resolve) => {
        const newProcess = cp.spawn(spec.command, spec.args);
        const pid = newProcess.pid;
        if (processManager && pid) {
            processManager.add(pid, spec.command, options?.tracking);
        }
        options?.onSpawn?.(newProcess, pid);

        let resolved = false;
        const finish = (code: number) => {
            if (resolved) {
                return;
            }

            resolved = true;
            if (channel) {
                channel.appendLine(`process exited with code ${code}`);
            }
            if (processManager && pid) {
                processManager.delete(pid);
            }
            resolve(code);
        };

        // expose errors with the process itself
        newProcess.on('error', (err) => {
            if (channel) {
                channel.appendLine(err.message);
            }
            finish(1);
        });

        // expose the standard output of the command (what is normally printed)
        newProcess.stdout?.on('data', (data) => {
            if (channel) {
                channel.append(data.toString());
            }
        });

        // expose any errors that occur while the process is running
        newProcess.stderr?.on('data', (data) => {
            if (channel) {
                channel.append(data.toString());
            }
        });

        // expose and return the exit code with which the process finished
        newProcess.on('close', (code) => {
            finish(code ?? 1);
        });
    });
}
