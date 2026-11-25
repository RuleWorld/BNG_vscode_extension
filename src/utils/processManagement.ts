import * as vscode from 'vscode';
import * as cp from 'child_process';
import { isSamePath } from './pathKey';

// The tree view re-lists processes every BASE ms while a job runs. Listing is cheap on POSIX
// (`ps`) but starts PowerShell + Get-CimInstance on Windows, so once the tree has stayed the
// same for UNCHANGED_REFRESHES_BEFORE_BACKOFF refreshes the interval doubles, up to MAX.
// Any change in the tree, or a tracked process starting or ending, resets it to BASE.
export const BASE_REFRESH_INTERVAL_MS = 500;
export const MAX_REFRESH_INTERVAL_MS = 4000;
export const UNCHANGED_REFRESHES_BEFORE_BACKOFF = 4;

export type TrackedProcessKind = 'simulation' | 'visualization' | 'setup' | 'other';

export interface TrackedProcessMetadata {
    label?: string;
    description?: string;
    tooltip?: string;
    kind?: TrackedProcessKind;
    modelPath?: string;
    resultsFolder?: string;
    startedAt?: number;
}

export interface TrackedProcessObject extends TrackedProcessMetadata {
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
export class ProcessManagerProvider implements vscode.TreeDataProvider<TrackedProcessObject>, vscode.Disposable {
    private _processManager: ProcessManager;

    // for refresh
    private _onDidChangeTreeData: vscode.EventEmitter<TrackedProcessObject | undefined | null | void> = new vscode.EventEmitter<TrackedProcessObject | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TrackedProcessObject | undefined | null | void> = this._onDidChangeTreeData.event;

    // self-rescheduling refresh timer; cleared on dispose so it stops with the extension host
    private _refreshTimer: ReturnType<typeof setTimeout> | undefined;
    private _refreshInterval = BASE_REFRESH_INTERVAL_MS;
    private _unchangedRefreshes = 0;
    private _refreshInFlight = false;
    // bumped whenever a tracked process is added or removed, so a refresh in flight sees it
    private _trackedGeneration = 0;
    private _trackedChangeSubscription: vscode.Disposable;
    private _disposed = false;

    constructor(processManager: ProcessManager) {
        this._processManager = processManager;
        this._trackedChangeSubscription = processManager.onDidChangeTrackedProcesses(() => this._onTrackedProcessesChanged());
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
        const label = trackedProcessObject.label || `${pid.toString()}: ${name}`;
        const collapsibleState = trackedProcessObject.children && trackedProcessObject.children.length > 0
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None;
        const item = new vscode.TreeItem(label, collapsibleState);
        item.description = trackedProcessObject.description;
        item.tooltip = trackedProcessObject.tooltip || [label, trackedProcessObject.description].filter(Boolean).join('\n');
        return item;
    }

    get refreshInterval(): number {
        return this._refreshInterval;
    }

    refresh() {
        if (this._disposed) {
            return;
        }
        this._refreshTimer = setTimeout(async () => {
            this._refreshTimer = undefined;
            if (this._processManager.hasTrackedProcesses) {
                this._refreshInFlight = true;
                const generation = this._trackedGeneration;
                const treeChanged = await this._processManager.refresh();
                this._refreshInFlight = false;
                this._recordRefresh(treeChanged || generation !== this._trackedGeneration);
                if (this._disposed) {
                    return;
                }
                this._onDidChangeTreeData.fire();
            } else {
                // no listing happens while idle, so there is nothing to back off from
                this._recordRefresh(true);
            }
            // an in-flight callback can resolve after dispose(); the guard in refresh() stops the re-arm
            this.refresh();
        }, this._refreshInterval);
    }

    private _recordRefresh(changed: boolean) {
        if (changed) {
            this._unchangedRefreshes = 0;
            this._refreshInterval = BASE_REFRESH_INTERVAL_MS;
            return;
        }
        this._unchangedRefreshes++;
        if (this._unchangedRefreshes >= UNCHANGED_REFRESHES_BEFORE_BACKOFF) {
            this._refreshInterval = Math.min(this._refreshInterval * 2, MAX_REFRESH_INTERVAL_MS);
        }
    }

    // a job started or ended: show it now and go back to the fast interval
    private _onTrackedProcessesChanged() {
        if (this._disposed) {
            return;
        }
        this._trackedGeneration++;
        this._recordRefresh(true);
        this._onDidChangeTreeData.fire();
        if (!this._refreshInFlight && this._refreshTimer) {
            clearTimeout(this._refreshTimer);
            this.refresh();
        }
    }

    dispose() {
        this._disposed = true;
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
            this._refreshTimer = undefined;
        }
        this._trackedChangeSubscription.dispose();
        this._onDidChangeTreeData.dispose();
    }
}

export class ProcessManager {

    private _openProcessesTracked: Map<number, TrackedProcessObject>;
    private _openProcessesUntracked: Map<number, UntrackedProcessObject>;
    private _onDidChangeTrackedProcesses: vscode.EventEmitter<void>;

    constructor() {
        this._openProcessesTracked = new Map();
        this._openProcessesUntracked = new Map();
        this._onDidChangeTrackedProcesses = new vscode.EventEmitter<void>();
    }

    get onDidChangeTrackedProcesses(): vscode.Event<void> {
        return this._onDidChangeTrackedProcesses.event;
    }

    // provides roots of custom process trees to be displayed in tree view
    get toplevelProcesses(): TrackedProcessObject[] {
        return Array.from(this._openProcessesTracked.values());
    }

    get hasTrackedProcesses(): boolean {
        return this._openProcessesTracked.size > 0;
    }

    getTrackedProcesses(kind?: TrackedProcessKind): TrackedProcessObject[] {
        const trackedProcesses = Array.from(this._openProcessesTracked.values());
        if (!kind) {
            return trackedProcesses;
        }

        return trackedProcesses.filter((trackedProcessObject) => trackedProcessObject.kind === kind);
    }

    countTrackedProcesses(kind?: TrackedProcessKind): number {
        return this.getTrackedProcesses(kind).length;
    }

    findTrackedProcessByModel(modelPath: string, kind?: TrackedProcessKind): TrackedProcessObject | undefined {
        return this.getTrackedProcesses(kind).find((trackedProcessObject) => {
            return typeof trackedProcessObject.modelPath === 'string'
                && isSamePath(trackedProcessObject.modelPath, modelPath);
        });
    }

    async killAllProcesses() {
        for (const trackedProcessObject of this._openProcessesTracked.values()) {
            await this.killProcess(trackedProcessObject);
        }
    }

    // kill process selected from tree view
    async killProcess(trackedProcessObject: TrackedProcessObject) {
        if (trackedProcessObject) {
            await this._buildFullProcessTree();
            // need to use the corresponding full process tree
            const untrackedProcessObject = this._openProcessesUntracked.get(trackedProcessObject.pid);
            if (untrackedProcessObject) {
                this._treeKill(untrackedProcessObject);
                return;
            }

            try {
                process.kill(trackedProcessObject.pid);
            } catch (e) {
                // ignore if process already gone
            }
        }
    }

    async killProcessByPid(pid: number) {
        const trackedProcessObject = this._openProcessesTracked.get(pid);
        if (trackedProcessObject) {
            await this.killProcess(trackedProcessObject);
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
    add (pid: number, command: string, metadata?: TrackedProcessMetadata) {
        this._openProcessesTracked.set(pid, {
            pid: pid,
            name: command,
            ...metadata
        });
        this._onDidChangeTrackedProcesses.fire();
    }

    // called by spawnAsync when a tracked process terminates
    delete (pid: number) {
        if (this._openProcessesTracked.delete(pid)) {
            this._onDidChangeTrackedProcesses.fire();
        }
    }

    // returns true if the tracked process trees differ from the previous refresh
    async refresh(): Promise<boolean> {
        const before = this._treeSignature();
        await this._buildFullProcessTree();
        // using information from full process tree, reconstruct custom process trees rooted at top-level tracked processes
        for (const trackedProcessObject of this._openProcessesTracked.values()) {
            this._reconstruct(trackedProcessObject);
        }
        return this._treeSignature() !== before;
    }

    private _treeSignature(): string {
        const sign = (node: TrackedProcessObject): string =>
            `${node.pid}:${node.name}(${(node.children ?? []).map(sign).join(',')})`;
        return this.toplevelProcesses.map(sign).join(';');
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
        const { command, args } = getProcessListCommand(process.platform);
        const parse = process.platform === 'win32' ? parseWindowsProcessCsv : parsePosixProcessList;

        return new Promise((resolve) => {
            let util: cp.ChildProcess;
            try {
                // no shell: the PowerShell pipeline travels as a single -Command argument;
                // windowsHide keeps the 500 ms refresh from flashing a console window
                util = cp.spawn(command, args, { windowsHide: true });
            } catch {
                resolve([]);
                return;
            }

            util.on('error', () => {
                resolve([]);
            });

            // buffer all stdout data and parse on close to avoid split-chunk issues
            let stdout = '';
            util.stdout?.setEncoding('utf8');
            util.stdout?.on('data', (data) => {
                stdout += data;
            });

            util.on('close', () => {
                resolve(parse(stdout).map((entry) => ({ ...entry, children: [] })));
            });
        });
    }
}

export interface ProcessListEntry {
    pid: number;
    ppid: number;
    name: string;
}

// Machine-readable process listing for Windows. ConvertTo-Csv avoids Format-Table's
// width-dependent wrapping/truncation; Get-CimInstance replaces the deprecated Get-WmiObject.
// Output is forced to UTF-8 so non-ASCII process names decode correctly.
export const WINDOWS_PROCESS_LIST_SCRIPT =
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; '
    + 'Get-CimInstance -ClassName Win32_Process '
    + '| Select-Object ProcessId, ParentProcessId, Name '
    + '| ConvertTo-Csv -NoTypeInformation';

export function getProcessListCommand(platform: NodeJS.Platform): { command: string; args: string[] } {
    if (platform === 'win32') {
        return {
            command: 'powershell.exe',
            // no -ExecutionPolicy: it governs script files, not -Command strings, and security tools flag it
            args: ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_PROCESS_LIST_SCRIPT]
        };
    }
    // comm is the executable alone (the full path on macOS, the possibly truncated process name on
    // Linux), so names with spaces survive and arguments such as model file names are never seen
    return { command: 'ps', args: ['ax', '-o', 'pid=,ppid=,comm='] };
}

// Split one CSV record into fields, honouring double-quoted fields and "" escapes.
function parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            fields.push(field);
            field = '';
        } else {
            field += ch;
        }
    }
    fields.push(field);
    return fields;
}

function toEntry(pidText: string | undefined, ppidText: string | undefined, name: string | undefined): ProcessListEntry | undefined {
    if (pidText === undefined || ppidText === undefined || !/^\d+$/.test(pidText.trim()) || !/^\d+$/.test(ppidText.trim())) {
        return undefined;
    }
    return { pid: parseInt(pidText, 10), ppid: parseInt(ppidText, 10), name: (name ?? '').trim() };
}

// Parse `ConvertTo-Csv` output of ProcessId, ParentProcessId, Name. Columns are located by
// header name, so column order and extra columns don't matter.
export function parseWindowsProcessCsv(stdout: string): ProcessListEntry[] {
    const lines = stdout.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim() !== '');
    const headerIndex = lines.findIndex((line) => /ProcessId/i.test(line));
    if (headerIndex < 0) {
        return [];
    }
    const header = parseCsvLine(lines[headerIndex]).map((h) => h.trim().toLowerCase());
    const pidCol = header.indexOf('processid');
    const ppidCol = header.indexOf('parentprocessid');
    const nameCol = header.indexOf('name');
    if (pidCol < 0 || ppidCol < 0) {
        return [];
    }

    const entries: ProcessListEntry[] = [];
    for (const line of lines.slice(headerIndex + 1)) {
        const fields = parseCsvLine(line);
        const entry = toEntry(fields[pidCol], fields[ppidCol], nameCol >= 0 ? fields[nameCol] : '');
        if (entry) {
            entries.push(entry);
        }
    }
    return entries;
}

// Parse `ps ax -o pid=,ppid=,comm=` output: two numeric columns, then the executable. The whole
// rest of the line is the name, because a macOS executable path can contain spaces.
export function parsePosixProcessList(stdout: string): ProcessListEntry[] {
    const entries: ProcessListEntry[] = [];
    for (const line of stdout.split(/\r?\n/)) {
        const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
        if (match) {
            const entry = toEntry(match[1], match[2], match[3]);
            if (entry) {
                entries.push(entry);
            }
        }
    }
    return entries;
}
