// inspired by:
// https://github.com/weinand/vscode-processes
// - this uses wmic to get process list on windows, however wmic is now deprecated; use powershell for wmi instead
// https://github.com/microsoft/vscode-extension-samples/tree/main/tree-view-sample

// usage:
// - extension creates a ProcessManager instance & passes it to spawnAsync
// - spawnAsync adds to & deletes from the ProcessManager instance
// - ProcessManager instance periodically checks for open sub-processes
// - extension registers commands to kill processes through the ProcessManager instance
// - extension creates processManagerTreeView & registers a ProcessManagerProvider instance based on the ProcessManager instance

const vscode = require('vscode');
const cp = require('child_process');

// tree data provider for tree view
class ProcessManagerProvider {
    _processManager;

    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(processManager) {
        this._processManager = processManager;
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

    // figure out how to keep tree view updated / when to update
    refresh() {
        this._onDidChangeTreeData.fire();
        setTimeout(() => { this.refresh() }, 500);
    }

}

class ProcessManager {
    // do we need to keep track of anything besides PID? is this where that info should be kept?
    // - maybe parent/child stuff for sub-processes; depends on how tree view handles this
    // - name / other info to display to user?

    _openProcessesTracked; // set of PIDs of open processes directly tracked by spawnAsync
    _openProcessesUntracked; // array of PIDs of open processes not directly tracked by spawnAsync (ie. sub-processes)

    constructor() {
        this._openProcessesTracked = new Set();
        this._openProcessesUntracked = [];
        this.refresh();
    }

    async refresh() {
        this._openProcessesUntracked = await getProcessList();
        setTimeout(() => { this.refresh() }, 500); // how often to refresh?
    }

    add (pid) {
        this._openProcessesTracked.add(pid);
    }

    delete (pid) {
        this._openProcessesTracked.delete(pid);
    }

    get openProcessList() {
        return Array.from(this._openProcessesTracked).concat(this._openProcessesUntracked);
    }

    // notes on process.kill
    // - should kill via signal, why does the corresponding close event say signal is null?
    // - there might be some weird nuances with signals that can be used here, especially on windows
    // - there's a delay before spawnAsync catches this

    killProcess(pid) {
        process.kill(pid);
    }

    killAllProcesses() {
        this._openProcessesTracked.forEach((pid) => {
            process.kill(pid);
        });
        this._openProcessesUntracked.forEach((pid) => {
            process.kill(pid);
        });
    }
}

// WIP: sub-process tracking
async function getProcessList(ppid) {

    return new Promise((resolve, reject) => {
        let processList = [];

        // windows
        if (process.platform === "win32") {
            let helper;

            // there are a couple potential ways of doing this

            // get processes which are children of the given process (only gets direct children)
            if (ppid) {
                helper = cp.spawn('Get-WmiObject', ['Win32_Process', '-Filter', `"ParentProcessId = ${ppid}"`, '|', 'Select-Object', 'Name, ProcessID'], {'shell':'powershell.exe'});
            }
            // if ppid is not given, get all processes
            else {
                // try to get only those which are relevant to bionetgen
                // - BNG2.pl shows up with name perl.exe
                //   (could be problematic if there happen to be other perl things running, unless we only track children of bionetgen processes)
                // - not sure how run_network shows up
                // - can look into using something other than / in addition to name for filtering
                // - can get other details depending on what is needed for tree view
                helper = cp.spawn('Get-WmiObject', ['Win32_Process', '-Filter', `"Name = 'perl.exe' or Name = 'NFsim.exe'"`, '|', 'Select-Object', 'ProcessID, Name'], {'shell':'powershell.exe'});
            }

            // need some kind of error message if spawn fails for whatever reason

            // how to combine parent/child hierarchy with filtering and integrate all of this with tree view stuff in a clean way?
            // - consider nested children
            // - there are some intermediate processes that come up eg. python, command line; do we want to track these?
            // - how exactly does the tree data provider assemble the tree view?

            // parse stdout to get information about open processes
            // - get it in the same format as whatever is tracked by ProcessManager & used with getTreeItem()
            // - currently these just pass around PIDs, but some naming/labeling info is needed as well (use an object?)
            helper.stdout.setEncoding('utf8'); // allows data to be passed as string; otherwise data is passed as buffer
            helper.stdout.on('data', (data) => {
                // assumptions:
                // - each process corresponds to one line of text
                // - no chunk of data will start/end in the middle of a line
                // - text contains process information iff it contains numbers (for PID, possibly also other info)

                // determine whether current chunk contains any process information
                if (/[0-9]/.test(data)) {
                    // if it does, trim whitespace & split by newline
                    let lines = data.trim().split(/\n/);
                    // get only lines corresponding to processes
                    lines = lines.filter(line => /[0-9]/.test(line));
                    
                    for (const line of lines) {
                        // split each line by whitespace to get process information
                        const processInfo = line.trim().split(/\s+/);
                        const pid = parseInt(processInfo[0]);
                        // const name = processInfo[1];
                        processList.push(pid);
                    }
                }
            });
            helper.on('close', () => {
                resolve(processList);
            });
        }
        // mac & linux
        else {
            // todo
            resolve(processList);
        }
    });
}

module.exports = {
    ProcessManager,
    ProcessManagerProvider
}