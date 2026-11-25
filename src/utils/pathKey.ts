import * as path from 'path';

// Windows paths are case-insensitive, and the same file can reach us in different spellings:
// vscode.Uri.fsPath lowercases the drive letter ("c:\\...") while Node's path/os APIs keep it
// ("C:\\..."). Compare and key paths through these helpers instead of raw strings.

export function normalizePathKey(filePath: string, platform: NodeJS.Platform = process.platform): string {
    if (platform === 'win32') {
        return path.win32.resolve(filePath).toLowerCase();
    }
    return path.posix.resolve(filePath);
}

export function isSamePath(left: string, right: string, platform: NodeJS.Platform = process.platform): boolean {
    return normalizePathKey(left, platform) === normalizePathKey(right, platform);
}

// true when child is folder itself or lies anywhere beneath it
export function isPathInsideOrEqual(child: string, folder: string, platform: NodeJS.Platform = process.platform): boolean {
    const childKey = normalizePathKey(child, platform);
    const folderKey = normalizePathKey(folder, platform);
    const sep = platform === 'win32' ? '\\' : '/';
    const folderPrefix = folderKey.endsWith(sep) ? folderKey : `${folderKey}${sep}`;
    return childKey === folderKey || childKey.startsWith(folderPrefix);
}
