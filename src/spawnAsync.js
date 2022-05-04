// inspired by:
// https://nodejs.org/api/child_process.html
// https://github.com/microsoft/vscode-python/blob/3698950c97982f31bb9dbfc19c4cd8308acda284/gulpfile.js
// https://github.com/microsoft/vscode-docker/blob/main/src/utils/spawnAsync.ts

const cp = require('child_process');

// spawn child process to run the given command
// spawn might not actually be the ideal choice, look into exec/fork?
// though spawn might be better than exec for printing output continuously (?)
// todo: check against examples
function spawnAsync(command, args) {

    // todo: make this async? is this necessary? if not, rename function

    // take one string and internally separate it into command + args?
    // (probably easier for whoever calls this)
    // how are command & args put together by spawn?
    
    const newProcess = cp.spawn(command, args);

    // todo: let user know if the process was actually spawned (ie. setup began)
    // todo: figure out where to handle errors with the process itself
    // (this is distinct from stderr)
    // todo: error handling
    // what types of errors are possible?
    // what exit codes to consider?
    // what messages are useful to user?
    
    // what should be printed (sent to terminal) and/or shown in popup?
    // currently everything is logged to (debug) console

    // expose the standard output of the command (what is normally printed)
    newProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });

    // expose any errors that occur while the process is running
    newProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    // expose the exit code with which the process finished
    newProcess.on('close', (code) => {
        console.log(`process exited with code ${code}`);
    });
}

module.exports = {
    spawnAsync
}