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

// notes:
// - ProcessManagerProvider & ProcessManager have independent refresh schedules, as
//   coupling these results in annoying flashing visuals in VSCode UI due to handling of async getProcessList()

const vscode = require('vscode');
const cp = require('child_process');

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

    // reads from processManager to get open processes at specified level of process tree
    // note: process tree will include only processes opened through spawnAsync & their children
    getChildren(processObject) {
        // todo: make sure this doesn't create an infinite loop,
        //       needs to return [] once it reaches the bottom of the tree

        // get sub-processes of processObject
        if (processObject) {
            return this._processManager.getOpenProcesses(processObject.pid);
        }
        // get top-level processes
        else {
            return this._processManager.getOpenProcesses();
        }
    }

    // converts the given processObject to a TreeItem to be displayed in VSCode UI
    getTreeItem(processObject) {
        const pid = processObject.pid;
        const name = processObject.name.split(/[\\\/]/).pop().replace(".exe", ""); // take last segment of path if there is one, remove extension
        const model = ""; // todo: get model name?

        let label = `${pid.toString()}: ${name}`; // /${model}`;

        return new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
    }

    refresh() {
        this._onDidChangeTreeData.fire();
        setTimeout(() => { this.refresh() }, 500); // when to refresh?
    }

}

class ProcessManager {
    // map objects which store key/value pairs
    // - key: PID of process
    // - value: object storing process details
    // -- PID
    // -- name
    _openProcessesTracked; // open processes directly tracked by spawnAsync
    _openProcessesUntracked; // open processes not directly tracked by spawnAsync (ie. sub-processes)

    constructor() {
        this._openProcessesTracked = new Map();
        this._openProcessesUntracked = new Map();
        this.refresh();
    }

    // refreshes stored collection of open sub-processes
    async refresh() {
        // todo: hierarchy stuff

        let processList = await getProcessList();
        this._openProcessesUntracked.clear();
        for (const processObject of processList) {
            this._openProcessesUntracked.set(processObject.pid, processObject);
        }

        setTimeout(() => { this.refresh() }, 500); // when to refresh?
    }

    // maintains (adds to) stored collection of tracked processes
    // usage: called when a new process is initiated by spawnAsync
    add (pid, command) {
        this._openProcessesTracked.set(pid, {
            pid: pid,
            name: command // is this what we want to do?
        });
    }

    // maintains (deletes from) stored collection of tracked processes
    // usage: called when a tracked process terminates
    delete (pid) {
        this._openProcessesTracked.delete(pid);
    }

    // reads from stored collections of open processes
    getOpenProcesses(ppid) {
        // sub-processes
        if (ppid) {
            // todo: needs to return array of processes at level under ppid,
            //       make sure this is eventually []

            return Array.from(this._openProcessesUntracked.values());
        }
        // top-level processes
        // - assumption: a process is top-level iff it comes from spawnAsync
        else {
            return Array.from(this._openProcessesTracked.values());
        }
    }

    // notes on process.kill
    // - should kill via signal, why does the corresponding close event say signal is null?
    // - there might be some weird nuances with signals that can be used here, especially on windows
    // - there's a delay before spawnAsync catches this
    // - todo: fix issues with killing a bionetgen process which has open sub-processes
    // -- if you kill the bionetgen process, spawnAsync will not register it as closed until its sub-processes are killed,
    //    so it will remain visible in the tree view although it no longer exists
    // -- attempts to use killAllProcesses() (eg. via process_cleanup command on deactivate) will fail
    // -- sub-processes will become orphans if you exit without killing them manually
    // -- killing a bionetgen process should probably also kill its sub-processes (?)

    killProcess(processObject) {
        process.kill(processObject.pid);
    }

    killAllProcesses() {
        for (const pid of this._openProcessesTracked.keys()) {
            process.kill(pid);
        }
        for (const pid of this._openProcessesUntracked.keys()) {
            process.kill(pid);
        }
    }
}

// WIP: sub-process tracking
async function getProcessList() { // (ppid) {

    return new Promise((resolve, reject) => {
        let processList = [];

        // todo: rename helpers, clean this stuff up

        // need some kind of error message if spawn fails for whatever reason

        // how to combine parent/child hierarchy with filtering and integrate all of this with tree view stuff in a clean way?
        // - consider nested children
        // - there are some intermediate processes that come up eg. python, command line; do we want to track these?
        // - how exactly does the tree data provider assemble the tree view?

        // windows
        if (process.platform === "win32") {
            let helper;

            /*
            // [not currently used] get processes which are children of the given process (only gets direct children)
            if (ppid) {
                helper = cp.spawn('Get-WmiObject', ['Win32_Process', '-Filter', `"ParentProcessId = ${ppid}"`, '|', 'Select-Object', 'ProcessID, Name'], {'shell':'powershell.exe'});
            }
            // if ppid is not given, get all processes
            else {
            */
                // get only processes which are relevant to bionetgen
                // - note: BNG2.pl shows up with name perl.exe
                //   (could be problematic if there happen to be other perl things running, need to either restrict to children of bionetgen processes or match on CommandLine or something)
                const processMatch = `"Name = 'perl.exe' or Name = 'NFsim.exe' or Name = 'run_network.exe'"`;
                helper = cp.spawn('Get-WmiObject', ['Win32_Process', '-Filter', processMatch, '|', 'Select-Object', 'ProcessID, Name'], {'shell':'powershell.exe'});
            /*
            }
            */

            // parse stdout to get information about open processes
            // results should be compatible with ProcessManager & getTreeItem()
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
                        const name = processInfo[1];
                        processList.push({
                            pid: pid,
                            name: name
                        });
                    }
                }
            });
            helper.on('close', () => {
                resolve(processList);
            });
        }
        // mac & linux
        else {
            // get full process list
            let helper;
            helper = cp.spawn('ps', ['ax', '-o', 'pid,command']);

            // filter process list to get only lines corresponding to processes relevant to bionetgen
            let helper2;
            helper2 = cp.spawn('grep', ['-e', 'BNG2\.pl', '-e', 'NFsim', '-e', 'run_network']);
            
            // remove instances of grep from results
            let helper3;
            helper3 = cp.spawn('grep', ['-v', 'grep']);

            // pipe output of ps to grep (workaround for not being able to use | as an argument in spawn)
            helper.stdout.pipe(helper2.stdin);
            helper2.stdout.pipe(helper3.stdin);

            // parse stdout to get information about open processes
            // results should be compatible with ProcessManager & getTreeItem()
            helper3.stdout.setEncoding('utf8'); // allows data to be passed as string; otherwise data is passed as buffer
            helper3.stdout.on('data', (data) => {
                // assumptions:
                // - chunks of data provided by grep consist only of lines containing relevant process information

                // trim whitespace & split by newline
                let lines = data.trim().split(/\n/);
                
                for (const line of lines) {
                    // split each line by whitespace to get process information
                    const processInfo = line.trim().split(/\s+/);
                    const pid = parseInt(processInfo[0]);
                    const name = processInfo[1];
                    processList.push({
                        pid: pid,
                        name: name
                    });
                }
            });
            helper3.on('close', () => {
                resolve(processList);
            });
        }
    });
}

module.exports = {
    ProcessManager,
    ProcessManagerProvider
}