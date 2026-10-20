import * as vscode from 'vscode';
import * as path from 'path';
import { spawnAsync } from '../utils/spawnAsync';
import { getPythonCommand } from '../utils/getPythonPath';
import { CommandSpec, appendCommandArgs, createCommandSpec, formatCommandSpec } from '../utils/commandSpec';
import { ProcessManager } from '../utils/processManagement';
import { startLogStreaming } from '../utils/logStreaming';
import { PlotPanel } from '../plotting/PlotPanel';
import { parseBnglDocument } from '../server/parser';
import {
    getModelFolderUri,
    getResultsBaseFolderUri,
    getResultsFolderConfigurationTarget,
    getResultsRetentionPolicy,
    getResultsRetentionPolicyLabel,
    getResultsRootFolderName,
    getResultsRootUri,
    getResultsRunFolderUri,
    ResultsRetentionPolicy,
    shouldDeleteGeneratedResultsRunFolder,
} from '../resultsFolders';

export interface CommandContext {
    processManager: ProcessManager;
    channel: vscode.OutputChannel;
    pybngVersion: string;
    extensionContext: vscode.ExtensionContext;
}

export type VisualizationType = 'all' | 'contactmap' | 'regulatory' | 'ruleviz';
type ResultsFolderAction = 'default' | 'workspace' | 'choose' | 'retention_keep_all' | 'retention_1h' | 'retention_1d' | 'retention_1w' | 'retention_purge';

interface ResultsFolderMenuItem extends vscode.QuickPickItem {
    action: ResultsFolderAction;
}

const PYBIONETGEN_ENTRYPOINT = 'from bionetgen.main import main as _bng_main; raise SystemExit(_bng_main())';
const PYBIONETGEN_PACKAGE = 'bionetgen';
const PYBIONETGEN_SETUPTOOLS_COMPAT_SPEC = 'setuptools<82';
const PYBIONETGEN_COMPATIBILITY_CHECK = 'import pkg_resources; import bionetgen';
const STANDALONE_REGULATORY_VISUALIZE_ACTION = 'visualize({type=>"regulatory",ruleNames=>1})';
const STANDALONE_RULEVIZ_PATTERN_VISUALIZE_ACTION = 'visualize({type=>"ruleviz_pattern",each=>1})';
const STANDALONE_RULEVIZ_OPERATION_VISUALIZE_ACTION = 'visualize({type=>"ruleviz_operation",each=>1})';
const PLOT_OUTPUT_EXTENSION_PRIORITY = new Map([
    ['gdat', 0],
    ['scan', 1],
    ['cdat', 2],
]);

function getTimestampedFolderName(): string {
    // Second-resolution local time. The YYYY_MM_DD__HH_MM_SS format must be preserved: the
    // retention pruning in resultsFolders.ts matches exactly that pattern, so adding sub-second
    // precision here without updating that matcher would break pruning. Two runs within the same
    // second therefore share a run folder (createDirectory is idempotent).
    const d = new Date();
    return `${d.getFullYear()}_${(d.getMonth() + 1).toString().padStart(2, '0')}_${d.getDate().toString().padStart(2, '0')}__${d.getHours().toString().padStart(2, '0')}_${d.getMinutes().toString().padStart(2, '0')}_${d.getSeconds().toString().padStart(2, '0')}`;
}

function getPlotOutputExtension(fileName: string): string | undefined {
    const extension = path.extname(fileName).slice(1).toLowerCase();
    return PLOT_OUTPUT_EXTENSION_PRIORITY.has(extension) ? extension : undefined;
}

function isPlotOutputFileName(fileName: string): boolean {
    return typeof getPlotOutputExtension(fileName) === 'string';
}

function getActionStringArgument(args: string, argumentName: string): string | undefined {
    const quotedMatch = args.match(new RegExp(`${argumentName}\\s*=>\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'i'));
    if (quotedMatch) {
        return quotedMatch[1]
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .trim();
    }

    const singleQuotedMatch = args.match(new RegExp(`${argumentName}\\s*=>\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'i'));
    if (singleQuotedMatch) {
        return singleQuotedMatch[1]
            .replace(/\\'/g, '\'')
            .replace(/\\\\/g, '\\')
            .trim();
    }

    const bareMatch = args.match(new RegExp(`${argumentName}\\s*=>\\s*([A-Za-z0-9_.#-]+)`, 'i'));
    return bareMatch?.[1]?.trim();
}

function getActionOutputBaseName(modelBaseName: string, actionArgs: string): string {
    const suffix = getActionStringArgument(actionArgs, 'suffix');
    return suffix ? `${modelBaseName}_${suffix}` : modelBaseName;
}

interface ExpectedPlotOutputs {
    hasRecognizedActions: boolean;
    hasSimulateActions: boolean;
    hasScanActions: boolean;
    simulateBaseNames: Set<string>;
    scanBaseNames: Set<string>;
}

function getExpectedPlotOutputs(sourceText: string | undefined, modelBaseName: string): ExpectedPlotOutputs {
    const expected: ExpectedPlotOutputs = {
        hasRecognizedActions: false,
        hasSimulateActions: false,
        hasScanActions: false,
        simulateBaseNames: new Set<string>(),
        scanBaseNames: new Set<string>(),
    };

    if (!sourceText || sourceText.trim().length === 0) {
        return expected;
    }

    const document = parseBnglDocument(sourceText);
    for (const action of document.actions) {
        const actionName = action.name.toLowerCase();
        const baseName = getActionOutputBaseName(modelBaseName, action.args);

        if (actionName === 'simulate') {
            expected.hasRecognizedActions = true;
            expected.hasSimulateActions = true;
            expected.simulateBaseNames.add(baseName);
            continue;
        }

        if (actionName === 'parameter_scan' || actionName === 'bifurcate') {
            expected.hasRecognizedActions = true;
            expected.hasScanActions = true;
            expected.scanBaseNames.add(baseName);
        }
    }

    return expected;
}

function suppressCdatWhenPreferredOutputsExist(fileNames: readonly string[]): string[] {
    const hasPreferredOutput = fileNames.some((name) => {
        const extension = getPlotOutputExtension(name);
        return extension === 'gdat' || extension === 'scan';
    });

    return hasPreferredOutput
        ? fileNames.filter((name) => getPlotOutputExtension(name) !== 'cdat')
        : [...fileNames];
}

function orderPlotOutputFileNames(fileNames: readonly string[], preferredBaseName?: string): string[] {
    return [...fileNames].sort((left, right) => {
        const leftBase = path.basename(left, path.extname(left));
        const rightBase = path.basename(right, path.extname(right));
        const leftPreferred = preferredBaseName && leftBase === preferredBaseName ? 0 : 1;
        const rightPreferred = preferredBaseName && rightBase === preferredBaseName ? 0 : 1;

        if (leftPreferred !== rightPreferred) {
            return leftPreferred - rightPreferred;
        }

        const leftExtensionPriority = PLOT_OUTPUT_EXTENSION_PRIORITY.get(getPlotOutputExtension(left) ?? '') ?? Number.MAX_SAFE_INTEGER;
        const rightExtensionPriority = PLOT_OUTPUT_EXTENSION_PRIORITY.get(getPlotOutputExtension(right) ?? '') ?? Number.MAX_SAFE_INTEGER;
        if (leftExtensionPriority !== rightExtensionPriority) {
            return leftExtensionPriority - rightExtensionPriority;
        }

        return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
    });
}

export function getAutoOpenPlotOutputFileNames(
    fileNames: readonly string[],
    preferredBaseName: string,
    sourceText?: string
): string[] {
    const plotOutputNames = fileNames.filter((name) => isPlotOutputFileName(name));
    if (plotOutputNames.length === 0) {
        return [];
    }

    const expected = getExpectedPlotOutputs(sourceText, preferredBaseName);
    if (expected.hasRecognizedActions) {
        const explicitlySelected = suppressCdatWhenPreferredOutputsExist(
            plotOutputNames.filter((name) => {
                const baseName = path.basename(name, path.extname(name));
                const extension = getPlotOutputExtension(name);

                if (extension === 'scan') {
                    return expected.scanBaseNames.has(baseName);
                }

                if (extension === 'gdat' || extension === 'cdat') {
                    return expected.simulateBaseNames.has(baseName);
                }

                return false;
            })
        );

        if (explicitlySelected.length > 0) {
            return orderPlotOutputFileNames(explicitlySelected, preferredBaseName);
        }

        if (expected.hasScanActions && !expected.hasSimulateActions) {
            return [];
        }
    }

    return orderPlotOutputFileNames(
        suppressCdatWhenPreferredOutputsExist(plotOutputNames),
        preferredBaseName
    );
}

async function checkPlotOutputs(outDir: string, preferredBaseName: string, sourceText: string, timeout: number): Promise<void> {
    const dirUri = vscode.Uri.file(outDir);
    try {
        const entries = await vscode.workspace.fs.readDirectory(dirUri);
        const availableOutputs = getAutoOpenPlotOutputFileNames(
            entries
                .filter(([, type]) => type === vscode.FileType.File)
                .map(([name]) => name),
            preferredBaseName,
            sourceText
        );
        if (availableOutputs.length > 0) {
            return;
        }
    } catch {
        // directory may not exist yet — fall through to watcher
    }

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            watchers.forEach((watcher) => watcher.dispose());
            reject(new Error('Timeout waiting for plot output'));
        }, timeout);

        const watchers = Array.from(PLOT_OUTPUT_EXTENSION_PRIORITY.keys()).map((extension) => {
            const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(outDir, `*.${extension}`));
            watcher.onDidCreate(async () => {
                try {
                    const entries = await vscode.workspace.fs.readDirectory(dirUri);
                    const availableOutputs = getAutoOpenPlotOutputFileNames(
                        entries
                            .filter(([, type]) => type === vscode.FileType.File)
                            .map(([name]) => name),
                        preferredBaseName,
                        sourceText
                    );
                    if (availableOutputs.length === 0) {
                        return;
                    }

                    clearTimeout(timer);
                    watchers.forEach((currentWatcher) => currentWatcher.dispose());
                    resolve();
                } catch {
                    // ignore transient file-system errors while the run is still active
                }
            });
            return watcher;
        });
    });
}

async function openPlotOutputs(folderUri: vscode.Uri, fnameNoext: string, sourceText: string, extensionContext: vscode.ExtensionContext, targetColumn?: vscode.ViewColumn) {
    const files = await vscode.workspace.fs.readDirectory(folderUri);
    const plotOutputNames = getAutoOpenPlotOutputFileNames(
        files
            .filter(([, type]) => type === vscode.FileType.File)
            .map(([name]) => name),
        fnameNoext,
        sourceText
    );

    for (const plotOutputName of plotOutputNames) {
        PlotPanel.create(
            extensionContext.extensionUri,
            vscode.Uri.joinPath(folderUri, plotOutputName),
            targetColumn
        );
    }
}

function createBionetgenCommand(pythonCommand: CommandSpec, pybngVersion: string, args: string[]): CommandSpec {
    return appendCommandArgs(pythonCommand, ['-c', PYBIONETGEN_ENTRYPOINT, '-req', pybngVersion, ...args]);
}

function createPipCommand(pythonCommand: CommandSpec, args: string[]): CommandSpec {
    return appendCommandArgs(pythonCommand, ['-m', 'pip', ...args]);
}

function createPyBioNetGenInstallCommand(pythonCommand: CommandSpec): CommandSpec {
    return createPipCommand(pythonCommand, ['install', '--upgrade', PYBIONETGEN_PACKAGE, PYBIONETGEN_SETUPTOOLS_COMPAT_SPEC]);
}

function createPyBioNetGenCompatibilityRepairCommand(pythonCommand: CommandSpec): CommandSpec {
    return createPipCommand(pythonCommand, ['install', '--upgrade', PYBIONETGEN_SETUPTOOLS_COMPAT_SPEC]);
}

function createPyBioNetGenCompatibilityCheckCommand(pythonCommand: CommandSpec): CommandSpec {
    return appendCommandArgs(pythonCommand, ['-c', PYBIONETGEN_COMPATIBILITY_CHECK]);
}

async function ensurePyBioNetGenCompatibility(ctx: CommandContext, pythonCommand: CommandSpec): Promise<boolean> {
    ctx.channel.appendLine('Checking PyBioNetGen compatibility.');
    const compatibilityCheckExitCode = await spawnAsync(
        createPyBioNetGenCompatibilityCheckCommand(pythonCommand),
        ctx.channel,
        ctx.processManager
    );

    if (compatibilityCheckExitCode === 0) {
        ctx.channel.appendLine('PyBioNetGen compatibility check passed.');
        return true;
    }

    ctx.channel.appendLine(`PyBioNetGen compatibility check failed; installing ${PYBIONETGEN_SETUPTOOLS_COMPAT_SPEC}.`);
    const repairExitCode = await spawnAsync(
        createPyBioNetGenCompatibilityRepairCommand(pythonCommand),
        ctx.channel,
        ctx.processManager
    );

    if (repairExitCode !== 0) {
        ctx.channel.appendLine(`Compatibility repair failed for python command: ${formatCommandSpec(pythonCommand)}`);
        return false;
    }

    ctx.channel.appendLine('Re-checking PyBioNetGen compatibility.');
    const finalCheckExitCode = await spawnAsync(
        createPyBioNetGenCompatibilityCheckCommand(pythonCommand),
        ctx.channel,
        ctx.processManager
    );

    if (finalCheckExitCode !== 0) {
        ctx.channel.appendLine(`PyBioNetGen compatibility is still broken after repair for python command: ${formatCommandSpec(pythonCommand)}`);
        return false;
    }

    ctx.channel.appendLine(`PyBioNetGen compatibility repaired for python command: ${formatCommandSpec(pythonCommand)}`);
    return true;
}

function getVisualizationCommandLabel(visualizationType: VisualizationType): string {
    if (visualizationType === 'contactmap') {
        return 'contact map';
    }

    if (visualizationType === 'regulatory') {
        return 'regulatory graph';
    }

    if (visualizationType === 'ruleviz') {
        return 'RuleViz';
    }

    return 'visualization graphs';
}

function getCommandTargetUri(target?: unknown): vscode.Uri | undefined {
    if (target instanceof vscode.Uri) {
        return target;
    }

    if (typeof target === 'string' && target.length > 0) {
        return vscode.Uri.file(target);
    }

    if (target && typeof target === 'object' && 'fsPath' in target) {
        const fsPath = (target as { fsPath?: unknown }).fsPath;
        if (typeof fsPath === 'string' && fsPath.length > 0) {
            return vscode.Uri.file(fsPath);
        }
    }

    return vscode.window.activeTextEditor?.document.uri;
}

function getBnglTargetUri(target?: unknown): vscode.Uri | undefined {
    const targetUri = getCommandTargetUri(target);
    if (!targetUri) {
        return undefined;
    }

    return path.extname(targetUri.fsPath).toLowerCase() === '.bngl' ? targetUri : undefined;
}

function getRunFolderLabel(runFolderUri: vscode.Uri): string {
    return `${path.basename(path.dirname(runFolderUri.fsPath))}/${path.basename(runFolderUri.fsPath)}`;
}

function describeRunFolder(runFolderUri: vscode.Uri): string {
    return `${getRunFolderLabel(runFolderUri)} (${runFolderUri.fsPath})`;
}

function isSamePath(leftPath: string, rightPath: string): boolean {
    return path.resolve(leftPath) === path.resolve(rightPath);
}

async function confirmSimulationRerun(ctx: CommandContext, docUri: vscode.Uri): Promise<boolean> {
    const activeRun = ctx.processManager.findTrackedProcessByModel(docUri.fsPath, 'simulation');
    if (!activeRun) {
        return true;
    }

    const activeRunLabel = activeRun.description || activeRun.resultsFolder || 'an existing results folder';
    const selection = await vscode.window.showWarningMessage(
        `A simulation for ${path.basename(docUri.fsPath)} is already running in ${activeRunLabel}. Starting another copy can consume a lot of time and CPU.`,
        { modal: true },
        'Manage Active Runs',
        'Run Again'
    );

    if (selection === 'Manage Active Runs') {
        await vscode.commands.executeCommand('bng.manage_processes');
        return false;
    }

    return selection === 'Run Again';
}

async function updateResultsFolderSetting(docUri: vscode.Uri, folderPath: string | null): Promise<vscode.WorkspaceConfiguration> {
    const config = vscode.workspace.getConfiguration('bngl', docUri);
    const target = getResultsFolderConfigurationTarget(docUri);
    await config.update('general.result_folder', folderPath, target);
    return vscode.workspace.getConfiguration('bngl', docUri);
}

async function updateResultsRetentionSetting(docUri: vscode.Uri, retentionPolicy: ResultsRetentionPolicy): Promise<vscode.WorkspaceConfiguration> {
    const config = vscode.workspace.getConfiguration('bngl', docUri);
    const target = getResultsFolderConfigurationTarget(docUri);
    await config.update('general.results_retention', retentionPolicy, target);
    return vscode.workspace.getConfiguration('bngl', docUri);
}

async function chooseCustomResultsFolder(docUri: vscode.Uri): Promise<vscode.Uri | undefined> {
    const config = vscode.workspace.getConfiguration('bngl', docUri);
    const currentBaseFolderUri = getResultsBaseFolderUri(config, docUri);
    const selection = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: currentBaseFolderUri,
        openLabel: 'Use Results Folder'
    });

    return selection?.[0];
}

function getResultsRetentionPolicyForAction(action: ResultsFolderAction): ResultsRetentionPolicy | undefined {
    if (action === 'retention_purge') {
        return 'purge_existing';
    }

    if (action === 'retention_1h') {
        return 'delete_older_than_1h';
    }

    if (action === 'retention_1d') {
        return 'delete_older_than_1d';
    }

    if (action === 'retention_1w') {
        return 'delete_older_than_1w';
    }

    if (action === 'retention_keep_all') {
        return 'keep_all';
    }

    return undefined;
}

function getResultsRetentionPolicyDescription(policy: ResultsRetentionPolicy): string {
    if (policy === 'purge_existing') {
        return 'Before future runs, all pre-existing timestamped run folders will be deleted from this model\'s results root.';
    }

    if (policy === 'delete_older_than_1h') {
        return 'Before future runs, old timestamped run folders older than 1 hour will be deleted from this model\'s results root.';
    }

    if (policy === 'delete_older_than_1d') {
        return 'Before future runs, old timestamped run folders older than 1 day will be deleted from this model\'s results root.';
    }

    if (policy === 'delete_older_than_1w') {
        return 'Before future runs, old timestamped run folders older than 1 week will be deleted from this model\'s results root.';
    }

    return 'Before future runs, timestamped run folders will accumulate until you remove them manually.';
}

function getActiveResultsRunFolderPaths(processManager: ProcessManager, resultsRootPath: string): Set<string> {
    const normalizedResultsRootPath = path.resolve(resultsRootPath);

    return new Set(
        processManager
            .getTrackedProcesses()
            .flatMap((trackedProcessObject) => {
                if (typeof trackedProcessObject.resultsFolder !== 'string') {
                    return [];
                }

                const trackedResultsFolderPath = path.resolve(trackedProcessObject.resultsFolder);
                if (path.resolve(path.dirname(trackedResultsFolderPath)) !== normalizedResultsRootPath) {
                    return [];
                }

                return [trackedResultsFolderPath];
            })
    );
}

async function pruneStaleResultsRunFolders(
    ctx: CommandContext,
    resultsRootUri: vscode.Uri,
    retentionPolicy: ResultsRetentionPolicy
): Promise<number> {
    if (retentionPolicy === 'keep_all') {
        return 0;
    }

    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(resultsRootUri);
    } catch {
        return 0;
    }

    const activeRunFolderPaths = getActiveResultsRunFolderPaths(ctx.processManager, resultsRootUri.fsPath);
    let deletedCount = 0;

    for (const [name, fileType] of entries) {
        if (fileType !== vscode.FileType.Directory) {
            continue;
        }

        if (!shouldDeleteGeneratedResultsRunFolder(name, retentionPolicy)) {
            continue;
        }

        const runFolderUri = vscode.Uri.joinPath(resultsRootUri, name);
        const normalizedRunFolderPath = path.resolve(runFolderUri.fsPath);
        if (activeRunFolderPaths.has(normalizedRunFolderPath)) {
            ctx.channel.appendLine(`Skipping cleanup for active results folder: ${runFolderUri.fsPath}`);
            continue;
        }

        PlotPanel.disposeForFolder(runFolderUri.fsPath);

        try {
            await vscode.workspace.fs.delete(runFolderUri, { recursive: true, useTrash: false });
            deletedCount += 1;
            ctx.channel.appendLine(`Deleted stale results folder: ${runFolderUri.fsPath}`);
        } catch (err) {
            ctx.channel.appendLine(`Could not delete stale results folder ${runFolderUri.fsPath}: ${err}`);
        }
    }

    return deletedCount;
}

async function prepareResultsRunFolder(
    ctx: CommandContext,
    config: vscode.WorkspaceConfiguration,
    docUri: vscode.Uri,
    timestamp: string
): Promise<vscode.Uri> {
    const resultsRootUri = getResultsRootUri(config, docUri);
    const retentionPolicy = getResultsRetentionPolicy(config);
    const deletedCount = await pruneStaleResultsRunFolders(ctx, resultsRootUri, retentionPolicy);
    if (deletedCount > 0) {
        ctx.channel.appendLine(`Cleaned up ${deletedCount} stale results folder${deletedCount === 1 ? '' : 's'} from ${resultsRootUri.fsPath}.`);
    }

    const resultsRunFolderUri = getResultsRunFolderUri(config, docUri, timestamp);
    await vscode.workspace.fs.createDirectory(resultsRunFolderUri);
    return resultsRunFolderUri;
}

function getVisualizationOutputMatcher(visualizationType: VisualizationType) {
    if (visualizationType === 'contactmap') {
        return (name: string) => name.toLowerCase().endsWith('_contactmap.graphml') || name.toLowerCase().includes('contactmap');
    }

    if (visualizationType === 'regulatory') {
        return (name: string) => name.toLowerCase().endsWith('_regulatory.graphml') || name.toLowerCase().includes('regulatory');
    }

    if (visualizationType === 'ruleviz') {
        return (name: string) => {
            const normalizedName = name.toLowerCase();
            return normalizedName.endsWith('.graphml')
                && (normalizedName.includes('ruleviz_operation') || normalizedName.includes('ruleviz_pattern'));
        };
    }

    return (name: string) => name.toLowerCase().endsWith('.graphml');
}

function createStandaloneVisualizationInputText(sourceText: string, visualizeAction: string | readonly string[]): string {
    const document = parseBnglDocument(sourceText);
    const lineEnding = sourceText.includes('\r\n') ? '\r\n' : '\n';
    const lines = sourceText.split(/\r?\n/);
    const skippedLines = new Set<number>();
    const visualizeActions = Array.isArray(visualizeAction) ? Array.from(visualizeAction) : [visualizeAction];

    for (const block of document.blocks) {
        if (block.type !== 'actions' && block.type !== 'protocol') {
            continue;
        }

        const endLine = block.endLine >= block.startLine ? block.endLine : lines.length - 1;
        for (let line = block.startLine; line <= Math.min(endLine, lines.length - 1); line += 1) {
            skippedLines.add(line);
        }
    }

    for (const action of document.actions) {
        skippedLines.add(action.line);
    }

    const keptLines = lines.filter((_, index) => !skippedLines.has(index));
    while (keptLines.length > 0 && keptLines[keptLines.length - 1].trim() === '') {
        keptLines.pop();
    }

    if (keptLines.length > 0) {
        keptLines.push('');
    }

    keptLines.push(...visualizeActions, '');
    return keptLines.join(lineEnding);
}

export function createStandaloneRegulatoryInputText(sourceText: string): string {
    return createStandaloneVisualizationInputText(sourceText, STANDALONE_REGULATORY_VISUALIZE_ACTION);
}

export function createStandaloneRulevizInputText(sourceText: string): string {
    return createStandaloneVisualizationInputText(sourceText, [
        STANDALONE_RULEVIZ_PATTERN_VISUALIZE_ACTION,
        STANDALONE_RULEVIZ_OPERATION_VISUALIZE_ACTION
    ]);
}

async function openVisualizationOutputs(
    folderUri: vscode.Uri,
    visualizationType: VisualizationType,
    extensionContext: vscode.ExtensionContext,
    channel: vscode.OutputChannel,
    targetColumn?: vscode.ViewColumn
) {
    const files = await vscode.workspace.fs.readDirectory(folderUri);
    const matches = files
        .map(([name]) => name)
        .filter(getVisualizationOutputMatcher(visualizationType))
        .sort((left, right) => left.localeCompare(right));

    if (matches.length === 0) {
        channel.appendLine(`No GraphML output matched visualization type "${visualizationType}" in ${folderUri.fsPath}`);
        return;
    }

    if (visualizationType === 'ruleviz') {
        const preferredFileName = matches.find((name) => name.toLowerCase().includes('ruleviz_pattern'))
            ?? matches.find((name) => name.toLowerCase().includes('ruleviz_operation'))
            ?? matches[0];
        const graphmlUri = vscode.Uri.joinPath(folderUri, preferredFileName);
        PlotPanel.create(extensionContext.extensionUri, graphmlUri, targetColumn);
        return;
    }

    for (const name of matches) {
        const graphmlUri = vscode.Uri.joinPath(folderUri, name);
        PlotPanel.create(extensionContext.extensionUri, graphmlUri, targetColumn);
    }
}

function createVisualizationHandler(ctx: CommandContext, visualizationType: VisualizationType) {
    return async function vizCommandHandler() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        const docUri = editor.document.uri;
        const fname = path.basename(docUri.fsPath);
        const sourceColumn = editor.viewColumn;

        const config = vscode.workspace.getConfiguration('bngl', docUri);
        const fold_name = getTimestampedFolderName();
        const new_fold_uri = await prepareResultsRunFolder(ctx, config, docUri, fold_name);
        const copy_path = vscode.Uri.joinPath(new_fold_uri, fname);

        if (visualizationType === 'regulatory' || visualizationType === 'ruleviz') {
            const sourceBytes = await vscode.workspace.fs.readFile(editor.document.uri);
            const sourceText = Buffer.from(sourceBytes).toString('utf8');
            const standaloneVisualizationInputText = visualizationType === 'regulatory'
                ? createStandaloneRegulatoryInputText(sourceText)
                : createStandaloneRulevizInputText(sourceText);
            await vscode.workspace.fs.writeFile(copy_path, Buffer.from(standaloneVisualizationInputText, 'utf8'));
        } else {
            await vscode.workspace.fs.copy(editor.document.uri, copy_path);
        }

        const pythonCommand = await getPythonCommand(ctx.channel);
        const vizCommand = visualizationType === 'regulatory' || visualizationType === 'ruleviz'
            ? createBionetgenCommand(pythonCommand, ctx.pybngVersion, [
                'run',
                '-i',
                copy_path.fsPath,
                '-o',
                new_fold_uri.fsPath,
                '-l',
                new_fold_uri.fsPath
            ])
            : createBionetgenCommand(pythonCommand, ctx.pybngVersion, [
                'visualize',
                '-i',
                copy_path.fsPath,
                '-o',
                new_fold_uri.fsPath,
                '-t',
                visualizationType
            ]);
        const term_cmd = formatCommandSpec(vizCommand);
        const commandLabel = getVisualizationCommandLabel(visualizationType);
        ctx.channel.appendLine(`Visualization results folder: ${new_fold_uri.fsPath}`);
        vscode.window.showInformationMessage(`Started generating ${commandLabel} for ${fname} in ${describeRunFolder(new_fold_uri)}`);

        if (config.get<boolean>('general.enable_terminal_runner')) {
            let term = vscode.window.terminals.find(i => i.name === 'bngl_term');
            if (!term) {
                term = vscode.window.createTerminal('bngl_term');
            }
            term.show();
            term.sendText(term_cmd);
            return;
        }

        ctx.channel.appendLine(term_cmd);
        const exitCode = await spawnAsync(vizCommand, ctx.channel, ctx.processManager, {
            tracking: {
                label: `${fname} (${commandLabel})`,
                description: getRunFolderLabel(new_fold_uri),
                tooltip: `${commandLabel}\n${fname}\n${new_fold_uri.fsPath}`,
                kind: 'visualization',
                modelPath: docUri.fsPath,
                resultsFolder: new_fold_uri.fsPath,
                startedAt: Date.now()
            }
        });
        if (exitCode !== 0) {
            vscode.window.showInformationMessage('Something went wrong, see BNGL output channel for details.');
            ctx.channel.show();
            return;
        }

        vscode.window.showInformationMessage(`Finished generating ${commandLabel}. Results are in ${describeRunFolder(new_fold_uri)}`);
        try {
            await openVisualizationOutputs(new_fold_uri, visualizationType, ctx.extensionContext, ctx.channel, sourceColumn);
        } catch (err) {
            ctx.channel.appendLine(`Could not open visualization files: ${err}`);
        }
    };
}

export function createRunHandler(ctx: CommandContext) {
    return async function runCommandHandler() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        const docUri = editor.document.uri;
        const fname = path.basename(docUri.fsPath);
        const sourceColumn = editor.viewColumn;

        const shouldStartRun = await confirmSimulationRerun(ctx, docUri);
        if (!shouldStartRun) {
            return;
        }

        const config = vscode.workspace.getConfiguration('bngl', docUri);
        const fname_noext = path.basename(docUri.fsPath, path.extname(docUri.fsPath));
        const fold_name = getTimestampedFolderName();
        const new_fold_uri = await prepareResultsRunFolder(ctx, config, docUri, fold_name);
        const copy_path = vscode.Uri.joinPath(new_fold_uri, fname);

        await vscode.workspace.fs.copy(editor.document.uri, copy_path);
        const copiedSourceText = Buffer.from(await vscode.workspace.fs.readFile(copy_path)).toString('utf8');

        const pythonCommand = await getPythonCommand(ctx.channel);
        const runCommand = createBionetgenCommand(pythonCommand, ctx.pybngVersion, ['run', '-i', copy_path.fsPath, '-o', new_fold_uri.fsPath, '-l', new_fold_uri.fsPath]);
        const term_cmd = formatCommandSpec(runCommand);
        ctx.channel.appendLine(`Simulation results folder: ${new_fold_uri.fsPath}`);
        ctx.channel.appendLine(`Watching ${new_fold_uri.fsPath} for BioNetGen log files.`);

        if (config.get<boolean>('general.enable_terminal_runner')) {
            ctx.channel.appendLine('Live BioNetGen log streaming is available only when bngl.general.enable_terminal_runner is disabled.');
            let term = vscode.window.terminals.find(i => i.name === 'bngl_term');
            if (!term) {
                term = vscode.window.createTerminal('bngl_term');
            }
            term.show();
            term.sendText(term_cmd);
            vscode.window.showInformationMessage(`Started running ${fname} in ${describeRunFolder(new_fold_uri)}`);

            if (config.get<boolean>('general.auto_open')) {
                checkPlotOutputs(new_fold_uri.fsPath, fname_noext, copiedSourceText, 120000).then(() => {
                    openPlotOutputs(new_fold_uri, fname_noext, copiedSourceText, ctx.extensionContext, sourceColumn);
                }).catch((err) => {
                    ctx.channel.appendLine(`Error auto-opening plot outputs: ${err}`);
                });
            }
        } else {
            ctx.channel.appendLine(term_cmd);
            const logStream = startLogStreaming(new_fold_uri.fsPath, ctx.channel);
            let spawnedPid: number | undefined;
            let cancellationRequested = false;
            const process = spawnAsync(runCommand, ctx.channel, ctx.processManager, {
                tracking: {
                    label: fname,
                    description: getRunFolderLabel(new_fold_uri),
                    tooltip: `Simulation\n${fname}\n${new_fold_uri.fsPath}`,
                    kind: 'simulation',
                    modelPath: docUri.fsPath,
                    resultsFolder: new_fold_uri.fsPath,
                    startedAt: Date.now()
                },
                onSpawn: (_process, pid) => {
                    // onSpawn fires synchronously during cp.spawn, before the withProgress
                    // cancellation token is registered, so cancellation is handled there, not here.
                    spawnedPid = pid;
                }
            });

            let exitCode: number;
            try {
                exitCode = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: `Running ${fname}`,
                        cancellable: true
                    },
                    async (progress, token) => {
                        progress.report({
                            message: `Results: ${describeRunFolder(new_fold_uri)}`
                        });
                        token.onCancellationRequested(() => {
                            cancellationRequested = true;
                            ctx.channel.appendLine(`Cancellation requested for ${fname}.`);
                            if (spawnedPid) {
                                void ctx.processManager.killProcessByPid(spawnedPid);
                            }
                        });

                        return process;
                    }
                );
            } catch (err) {
                await logStream.stop();
                ctx.channel.appendLine(`Process execution error: ${err}`);
                return;
            }

            await logStream.stop();

            if (cancellationRequested) {
                vscode.window.showInformationMessage(`Canceled ${fname}. Partial results remain in ${describeRunFolder(new_fold_uri)}.`);
                return;
            }

            if (exitCode !== 0) {
                vscode.window.showInformationMessage('Something went wrong, see BNGL output channel for details.');
                ctx.channel.show();
                return;
            }

            vscode.window.showInformationMessage(`Finished running ${fname}. Results are in ${describeRunFolder(new_fold_uri)}`);
            if (config.get<boolean>('general.auto_open')) {
                openPlotOutputs(new_fold_uri, fname_noext, copiedSourceText, ctx.extensionContext, sourceColumn).catch(err => {
                    ctx.channel.appendLine(`Error auto-opening plot outputs: ${err}`);
                });
            }
        }
    };
}

export function createVizHandler(ctx: CommandContext) {
    return createVisualizationHandler(ctx, 'all');
}

export function createContactMapHandler(ctx: CommandContext) {
    return createVisualizationHandler(ctx, 'contactmap');
}

export function createRegulatoryGraphHandler(ctx: CommandContext) {
    return createVisualizationHandler(ctx, 'regulatory');
}

export function createRulevizHandler(ctx: CommandContext) {
    return createVisualizationHandler(ctx, 'ruleviz');
}

export function createResultsFolderHandler(ctx: CommandContext) {
    return async function resultsFolderCommandHandler() {
        const docUri = getBnglTargetUri();
        if (!docUri) {
            vscode.window.showInformationMessage('Open a BNGL model to manage its results folder.');
            return;
        }

        const config = vscode.workspace.getConfiguration('bngl', docUri);
        const modelFileName = path.basename(docUri.fsPath);
        const modelFolderUri = getModelFolderUri(docUri);
        const workspaceFolderUri = vscode.workspace.getWorkspaceFolder(docUri)?.uri;
        const currentRootUri = getResultsRootUri(config, docUri);
        const currentRetentionPolicy = getResultsRetentionPolicy(config);
        const defaultRootUri = vscode.Uri.joinPath(modelFolderUri, getResultsRootFolderName(docUri.fsPath));

        const items: Array<ResultsFolderMenuItem | vscode.QuickPickItem> = [
            {
                label: 'Results Location',
                kind: vscode.QuickPickItemKind.Separator
            },
            {
                label: 'Use model\'s folder (Default)',
                description: 'Write results beside the current model.',
                detail: `Results root: ${defaultRootUri.fsPath}`,
                action: 'default'
            }
        ];

        if (workspaceFolderUri) {
            const workspaceRootUri = vscode.Uri.joinPath(workspaceFolderUri, getResultsRootFolderName(docUri.fsPath));
            items.push({
                label: 'Use workspace\'s folder',
                description: 'Write results under the workspace folder.',
                detail: `Results root: ${workspaceRootUri.fsPath}`,
                action: 'workspace'
            });
        }

        items.push({
            label: 'Choose custom folder...',
            description: 'Select a different base folder for generated results.',
            detail: `Generated results will be written under <selected>/${getResultsRootFolderName(docUri.fsPath)}/<timestamp>/`,
            action: 'choose'
        });

        items.push({
            label: 'Cleanup Policy',
            kind: vscode.QuickPickItemKind.Separator
        });

        items.push(
            {
                label: 'Keep all runs',
                description: currentRetentionPolicy === 'keep_all' ? 'Current setting' : 'Never delete older timestamped run folders automatically.',
                detail: 'Recommended for archival workflows.',
                action: 'retention_keep_all'
            },
            {
                label: 'Delete timestamped run folders older than 1 week',
                description: currentRetentionPolicy === 'delete_older_than_1w' ? 'Current setting' : 'A balanced cleanup window.',
                detail: 'Cleanup is folder-based and skips active BioNetGen jobs.',
                action: 'retention_1w'
            },
            {
                label: 'Delete timestamped run folders older than 1 day',
                description: currentRetentionPolicy === 'delete_older_than_1d' ? 'Current setting' : 'Recommended for scratch results.',
                detail: 'Cleanup is folder-based and skips active BioNetGen jobs.',
                action: 'retention_1d'
            },
            {
                label: 'Delete timestamped run folders older than 1 hour',
                description: currentRetentionPolicy === 'delete_older_than_1h' ? 'Current setting' : 'More aggressive scratch cleanup.',
                detail: 'Cleanup is folder-based and skips active BioNetGen jobs.',
                action: 'retention_1h'
            },
            {
                label: 'Purge all pre-existing timestamped run folders',
                description: currentRetentionPolicy === 'purge_existing' ? 'Current setting' : 'Ultra aggressive cleanup.',
                detail: 'Deletes all older timestamped run folders before future runs, while still skipping active BioNetGen jobs.',
                action: 'retention_purge'
            }
        );

        const pick = await vscode.window.showQuickPick(items, {
            title: `Current target: ${currentRootUri.fsPath}`,
            placeHolder: `Results Folder for ${modelFileName} • Cleanup: ${getResultsRetentionPolicyLabel(currentRetentionPolicy)}`
        });

        if (!pick || !('action' in pick)) {
            return;
        }

        if (pick.action === 'default') {
            await updateResultsFolderSetting(docUri, null);
            const resultsRootUri = getResultsRootUri(vscode.workspace.getConfiguration('bngl', docUri), docUri);
            vscode.window.showInformationMessage(`Generated results for ${modelFileName} will now be written to ${resultsRootUri.fsPath}.`);
            return;
        }

        if (pick.action === 'workspace') {
            if (!workspaceFolderUri) {
                return;
            }

            await updateResultsFolderSetting(docUri, workspaceFolderUri.fsPath);
            const workspaceRootUri = getResultsRootUri(vscode.workspace.getConfiguration('bngl', docUri), docUri);
            vscode.window.showInformationMessage(`Generated results for ${modelFileName} will now be written to ${workspaceRootUri.fsPath}.`);
            return;
        }

        if (pick.action === 'choose') {
            const selectedFolderUri = await chooseCustomResultsFolder(docUri);
            if (!selectedFolderUri) {
                return;
            }

            if (isSamePath(selectedFolderUri.fsPath, modelFolderUri.fsPath)) {
                await updateResultsFolderSetting(docUri, null);
                const defaultRootUri = getResultsRootUri(vscode.workspace.getConfiguration('bngl', docUri), docUri);
                vscode.window.showInformationMessage(`Generated results for ${modelFileName} will now be written to ${defaultRootUri.fsPath}.`);
                return;
            }

            await updateResultsFolderSetting(docUri, selectedFolderUri.fsPath);
            const customRootUri = getResultsRootUri(vscode.workspace.getConfiguration('bngl', docUri), docUri);
            vscode.window.showInformationMessage(`Generated results for ${modelFileName} will now be written to ${customRootUri.fsPath}.`);
            return;
        }

        const selectedRetentionPolicy = getResultsRetentionPolicyForAction(pick.action);
        if (selectedRetentionPolicy) {
            const updatedConfig = await updateResultsRetentionSetting(docUri, selectedRetentionPolicy);
            const updatedRootUri = getResultsRootUri(updatedConfig, docUri);
            vscode.window.showInformationMessage(
                `Results cleanup for ${modelFileName} is now set to ${getResultsRetentionPolicyLabel(selectedRetentionPolicy)}. ${getResultsRetentionPolicyDescription(selectedRetentionPolicy)} Current root: ${updatedRootUri.fsPath}.`
            );
            return;
        }
    };
}

export function createSetupHandler(ctx: CommandContext) {
    return async function setupCommandHandler() {
        ctx.channel.appendLine('Checking for perl.');
        const perlCheckExitCode = await spawnAsync(createCommandSpec('perl', ['-v']), ctx.channel, ctx.processManager);

        if (perlCheckExitCode !== 0) {
            ctx.channel.appendLine('Could not find perl.');
            vscode.window.showInformationMessage('You must install Perl (https://www.perl.org/get.html). We recommend Strawberry Perl for Windows.');
            ctx.channel.show();
        } else {
            ctx.channel.appendLine('Found perl.');
        }

        ctx.channel.appendLine('Getting python path.');
        const pythonCommand = await getPythonCommand(ctx.channel);
        ctx.channel.appendLine('Found python command: ' + formatCommandSpec(pythonCommand));

        ctx.channel.appendLine('Checking for bionetgen.');
        const bngCheckExitCode = await spawnAsync(createPipCommand(pythonCommand, ['show', PYBIONETGEN_PACKAGE]), ctx.channel, ctx.processManager);

        if (bngCheckExitCode !== 0) {
            ctx.channel.appendLine('Installing PyBNG for python command: ' + formatCommandSpec(pythonCommand));
            vscode.window.showInformationMessage(`Setting up BNG for Python: ${pythonCommand.command}`);
            const installExitCode = await spawnAsync(createPyBioNetGenInstallCommand(pythonCommand), ctx.channel, ctx.processManager);
            if (installExitCode !== 0) {
                ctx.channel.appendLine('pip install failed for python command: ' + formatCommandSpec(pythonCommand));
                vscode.window.showInformationMessage('BNG setup failed, see BNGL output channel for details.');
                ctx.channel.show();
            } else {
                const compatible = await ensurePyBioNetGenCompatibility(ctx, pythonCommand);
                if (!compatible) {
                    vscode.window.showInformationMessage('BNG setup failed, see BNGL output channel for details.');
                    ctx.channel.show();
                    return;
                }
                ctx.channel.appendLine('pip install succeeded for python command: ' + formatCommandSpec(pythonCommand));
                vscode.window.showInformationMessage('BNG setup complete.');
            }
        } else {
            ctx.channel.appendLine('Found bionetgen.');
            const compatible = await ensurePyBioNetGenCompatibility(ctx, pythonCommand);
            if (!compatible) {
                vscode.window.showInformationMessage('BNG setup failed, see BNGL output channel for details.');
                ctx.channel.show();
            }
        }
    };
}

export function createUpgradeHandler(ctx: CommandContext) {
    return async function upgradeCommandHandler() {
        ctx.channel.appendLine('Running BNG upgrade ...');
        const pythonCommand = await getPythonCommand(ctx.channel);
        ctx.channel.appendLine('Found python command: ' + formatCommandSpec(pythonCommand));
        vscode.window.showInformationMessage(`Upgrading BNG for Python: ${pythonCommand.command}`);
        const upgradeExitCode = await spawnAsync(createPyBioNetGenInstallCommand(pythonCommand), ctx.channel, ctx.processManager);
        if (upgradeExitCode !== 0) {
            ctx.channel.appendLine('pip upgrade failed for python command: ' + formatCommandSpec(pythonCommand));
            vscode.window.showInformationMessage('BNG upgrade failed, see BNGL output channel for details.');
            ctx.channel.show();
        } else {
            const compatible = await ensurePyBioNetGenCompatibility(ctx, pythonCommand);
            if (!compatible) {
                vscode.window.showInformationMessage('BNG upgrade failed, see BNGL output channel for details.');
                ctx.channel.show();
                return;
            }
            ctx.channel.appendLine('pip upgrade successful for python command: ' + formatCommandSpec(pythonCommand));
            vscode.window.showInformationMessage('BNG upgrade complete.');
        }
    };
}
