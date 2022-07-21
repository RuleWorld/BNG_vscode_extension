// usage:
// - extension creates a ProcessManager instance & passes it to spawnAsync
// - spawnAsync adds to & deletes from the ProcessManager instance
// - extension registers commands to kill processes through the ProcessManager instance
// - extension creates processManagerTreeView & registers a ProcessManagerProvider instance based on the ProcessManager instance

const vscode = require('vscode');
const process = require('process');

// tree data provider for tree view
class ProcessManagerProvider {
    _processManager;

    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(processManager) {
        this._processManager = processManager; // is this how we want to keep track of processes for the tree view?
        this.refresh();
    }

    // figure out how this thing works & what to do about tree hierarchy / tracking sub-processes
    getChildren() {
        return this._processManager.openProcessList;
    }

    // figure out how this thing works
    getTreeItem(pid) {
        // what information to display / include in tree item?
        return new vscode.TreeItem(pid.toString());
    }

    // figure out how to keep tree view updated / when to update, this is probably not great
    refresh() {
        this._onDidChangeTreeData.fire();
        setTimeout(() => { this.refresh() }, 500);
    }

}

// does this need to be a class or can the set just be used directly?
// might take out & merge with other stuff later if not really needed
class ProcessManager {
    // do we need to keep track of anything besides PID? is this where that info should be kept?
    // - maybe parent/child stuff for sub-processes; depends on how tree view handles this
    // - name / other info to display to user?

    _openProcesses; // set of PIDs of open processes

    constructor() {
        this._openProcesses = new Set();
    }

    add (pid) {
        this._openProcesses.add(pid);
    }

    delete (pid) {
        this._openProcesses.delete(pid);
    }

    get openProcessList() {
        return Array.from(this._openProcesses);
    }

    // notes on process.kill
    // - should kill via signal, why does the corresponding close event say signal is null?
    // - there might be some weird nuances with signals that can be used here, especially on windows
    // - there's a delay before spawnAsync catches this

    killProcess(pid) {
        process.kill(pid);
    }

    killAllProcesses() {
        this._openProcesses.forEach((pid) => {
            process.kill(pid);
        });
    }
}

module.exports = {
    ProcessManager,
    ProcessManagerProvider
}