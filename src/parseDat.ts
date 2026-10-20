/**
 * Parses BioNetGen .gdat/.cdat/.scan data files into column names and
 * transposed data arrays for plotting.
 *
 * File format: space-separated columns, first row is headers (prefixed
 * with #), remaining rows are numeric data.
 */
export function parseDat(text: string): [string[], string[][]] {
    const lines = text.split(/[\n\r]+/).filter(e => e.trim().length > 0);
    const spltLines = lines.map(w => w.trim().split(/\s+/));
    if (spltLines.length < 2) {
        return [[], []];
    }
    const names = spltLines[0].slice(1);
    const data = spltLines.slice(1);
    if (data.length === 0) {
        return [names, []];
    }
    // Build one column per header name so series names and data stay aligned even when a
    // row is ragged: short rows get '' for missing cells, extra unnamed columns are dropped.
    const transposed = names.map((_, colIndex) => data.map(row => row[colIndex] ?? ''));
    return [names, transposed];
}
