import * as vscode from 'vscode';

function normalizeName(name: string): string {
    let n = name.trim().toLowerCase();
    n = n.split('#')[0].trim();
    if (n === 'reaction rules' || n === 'rules') return 'rules';
    if (n === 'molecule types' || n === 'molecules') return 'molecules';
    if (n === 'seed species' || n === 'species') return 'species';
    return n;
}

export const bnglFoldingProvider: vscode.FoldingRangeProvider = {
    provideFoldingRanges(document) {
        const ranges: vscode.FoldingRange[] = [];
        const beginStack: { line: number; name: string }[] = [];

        for (let i = 0; i < document.lineCount; i++) {
            const trimmed = document.lineAt(i).text.trimStart();

            const beginMatch = trimmed.match(/^begin\s+(.+)/i);
            if (beginMatch) {
                beginStack.push({ line: i, name: normalizeName(beginMatch[1]) });
                continue;
            }

            const endMatch = trimmed.match(/^end\s+(.+)/i);
            if (endMatch && beginStack.length > 0) {
                const endName = normalizeName(endMatch[1]);
                for (let j = beginStack.length - 1; j >= 0; j--) {
                    if (beginStack[j].name === endName) {
                        ranges.push(new vscode.FoldingRange(beginStack[j].line, i, vscode.FoldingRangeKind.Region));
                        beginStack.splice(j, 1);
                        break;
                    }
                }
                continue;
            }

            const metaMatch = trimmed.match(/^#@\w+/);
            if (metaMatch) {
                let endLine = i;
                for (let j = i + 1; j < document.lineCount; j++) {
                    const nextTrimmed = document.lineAt(j).text.trimStart();
                    if (nextTrimmed.match(/^#@\w+/) || nextTrimmed === '' || !nextTrimmed.startsWith('#')) {
                        break;
                    }
                    endLine = j;
                }
                if (endLine > i) {
                    ranges.push(new vscode.FoldingRange(i, endLine, vscode.FoldingRangeKind.Comment));
                }
            }
        }
        return ranges;
    }
};
