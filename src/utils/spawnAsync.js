// inspired by:
// https://nodejs.org/api/child_process.html
// https://github.com/microsoft/vscode-python/blob/3698950c97982f31bb9dbfc19c4cd8308acda284/gulpfile.js
// https://github.com/microsoft/vscode-docker/blob/main/src/utils/spawnAsync.ts

const cp = require('child_process');

// spawn child process to run the given command, write results to output channel
async function spawnAsync(command, args, channel) {

    // expect this promise to resolve; reject is not used because this seems to cause strange behavior in VS Code
    return new Promise((resolve, reject) => {
        const newProcess = cp.spawn(command, args);
        
        // expose errors with the process itself
        newProcess.on('error', (err) => {
            if (channel) {
                channel.appendLine(err);
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
            resolve(code);
        });
    });
}

module.exports = {
    spawnAsync
}