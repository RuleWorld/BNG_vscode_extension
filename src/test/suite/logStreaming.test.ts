import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { startLogStreaming } from '../../utils/logStreaming';

interface FakeSink {
    text: string;
    append(value: string): void;
    appendLine(value: string): void;
    show(preserveFocus?: boolean): void;
    showCalls: number;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check: () => boolean, timeoutMs = 2_000): Promise<void> {
    const start = Date.now();
    while (!check()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error('Timed out waiting for expected condition.');
        }

        await delay(25);
    }
}

suite('Log Streaming', () => {
    test('streams newly created BioNetGen log files into the sink', async function () {
        this.timeout(5_000);

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bngl-log-stream-'));
        const logPath = path.join(tempDir, 'example.log');
        const sink: FakeSink = {
            text: '',
            append(value: string) {
                this.text += value;
            },
            appendLine(value: string) {
                this.text += `${value}\n`;
            },
            show() {
                this.showCalls += 1;
            },
            showCalls: 0
        };

        const stream = startLogStreaming(tempDir, sink, { pollIntervalMs: 25 });

        try {
            fs.writeFileSync(logPath, 'first line\n', 'utf8');
            await waitFor(() => sink.text.includes('Streaming BioNetGen log file'));
            await waitFor(() => sink.text.includes('first line'));

            fs.appendFileSync(logPath, 'second line\n', 'utf8');
            await waitFor(() => sink.text.includes('second line'));

            await stream.stop();
            fs.appendFileSync(logPath, 'third line\n', 'utf8');
            await delay(100);

            assert.strictEqual(sink.text.includes('third line'), false);
            assert.ok(sink.showCalls >= 1, 'expected the sink to be revealed when log data arrived');
        } finally {
            await stream.stop();
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
