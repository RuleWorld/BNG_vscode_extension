import * as assert from 'assert';
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
