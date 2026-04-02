import * as vscode from 'vscode';
import * as cp from 'child_process';

const refreshInterval = 500;

interface TrackedProcessObject {
    pid: number;
    name: string;
    children?: TrackedProcessObject[];
}

interface UntrackedProcessObject {
    pid: number;
    ppid: number;
    name: string;
    children: UntrackedProcessObject[];
}

// tree data provider for tree view
export class ProcessManagerProvider implements vscode.TreeDataProvider<TrackedProcessObject> {
    private _processManager: ProcessManager;

    // for refresh
    private _onDidChangeTreeData: vscode.EventEmitter<TrackedProcessObject | undefined | null | void> = new vscode.EventEmitter<TrackedProcessObject | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TrackedProcessObject | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(processManager: ProcessManager) {
        this._processManager = processManager;
        this.refresh();
    }

    // return trackedProcessObject[] containing information about open processes at specified level of custom process tree
    getChildren(trackedProcessObject?: TrackedProcessObject): TrackedProcessObject[] {
        if (trackedProcessObject) {
            return trackedProcessObject.children || [];
        }
        else {
            return this._processManager.toplevelProcesses;
        }
    }

    // return TreeItem (to be displayed in VSCode UI) containing information about given process
    getTreeItem(trackedProcessObject: TrackedProcessObject): vscode.TreeItem {
        const pid = trackedProcessObject.pid;
        const name = trackedProcessObject.name.split(/[\\\/]/).pop()?.replace(".exe", "") || "unknown"; // take last segment of path if there is one, remove extension
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

export class ProcessManager {

    private _openProcessesTracked: Map<number, TrackedProcessObject>;
    private _openProcessesUntracked: Map<number, UntrackedProcessObject>;

    constructor() {
        this._openProcessesTracked = new Map();
        this._openProcessesUntracked = new Map();
    }

    // provides roots of custom process trees to be displayed in tree view
    get toplevelProcesses(): TrackedProcessObject[] {
        return Array.from(this._openProcessesTracked.values());
    }

    killAllProcesses() {
        for (const trackedProcessObject of this._openProcessesTracked.values()) {
            this.killProcess(trackedProcessObject);
        }
    }

    // kill process selected from tree view
    killProcess(trackedProcessObject: TrackedProcessObject) {
        if (trackedProcessObject) {
            // need to use the corresponding full process tree
            const untrackedProcessObject = this._openProcessesUntracked.get(trackedProcessObject.pid);
            if (untrackedProcessObject) {
                this._treeKill(untrackedProcessObject);
            }
        }
    }

    // kill all open sub-processes of the given process, then kill the given process
    private _treeKill(untrackedProcessObject: UntrackedProcessObject) {
        for (const child of untrackedProcessObject.children) {
            this._treeKill(child);
        }
        try {
            process.kill(untrackedProcessObject.pid);
        } catch (e) {
            // ignore if process already gone
        }
    }

    // called by spawnAsync when a new process is initiated
    add (pid: number, command: string) {
        this._openProcessesTracked.set(pid, {
            pid: pid,
            name: command
        });
    }

    // called by spawnAsync when a tracked process terminates
    delete (pid: number) {
        this._openProcessesTracked.delete(pid);
    }

    async refresh() {
        await this._buildFullProcessTree();
        // using information from full process tree, reconstruct custom process trees rooted at top-level tracked processes
        for (const trackedProcessObject of this._openProcessesTracked.values()) {
            this._reconstruct(trackedProcessObject);
        }
    }

    // use information from external process utility to build representation of full process tree
    private async _buildFullProcessTree() {
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
    private _reconstruct(trackedProcessObject: TrackedProcessObject) {
        // get full process tree rooted at given process
        const untrackedProcessObject = this._openProcessesUntracked.get(trackedProcessObject.pid);
        if (untrackedProcessObject) {
            // apply filter to get next level of children to include in custom process tree
            let filteredChildren = this._getFilteredChildren(untrackedProcessObject);
            
            trackedProcessObject.children = []; // refresh
            // recreate children and assign to trackedProcessObject
            for (const untrackedChild of filteredChildren) {
                const trackedChild: TrackedProcessObject = {
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
    private _getFilteredChildren(untrackedProcessObject: UntrackedProcessObject): UntrackedProcessObject[] {
        let filteredChildren: UntrackedProcessObject[] = [];
        const allChildren = untrackedProcessObject.children;
        for (const child of allChildren) {
            if (this._filter(child)) {
                filteredChildren.push(child);
            }
            // if a child is filtered out, attempt to promote its children to its level
            else {
                filteredChildren = filteredChildren.concat(this._getFilteredChildren(child));
            }
        }
        return filteredChildren;
    }

    // specify filter which determines whether a process from full process tree will be included in custom process tree
    private _filter(untrackedProcessObject: UntrackedProcessObject): boolean {
        // intermediate processes (eg. python, command line) are not included
        const nameMatch = /perl|NFsim|run_network/;
        return nameMatch.test(untrackedProcessObject.name);
    }

    // invoke external process utility to get list of open processes, return untrackedProcessObject[]
    private async _getProcessList(): Promise<UntrackedProcessObject[]> {

        return new Promise((resolve) => {
            let processList: UntrackedProcessObject[] = [];
            let util: cp.ChildProcess;

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
            util.stdout?.setEncoding('utf8');
            util.stdout?.on('data', (data) => {
                if (/[0-9]/.test(data)) {
                    let lines = data.trim().split(/\n/);
                    lines = lines.filter((line: string) => /[0-9]/.test(line));
                    
                    for (const line of lines) {
                        const processInfo = line.trim().split(/\s+/);
                        processList.push({
                            pid: parseInt(processInfo[0]),
                            ppid: parseInt(processInfo[1]),
                            name: processInfo[2],
                            children: []
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
