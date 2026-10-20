import * as path from 'path';
import type * as vscode from 'vscode';

const GENERATED_ARTIFACT_EXTENSIONS = new Set([
    '.gdat',
    '.cdat',
    '.scan',
    '.graphml'
]);

export function isGeneratedArtifactPath(filePath: string): boolean {
    return GENERATED_ARTIFACT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function getFsPath(candidate: unknown): string | undefined {
    if (!candidate || typeof candidate !== 'object') {
        return undefined;
    }

    const fsPath = (candidate as { fsPath?: unknown }).fsPath;
    return typeof fsPath === 'string' ? fsPath : undefined;
}

export function shouldCloseGeneratedArtifactTabInput(input: unknown): boolean {
    if (!input || typeof input !== 'object') {
        return false;
    }

    const uriFsPath = getFsPath((input as { uri?: unknown }).uri);
    if (uriFsPath) {
        return isGeneratedArtifactPath(uriFsPath);
    }

    const originalFsPath = getFsPath((input as { original?: unknown }).original);
    const modifiedFsPath = getFsPath((input as { modified?: unknown }).modified);

    return (originalFsPath ? isGeneratedArtifactPath(originalFsPath) : false)
        || (modifiedFsPath ? isGeneratedArtifactPath(modifiedFsPath) : false);
}

export function getGeneratedArtifactTabs(tabGroups: readonly vscode.TabGroup[]): vscode.Tab[] {
    return tabGroups
        .flatMap((group) => group.tabs)
        .filter((tab) => shouldCloseGeneratedArtifactTabInput(tab.input));
}
