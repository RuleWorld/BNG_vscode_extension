import * as path from 'path';
import * as fs from 'fs/promises';
import * as cp from 'child_process';
import * as os from 'os';
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron';

const PYTHON_EXTENSION_ID = 'ms-python.python';

function getSanitizedEnv(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    return env;
}

async function ensureExtensionInstalled(cliPath: string, cliArgs: string[], extensionsDir: string, env: NodeJS.ProcessEnv): Promise<void> {
    const entries = await fs.readdir(extensionsDir).catch(() => []);
    const isInstalled = entries.some(entry => entry.toLowerCase().startsWith(`${PYTHON_EXTENSION_ID.toLowerCase()}-`));
    if (isInstalled) {
        return;
    }

    const installResult = cp.spawnSync(cliPath, [...cliArgs, '--install-extension', PYTHON_EXTENSION_ID], {
        encoding: 'utf-8',
        env,
    });

    if (installResult.status !== 0) {
        throw new Error([
            `Failed to install ${PYTHON_EXTENSION_ID} for extension tests.`,
            installResult.stdout,
            installResult.stderr,
        ].filter(Boolean).join('\n'));
    }
}

async function main() {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    const testWorkspacePath = await fs.mkdtemp(path.join(os.tmpdir(), 'bngl-vscode-test-workspace-'));
    const testEnv = getSanitizedEnv();
    const originalElectronRunAsNode = process.env.ELECTRON_RUN_AS_NODE;

    delete process.env.ELECTRON_RUN_AS_NODE;

    try {
        await fs.mkdir(path.join(testWorkspacePath, '.vscode'), { recursive: true });
        await fs.writeFile(
            path.join(testWorkspacePath, '.vscode', 'settings.json'),
            JSON.stringify({ 'bngl.general.auto_install': false }, null, 2),
            'utf8',
        );

        // Download VS Code and install extension dependencies
        const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
        const [cliPath, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
        const extensionsDir = path.join(extensionDevelopmentPath, '.vscode-test', 'extensions');

        await ensureExtensionInstalled(cliPath, cliArgs, extensionsDir, testEnv);

        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [testWorkspacePath],
        });
    } finally {
        if (typeof originalElectronRunAsNode === 'undefined') {
            delete process.env.ELECTRON_RUN_AS_NODE;
        } else {
            process.env.ELECTRON_RUN_AS_NODE = originalElectronRunAsNode;
        }
        await fs.rm(testWorkspacePath, { recursive: true, force: true });
    }
}

main().catch(err => {
    console.error('Failed to run tests:', err);
    process.exit(1);
});
