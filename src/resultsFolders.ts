import * as path from 'path';
import * as vscode from 'vscode';

const GENERATED_RESULTS_RUN_PATTERN = /^(\d{4})_(\d{2})_(\d{2})__(\d{2})_(\d{2})_(\d{2})$/;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

export type GraphmlVisualizationKind = 'contactmap' | 'regulatory' | 'ruleviz_pattern' | 'ruleviz_operation' | 'ruleviz' | 'other';
export type StandaloneGraphPaletteKind = Extract<GraphmlVisualizationKind, 'contactmap' | 'regulatory' | 'ruleviz_operation'>;
export type ResultsRetentionPolicy = 'keep_all' | 'delete_older_than_1h' | 'delete_older_than_1d' | 'delete_older_than_1w' | 'purge_existing';

function isGraphmlFileName(name: string): boolean {
    return path.extname(name).toLowerCase() === '.graphml';
}

export function getModelBaseName(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
}

export function getResultsRootFolderName(filePath: string): string {
    return `results_${getModelBaseName(filePath)}`;
}

export function getConfiguredResultsBaseFolderPath(config: vscode.WorkspaceConfiguration): string | undefined {
    const configuredPath = config.get<string | null>('general.result_folder');
    return configuredPath && configuredPath.trim().length > 0 ? configuredPath.trim() : undefined;
}

export function getResultsRetentionPolicy(config: vscode.WorkspaceConfiguration): ResultsRetentionPolicy {
    const configuredPolicy = config.get<string>('general.results_retention');
    if (
        configuredPolicy === 'delete_older_than_1h'
        || configuredPolicy === 'delete_older_than_1d'
        || configuredPolicy === 'delete_older_than_1w'
        || configuredPolicy === 'purge_existing'
    ) {
        return configuredPolicy;
    }

    return 'keep_all';
}

export function getResultsRetentionPolicyLabel(policy: ResultsRetentionPolicy): string {
    if (policy === 'purge_existing') {
        return 'Purge all pre-existing timestamped run folders';
    }

    if (policy === 'delete_older_than_1h') {
        return 'Delete timestamped run folders older than 1 hour';
    }

    if (policy === 'delete_older_than_1d') {
        return 'Delete timestamped run folders older than 1 day';
    }

    if (policy === 'delete_older_than_1w') {
        return 'Delete timestamped run folders older than 1 week';
    }

    return 'Keep all runs';
}

export function getResultsRetentionThresholdMs(policy: ResultsRetentionPolicy): number | null {
    if (policy === 'purge_existing') {
        return 0;
    }

    if (policy === 'delete_older_than_1h') {
        return ONE_HOUR_MS;
    }

    if (policy === 'delete_older_than_1d') {
        return ONE_DAY_MS;
    }

    if (policy === 'delete_older_than_1w') {
        return ONE_WEEK_MS;
    }

    return null;
}

export function getModelFolderUri(fileUri: vscode.Uri): vscode.Uri {
    return vscode.Uri.file(path.dirname(fileUri.fsPath));
}

export function resolveResultsBaseFolderPath(configuredPath: string, fileUri: vscode.Uri): string {
    if (path.isAbsolute(configuredPath)) {
        return path.normalize(configuredPath);
    }

    const workspaceFolderPath = vscode.workspace.getWorkspaceFolder(fileUri)?.uri.fsPath;
    const anchorPath = workspaceFolderPath ?? path.dirname(fileUri.fsPath);
    return path.resolve(anchorPath, configuredPath);
}

export function getResultsBaseFolderUri(config: vscode.WorkspaceConfiguration, fileUri: vscode.Uri): vscode.Uri {
    const configuredPath = getConfiguredResultsBaseFolderPath(config);
    return configuredPath
        ? vscode.Uri.file(resolveResultsBaseFolderPath(configuredPath, fileUri))
        : getModelFolderUri(fileUri);
}

export function getResultsRootUri(config: vscode.WorkspaceConfiguration, fileUri: vscode.Uri): vscode.Uri {
    return vscode.Uri.joinPath(getResultsBaseFolderUri(config, fileUri), getResultsRootFolderName(fileUri.fsPath));
}

export function getResultsRunFolderUri(config: vscode.WorkspaceConfiguration, fileUri: vscode.Uri, timestamp: string): vscode.Uri {
    return vscode.Uri.joinPath(getResultsRootUri(config, fileUri), timestamp);
}

export function getResultsFolderConfigurationTarget(fileUri: vscode.Uri): vscode.ConfigurationTarget {
    if (vscode.workspace.getWorkspaceFolder(fileUri)) {
        return vscode.ConfigurationTarget.WorkspaceFolder;
    }

    if (vscode.workspace.workspaceFile || (vscode.workspace.workspaceFolders?.length ?? 0) > 0) {
        return vscode.ConfigurationTarget.Workspace;
    }

    return vscode.ConfigurationTarget.Global;
}

export function isGeneratedResultsRunFolderName(name: string): boolean {
    return GENERATED_RESULTS_RUN_PATTERN.test(name);
}

export function parseGeneratedResultsRunFolderTimestamp(name: string): number | undefined {
    const match = name.match(GENERATED_RESULTS_RUN_PATTERN);
    if (!match) {
        return undefined;
    }

    const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
    const year = Number.parseInt(yearText, 10);
    const month = Number.parseInt(monthText, 10);
    const day = Number.parseInt(dayText, 10);
    const hour = Number.parseInt(hourText, 10);
    const minute = Number.parseInt(minuteText, 10);
    const second = Number.parseInt(secondText, 10);
    const parsedDate = new Date(year, month - 1, day, hour, minute, second, 0);

    if (Number.isNaN(parsedDate.getTime())) {
        return undefined;
    }

    return parsedDate.getTime();
}

export function shouldDeleteGeneratedResultsRunFolder(
    name: string,
    policy: ResultsRetentionPolicy,
    now = Date.now()
): boolean {
    const thresholdMs = getResultsRetentionThresholdMs(policy);
    if (thresholdMs === null) {
        return false;
    }

    const timestampMs = parseGeneratedResultsRunFolderTimestamp(name);
    if (typeof timestampMs !== 'number') {
        return false;
    }

    if (thresholdMs === 0) {
        return true;
    }

    return now - timestampMs > thresholdMs;
}

export function getGraphmlVisualizationKind(filePath: string): GraphmlVisualizationKind {
    if (!isGraphmlFileName(filePath)) {
        return 'other';
    }

    const baseName = path.basename(filePath, path.extname(filePath)).toLowerCase();

    if (baseName.includes('contactmap')) {
        return 'contactmap';
    }

    if (baseName.includes('regulatory')) {
        return 'regulatory';
    }

    if (baseName.includes('ruleviz_operation')) {
        return 'ruleviz_operation';
    }

    if (baseName.includes('ruleviz_pattern')) {
        return 'ruleviz_pattern';
    }

    if (baseName.includes('ruleviz')) {
        return 'ruleviz';
    }

    return 'other';
}

export function isContactMapGraphmlFileName(name: string): boolean {
    return getGraphmlVisualizationKind(name) === 'contactmap';
}

export function isRegulatoryGraphmlFileName(name: string): boolean {
    return getGraphmlVisualizationKind(name) === 'regulatory';
}

export function getStandaloneGraphPaletteKind(filePath: string, siblingNames: readonly string[]): StandaloneGraphPaletteKind | null {
    const currentFileName = path.basename(filePath);
    const currentKind = getGraphmlVisualizationKind(currentFileName);

    if (currentKind !== 'contactmap' && currentKind !== 'regulatory' && currentKind !== 'ruleviz_operation') {
        return null;
    }

    const hasConflictingGraphmlSibling = siblingNames.some((name) => {
        if (name === currentFileName) {
            return false;
        }

        const siblingKind = getGraphmlVisualizationKind(name);
        return siblingKind !== 'other' && siblingKind !== currentKind;
    });

    return hasConflictingGraphmlSibling ? null : currentKind;
}

export function shouldUseStandaloneContactMapPalette(filePath: string, siblingNames: readonly string[]): boolean {
    return getStandaloneGraphPaletteKind(filePath, siblingNames) === 'contactmap';
}

export function shouldUseStandaloneRegulatoryPalette(filePath: string, siblingNames: readonly string[]): boolean {
    return getStandaloneGraphPaletteKind(filePath, siblingNames) === 'regulatory';
}

export function shouldUseStandaloneRulevizLayout(filePath: string, siblingNames: readonly string[]): boolean {
    const currentFileName = path.basename(filePath);
    const currentKind = getGraphmlVisualizationKind(currentFileName);

    if (currentKind !== 'ruleviz_operation' && currentKind !== 'ruleviz_pattern') {
        return false;
    }

    return !siblingNames.some((name) => {
        if (name === currentFileName) {
            return false;
        }

        const siblingKind = getGraphmlVisualizationKind(name);
        return siblingKind !== 'other'
            && siblingKind !== 'ruleviz_operation'
            && siblingKind !== 'ruleviz_pattern';
    });
}

export function shouldUseStandaloneRulevizOperationLayout(filePath: string, siblingNames: readonly string[]): boolean {
    return shouldUseStandaloneRulevizLayout(filePath, siblingNames);
}
