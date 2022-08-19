// inspired by:
// https://github.com/microsoft/vscode-extension-samples/tree/main/tree-view-sample
// https://github.com/weinand/vscode-processes
// - this uses wmic to get process list on windows, however wmic is now deprecated; here we use powershell for wmi instead

const vscode = require('vscode');
const cp = require('child_process');

const refreshInterval = 500;
// note: there was at some point an issue with annoying flashing visuals in VSCode UI that seemed to be related to
// coupling of ProcessManagerProvider & ProcessManager refresh schedules and handling of async getProcessList(),
// and this appeared to be fixed by decoupling these refresh schedules;
// however it is now unclear what was going on and they are once more coupled, which seems to working okay

// tree data provider for tree view
class ProcessManagerProvider {
    _processManager;

    // for refresh
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(processManager) {
        this._processManager = processManager;
        this.refresh();
    }

    // return trackedProcessObject[] containing information about open processes at specified level of custom process tree
    // note: process tree displayed in tree view will include only processes opened through spawnAsync & (some of) their sub-processes
    getChildren(trackedProcessObject) {
        if (trackedProcessObject) {
            return trackedProcessObject.children;
        }
        else {
            return this._processManager.toplevelProcesses;
        }
    }

    // return TreeItem (to be displayed in VSCode UI) containing information about given process
    getTreeItem(trackedProcessObject) {
        const pid = trackedProcessObject.pid;
        const name = trackedProcessObject.name.split(/[\\\/]/).pop().replace(".exe", ""); // take last segment of path if there is one, remove extension
        // todo: include name of bionetgen model? where/how to get this?
        let label = `${pid.toString()}: ${name}`;
        return new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
    }

    refresh() {
        setTimeout(async () => {
            await this._processManager.refresh();
            this._onDidChangeTreeData.fire();
            this.refresh();
        }, refreshInterval);
    }
}

class ProcessManager {

    // --- representation of information to be displayed in tree view ---
    // map object which stores key/value pairs corresponding to only open processes directly tracked by spawnAsync,
    // which act as top-level processes or roots of custom process trees to be displayed in tree view
    // - key: PID of process
    // - value: object storing process details (referred to as trackedProcessObject)
    // -- PID
    // -- name
    // -- children: trackedProcessObject[] (note: only includes sub-processes which are to be displayed in tree view)
    _openProcessesTracked;

    // --- representation of full process tree ---
    // map object which stores key/value pairs corresponding to all open processes retrieved from external process utility
    // - key: PID of process
    // - value: object storing process details (referred to as untrackedProcessObject)
    // -- PID
    // -- PPID
    // -- name
    // -- children: untrackedProcessObject[] (note: includes all sub-processes)
    _openProcessesUntracked;

    constructor() {
        this._openProcessesTracked = new Map();
        this._openProcessesUntracked = new Map();
        // this.refresh();
    }

    // provides roots of custom process trees to be displayed in tree view
    get toplevelProcesses() {
        return Array.from(this._openProcessesTracked.values());
    }

    // --- functions for process cleanup ---

    killAllProcesses() {
        for (const trackedProcessObject of this._openProcessesTracked.values()) {
            this.killProcess(trackedProcessObject);
        }
    }

    // kill process selected from tree view
    killProcess(trackedProcessObject) {
        if (trackedProcessObject) {
            // need to use the corresponding full process tree
            const untrackedProcessObject = this._openProcessesUntracked.get(trackedProcessObject.pid);
            if (untrackedProcessObject) {
                this._treeKill(untrackedProcessObject);
            }
            // this will not do anything if it can't find the corresponding full process tree
            // (as opposed to just killing the given process and potentially causing orphan issues)
        }
    }

    // kill all open sub-processes of the given process, then kill the given process
    _treeKill(untrackedProcessObject) {
        for (const child of untrackedProcessObject.children) {
            this._treeKill(child);
        }
        process.kill(untrackedProcessObject.pid);
    }

    // --- functions for tracking top-level processes ---
    // note: the information maintained by these persists regardless of refresh schedule

    // called by spawnAsync when a new process is initiated
    add (pid, command) {
        this._openProcessesTracked.set(pid, {
            pid: pid,
            name: command
        });
    }

    // called by spawnAsync when a tracked process terminates
    delete (pid) {
        this._openProcessesTracked.delete(pid);
    }

    // --- functions for tracking all processes ---
    // note: the information maintained by these is refreshed according to refresh schedule

    async refresh() {
        await this._buildFullProcessTree();
        // using information from full process tree, reconstruct custom process trees rooted at top-level tracked processes
        for (const trackedProcessObject of this._openProcessesTracked.values()) {
            this._reconstruct(trackedProcessObject);
        }

        // setTimeout(() => { this.refresh() }, refreshInterval);
    }

    // use information from external process utility to build representation of full process tree
    async _buildFullProcessTree() {
        // invoking the process utility seems to be the slowest component of this whole system,
        // so we get one basic flat list of currently open processes
        let processList = await this._getProcessList();

        // iterate over the process list and add each to our collection
        this._openProcessesUntracked.clear(); // refresh this right before re-populating it for better continuity
        for (const untrackedProcessObject of processList) {
            untrackedProcessObject.children = []; // initialize this
            this._openProcessesUntracked.set(untrackedProcessObject.pid, untrackedProcessObject);
        }
        
        // iterate over our collection of processes and build up parent/child relationships
        for (const untrackedProcessObject of this._openProcessesUntracked.values()) {
            let parent = this._openProcessesUntracked.get(untrackedProcessObject.ppid);
            if (parent) {
                parent.children.push(untrackedProcessObject);
            }
        }
    }

    // reconstruct custom process tree rooted at given process by filtering full process tree
    _reconstruct(trackedProcessObject) {
        // get full process tree rooted at given process
        const untrackedProcessObject = this._openProcessesUntracked.get(trackedProcessObject.pid);
        if (untrackedProcessObject) {
            // apply filter to get next level of children to include in custom process tree
            let filteredChildren = this._getFilteredChildren(untrackedProcessObject);
            
            trackedProcessObject.children = []; // refresh
            // recreate children and assign to trackedProcessObject
            for (const untrackedChild of filteredChildren) {
                const trackedChild = {
                    pid: untrackedChild.pid,
                    name: untrackedChild.name
                };
                trackedProcessObject.children.push(trackedChild);
            }

            // continue down the tree
            for (const trackedChild of trackedProcessObject.children) {
                this._reconstruct(trackedChild);
            }
        }
    }
    
    // apply custom filter to full process tree rooted at given process and return top layer of children satisfying this filter
    _getFilteredChildren(untrackedProcessObject) {
        let filteredChildren = [];
        const allChildren = untrackedProcessObject.children;
        for (const child of allChildren) {
            if (this._filter(child)) {
                filteredChildren.push(child);
            }
            // if a child is filtered out, attempt to promote its children to its level
            else {
                filteredChildren = filteredChildren.concat(this._getFilteredChildren(child));
                // this seems like it could maybe be done more efficiently
            }
        }
        return filteredChildren;
    }

    // specify filter which determines whether a process from full process tree will be included in custom process tree
    _filter(untrackedProcessObject) {
        // intermediate processes (eg. python, command line) are not included
        const nameMatch = /perl|NFsim|run_network/;
        return nameMatch.test(untrackedProcessObject.name);
    }

    // invoke external process utility to get list of open processes, return untrackedProcessObject[]
    // note: this may be more resource intensive than we might like, considering it's called quite often
    async _getProcessList() {

        return new Promise((resolve, reject) => {
            let processList = [];
            let util;

            // windows
            if (process.platform === "win32") {
                util = cp.spawn('Get-WmiObject', ['Win32_Process', '|', 'Select-Object', 'ProcessID, ParentProcessId, Name'], {'shell':'powershell.exe'});
            }
            // mac & linux
            else {
                util = cp.spawn('ps', ['ax', '-o', 'pid,ppid,command']);
            }

            util.on('error', () => {
                resolve([]);
            });

            // parse stdout to get information about open processes
            util.stdout.setEncoding('utf8'); // allows data to be passed as string; otherwise data is passed as buffer
            util.stdout.on('data', (data) => {
                // assumptions:
                // - each process corresponds to one line of text
                // - no chunk of data will start/end in the middle of a line
                // - text contains process information iff it contains numbers (for PID, PPID)

                // determine whether current chunk contains any process information
                if (/[0-9]/.test(data)) {
                    // if it does, trim whitespace & split by newline
                    let lines = data.trim().split(/\n/);
                    // get only lines corresponding to processes
                    lines = lines.filter(line => /[0-9]/.test(line));
                    
                    for (const line of lines) {
                        // split each line by whitespace to get process information
                        const processInfo = line.trim().split(/\s+/);
                        processList.push({
                            pid: parseInt(processInfo[0]),
                            ppid: parseInt(processInfo[1]),
                            name: processInfo[2]
                        });
                    }
                }
            });

            util.on('close', () => {
                resolve(processList);
            });
        });
    }
}

module.exports = {
    ProcessManager,
    ProcessManagerProvider
}