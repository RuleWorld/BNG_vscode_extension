import * as assert from 'assert';
import { appendCommandArgs, createCommandSpec, formatCommandSpec } from '../../utils/commandSpec';
import { spawnAsync } from '../../utils/spawnAsync';

function getSuccessfulShellCommand() {
    if (process.platform === 'win32') {
        return createCommandSpec('cmd', ['/d', '/s', '/c', 'exit 0']);
    }

    return createCommandSpec('sh', ['-c', 'exit 0']);
}

suite('Command Utilities', () => {
    test('appends command arguments without mutating the original spec', () => {
        const base = createCommandSpec('python', ['-I']);
        const full = appendCommandArgs(base, ['-m', 'bionetgen']);

        assert.deepStrictEqual(base, createCommandSpec('python', ['-I']));
        assert.deepStrictEqual(full, createCommandSpec('python', ['-I', '-m', 'bionetgen']));
    });

    test('formats commands with quoted arguments', () => {
        const formatted = formatCommandSpec(createCommandSpec('/tmp/my python', ['-m', 'hello world']));

        if (process.platform === 'win32') {
            assert.strictEqual(formatted, "\"/tmp/my python\" -m \"hello world\"");
        } else {
            assert.strictEqual(formatted, "'/tmp/my python' -m 'hello world'");
        }
    });

    test('spawnAsync returns zero for a successful process', async () => {
        const exitCode = await spawnAsync(getSuccessfulShellCommand());
        assert.strictEqual(exitCode, 0);
    });

    test('spawnAsync returns non-zero when a process cannot be started', async () => {
        const exitCode = await spawnAsync(createCommandSpec('__bngl_missing_command_for_test__'));
        assert.notStrictEqual(exitCode, 0);
    });
});
