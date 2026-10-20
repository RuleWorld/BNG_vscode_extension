import * as assert from 'assert';
import { ProcessManager, ProcessManagerProvider } from '../../utils/processManagement';

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
