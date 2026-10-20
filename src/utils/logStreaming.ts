import * as fs from 'fs';
import * as path from 'path';

export interface LogOutputSink {
    append(value: string): void;
    appendLine(value: string): void;
    show?(preserveFocus?: boolean): void;
}

export interface LogStreamController {
    stop(): Promise<void>;
}

interface StreamedLogState {
    offset: number;
    announced: boolean;
}

function readLogChunk(handle: fs.promises.FileHandle, length: number, position: number): Promise<Buffer> {
    const buffer = Buffer.alloc(length);

    return handle.read(buffer, 0, length, position).then(({ bytesRead }) => {
        return bytesRead === length ? buffer : buffer.subarray(0, bytesRead);
    });
}

function formatStreamingErrorMessage(filePath: string, error: unknown): string {
    const fileName = path.basename(filePath);
    const detail = error instanceof Error ? error.message : String(error);
    return `Unable to stream ${fileName}: ${detail}`;
}

export function startLogStreaming(
    folderPath: string,
    sink: LogOutputSink,
    options: { pollIntervalMs?: number } = {}
): LogStreamController {
    const pollIntervalMs = Math.max(50, options.pollIntervalMs ?? 500);
    const streamedLogs = new Map<string, StreamedLogState>();
    const maxChunkSize = 64 * 1024;
    let stopped = false;
    let revealed = false;
    let activeScan: Promise<void> | undefined;
    let queuedScan = false;

    const revealSink = () => {
        if (!revealed && typeof sink.show === 'function') {
            revealed = true;
            sink.show(true);
        }
    };

    const streamLogFile = async (filePath: string) => {
        const previousState = streamedLogs.get(filePath);
        const state: StreamedLogState = previousState ?? { offset: 0, announced: false };
        const handle = await fs.promises.open(filePath, 'r');

        try {
            const stats = await handle.stat();
            if (!stats.isFile()) {
                return;
            }

            if (stats.size < state.offset) {
                state.offset = 0;
            }

            if (!state.announced) {
                sink.appendLine(`Streaming BioNetGen log file: ${filePath}`);
                state.announced = true;
                revealSink();
            }

            while (state.offset < stats.size) {
                const bytesToRead = Math.min(maxChunkSize, stats.size - state.offset);
                const chunk = await readLogChunk(handle, bytesToRead, state.offset);
                if (chunk.length === 0) {
                    break;
                }

                sink.append(chunk.toString('utf8'));
                state.offset += chunk.length;
                revealSink();
            }

            streamedLogs.set(filePath, state);
        } finally {
            await handle.close();
        }
    };

    const scanOnce = async () => {
        let entries: fs.Dirent[];
        try {
            entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
        } catch {
            return;
        }

        const logFilePaths = entries
            .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.log'))
            .map((entry) => path.join(folderPath, entry.name))
            .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));

        for (const filePath of logFilePaths) {
            try {
                await streamLogFile(filePath);
            } catch (error) {
                sink.appendLine(formatStreamingErrorMessage(filePath, error));
            }
        }
    };

    const scheduleScan = () => {
        if (stopped) {
            return;
        }

        if (activeScan) {
            queuedScan = true;
            return;
        }

        activeScan = scanOnce().catch((error) => {
            sink.appendLine(formatStreamingErrorMessage(folderPath, error));
        }).finally(() => {
            activeScan = undefined;
            if (queuedScan && !stopped) {
                queuedScan = false;
                scheduleScan();
            }
        });
    };

    scheduleScan();
    const interval = setInterval(scheduleScan, pollIntervalMs);
    interval.unref?.();

    return {
        async stop() {
            if (stopped) {
                return;
            }

            stopped = true;
            clearInterval(interval);
            if (activeScan) {
                await activeScan;
            }

            await scanOnce();
        }
    };
}
