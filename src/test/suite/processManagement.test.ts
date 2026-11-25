import * as assert from 'assert';
import * as cp from 'child_process';
import { ProcessManager, ProcessManagerProvider, getProcessListCommand, parsePosixProcessList, parseWindowsProcessCsv, WINDOWS_PROCESS_LIST_SCRIPT } from '../../utils/processManagement';

suite('Process Manager', () => {
    test('tracks simulation metadata and finds active runs by model path', () => {
        const processManager = new ProcessManager();

        processManager.add(101, '/usr/bin/python', {
            label: 'model_a.bngl',
            description: 'results_model_a/2026_05_29__09_00_00',
            kind: 'simulation',
            modelPath: '/tmp/model_a.bngl',
            resultsFolder: '/tmp/results_model_a/2026_05_29__09_00_00',
            startedAt: 1
        });
        processManager.add(202, '/usr/bin/python', {
            label: 'model_b.bngl',
            kind: 'visualization',
            modelPath: '/tmp/model_b.bngl'
        });

        assert.strictEqual(processManager.countTrackedProcesses(), 2);
        assert.strictEqual(processManager.countTrackedProcesses('simulation'), 1);
        assert.strictEqual(processManager.countTrackedProcesses('visualization'), 1);

        const activeRun = processManager.findTrackedProcessByModel('/tmp/model_a.bngl', 'simulation');
        assert.ok(activeRun);
        assert.strictEqual(activeRun?.label, 'model_a.bngl');
        assert.strictEqual(activeRun?.description, 'results_model_a/2026_05_29__09_00_00');
    });

    test('removes tracked processes when deleted', () => {
        const processManager = new ProcessManager();

        processManager.add(303, '/usr/bin/python', {
            label: 'model_c.bngl',
            kind: 'simulation',
            modelPath: '/tmp/model_c.bngl'
        });

        assert.ok(processManager.findTrackedProcessByModel('/tmp/model_c.bngl', 'simulation'));

        processManager.delete(303);

        assert.strictEqual(processManager.countTrackedProcesses(), 0);
        assert.strictEqual(processManager.findTrackedProcessByModel('/tmp/model_c.bngl', 'simulation'), undefined);
    });
});

suite('Process Manager Provider', () => {
    // expose the private refresh-timer handle without firing the 500 ms timer during the test
    const refreshTimerOf = (provider: ProcessManagerProvider) =>
        (provider as unknown as { _refreshTimer?: ReturnType<typeof setTimeout> })._refreshTimer;

    test('dispose cancels the refresh loop and blocks re-arming', () => {
        const processManager = new ProcessManager();
        const provider = new ProcessManagerProvider(processManager);

        // constructor arms the self-rescheduling timer
        assert.ok(refreshTimerOf(provider), 'expected the constructor to arm a refresh timer');

        provider.dispose();

        // dispose clears the pending timer ...
        assert.strictEqual(refreshTimerOf(provider), undefined, 'dispose should clear the pending timer');

        // ... and the disposed guard stops refresh() from scheduling a new one
        provider.refresh();
        assert.strictEqual(refreshTimerOf(provider), undefined, 'refresh() after dispose should not re-arm');

        // dispose is idempotent
        assert.doesNotThrow(() => provider.dispose());
    });
});

suite('Process list parsing', () => {
    test('Windows command runs PowerShell directly with one -Command script and CSV output', () => {
        const spec = getProcessListCommand('win32');
        assert.strictEqual(spec.command, 'powershell.exe');
        const commandIndex = spec.args.indexOf('-Command');
        assert.ok(commandIndex >= 0, 'expected -Command');
        assert.strictEqual(spec.args.length, commandIndex + 2, 'script must be one argument after -Command');
        assert.strictEqual(spec.args[commandIndex + 1], WINDOWS_PROCESS_LIST_SCRIPT);
        assert.match(WINDOWS_PROCESS_LIST_SCRIPT, /Get-CimInstance/);
        assert.match(WINDOWS_PROCESS_LIST_SCRIPT, /ConvertTo-Csv -NoTypeInformation/);
        assert.doesNotMatch(WINDOWS_PROCESS_LIST_SCRIPT, /Get-WmiObject/);
        assert.ok(spec.args.includes('-NoProfile'));
    });

    test('POSIX command suppresses the ps header', () => {
        assert.deepStrictEqual(getProcessListCommand('darwin'), { command: 'ps', args: ['ax', '-o', 'pid=,ppid=,command='] });
        assert.deepStrictEqual(getProcessListCommand('linux'), getProcessListCommand('darwin'));
    });

    test('parses Windows PowerShell 5.1 CSV with CRLF line endings', () => {
        const stdout = [
            '"ProcessId","ParentProcessId","Name"',
            '"0","0","System Idle Process"',
            '"4","0","System"',
            '"5120","4400","python.exe"',
            '"6200","5120","perl.exe"',
            '"6300","6200","NFsim.exe"',
            ''
        ].join('\r\n');
        assert.deepStrictEqual(parseWindowsProcessCsv(stdout), [
            { pid: 0, ppid: 0, name: 'System Idle Process' },
            { pid: 4, ppid: 0, name: 'System' },
            { pid: 5120, ppid: 4400, name: 'python.exe' },
            { pid: 6200, ppid: 5120, name: 'perl.exe' },
            { pid: 6300, ppid: 6200, name: 'NFsim.exe' }
        ]);
    });

    test('Windows CSV parsing handles BOM, unquoted PowerShell 7 style, reordered columns, and quoted commas', () => {
        const stdout = '﻿Name,ParentProcessId,ProcessId\n'
            + '"odd, ""quoted"" name.exe",10,11\n'
            + 'run_network.exe,11,12\n';
        assert.deepStrictEqual(parseWindowsProcessCsv(stdout), [
            { pid: 11, ppid: 10, name: 'odd, "quoted" name.exe' },
            { pid: 12, ppid: 11, name: 'run_network.exe' }
        ]);
    });

    test('Windows CSV parsing ignores preamble, errors, and malformed rows', () => {
        const stdout = 'WARNING: something noisy\n'
            + '"ProcessId","ParentProcessId","Name"\n'
            + '"abc","1","bad.exe"\n'
            + '"7"\n'
            + '"8","1","ok.exe"\n';
        assert.deepStrictEqual(parseWindowsProcessCsv(stdout), [{ pid: 8, ppid: 1, name: 'ok.exe' }]);
        assert.deepStrictEqual(parseWindowsProcessCsv(''), []);
        assert.deepStrictEqual(parseWindowsProcessCsv('Get-CimInstance : Access denied'), []);
    });

    test('parses POSIX ps output and keeps the executable as the name', () => {
        const stdout = '    1     0 /sbin/launchd\n'
            + '  500     1 /usr/bin/python3 -m bionetgen run -i perl_model.bngl\n'
            + '  501   500 /usr/bin/perl /opt/BioNetGen/BNG2.pl model.bngl\n'
            + 'garbage line\n';
        assert.deepStrictEqual(parsePosixProcessList(stdout), [
            { pid: 1, ppid: 0, name: '/sbin/launchd' },
            { pid: 500, ppid: 1, name: '/usr/bin/python3' },
            { pid: 501, ppid: 500, name: '/usr/bin/perl' }
        ]);
    });

    test('killProcess kills the whole tree built from the parsed list, children first', async () => {
        const processManager = new ProcessManager();
        processManager.add(5120, 'python.exe', { kind: 'simulation' });
        const csv = '"ProcessId","ParentProcessId","Name"\r\n"5120","4400","python.exe"\r\n'
            + '"6200","5120","perl.exe"\r\n"6300","6200","NFsim.exe"\r\n"9999","1","unrelated.exe"\r\n';
        (processManager as unknown as { _getProcessList: () => Promise<unknown[]> })._getProcessList = async () =>
            parseWindowsProcessCsv(csv).map((entry) => ({ ...entry, children: [] }));

        const killed: number[] = [];
        const originalKill = process.kill;
        (process as unknown as { kill: (pid: number) => boolean }).kill = (pid: number) => { killed.push(pid); return true; };
        try {
            await processManager.killProcess(processManager.getTrackedProcesses()[0]);
        } finally {
            process.kill = originalKill;
        }
        assert.deepStrictEqual(killed, [6300, 6200, 5120]);
    });

    test('refresh shows perl and NFsim children of a tracked Windows job', async () => {
        const processManager = new ProcessManager();
        processManager.add(5120, 'python.exe', { kind: 'simulation' });
        const csv = '"ProcessId","ParentProcessId","Name"\r\n"5120","4400","python.exe"\r\n'
            + '"6100","5120","cmd.exe"\r\n"6200","6100","perl.exe"\r\n"6300","6200","NFsim.exe"\r\n';
        (processManager as unknown as { _getProcessList: () => Promise<unknown[]> })._getProcessList = async () =>
            parseWindowsProcessCsv(csv).map((entry) => ({ ...entry, children: [] }));

        await processManager.refresh();
        const root = processManager.getTrackedProcesses()[0];
        assert.deepStrictEqual(root.children?.map((c) => c.name), ['perl.exe']);
        assert.deepStrictEqual(root.children?.[0].children?.map((c) => c.name), ['NFsim.exe']);
    });
});

// Runs the real platform process listing (PowerShell/CIM on Windows, ps elsewhere) against live
// processes, so the Windows CI runner validates #31 end to end rather than only the fixtures.
suite('Process Manager (live processes)', function () {
    this.timeout(60_000);

    // the extension host's execPath is Electron; ELECTRON_RUN_AS_NODE makes it behave as node
    const nodeEnv = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
    const grandchildScript = 'setInterval(() => {}, 1000);';
    const childScript = [
        "const cp = require('child_process');",
        `const g = cp.spawn(process.execPath, ['-e', ${JSON.stringify(grandchildScript)}], { stdio: 'ignore', windowsHide: true });`,
        "process.stdout.write(String(g.pid) + '\\n');",
        'setInterval(() => {}, 1000);'
    ].join('\n');

    const isAlive = (pid: number) => {
        try {
            process.kill(pid, 0);
            return true;
        } catch (e) {
            return (e as NodeJS.ErrnoException).code === 'EPERM';
        }
    };

    const waitFor = async (predicate: () => boolean, timeoutMs: number) => {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            if (predicate()) {
                return true;
            }
            await new Promise((r) => setTimeout(r, 100));
        }
        return predicate();
    };

    let child: cp.ChildProcess | undefined;
    let grandchildPid: number | undefined;

    setup(async () => {
        child = cp.spawn(process.execPath, ['-e', childScript], { env: nodeEnv, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
        grandchildPid = await new Promise<number>((resolve, reject) => {
            let out = '';
            child!.stdout!.setEncoding('utf8');
            child!.stdout!.on('data', (d) => {
                out += d;
                const m = /(\d+)\n/.exec(out);
                if (m) {
                    resolve(parseInt(m[1], 10));
                }
            });
            child!.on('error', reject);
            child!.on('exit', () => reject(new Error('child exited before reporting grandchild pid')));
        });
    });

    teardown(() => {
        for (const pid of [grandchildPid, child?.pid]) {
            if (pid && isAlive(pid)) {
                try { process.kill(pid); } catch { /* already gone */ }
            }
        }
    });

    test('process listing reports live child and grandchild with correct parents', async () => {
        const processManager = new ProcessManager();
        const list = await (processManager as unknown as { _getProcessList: () => Promise<{ pid: number; ppid: number; name: string }[]> })._getProcessList();
        const byPid = new Map(list.map((p) => [p.pid, p]));

        assert.ok(byPid.size > 0, 'process listing returned nothing');
        assert.strictEqual(byPid.get(child!.pid!)?.ppid, process.pid, 'child should be listed under the test host');
        assert.strictEqual(byPid.get(grandchildPid!)?.ppid, child!.pid, 'grandchild should be listed under the child');
    });

    test('killProcess terminates the whole live process tree', async () => {
        const processManager = new ProcessManager();
        processManager.add(child!.pid!, process.execPath, { kind: 'simulation' });

        await processManager.killProcess(processManager.getTrackedProcesses()[0]);

        assert.ok(await waitFor(() => !isAlive(grandchildPid!), 10_000), 'grandchild survived killProcess');
        assert.ok(await waitFor(() => !isAlive(child!.pid!), 10_000), 'child survived killProcess');
    });
});
