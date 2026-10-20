import * as assert from 'assert';
import { parseDat } from '../../parseDat';

suite('parseDat', () => {

    test('parses normal multi-column data', () => {
        // Header: "# time A B C" splits to ['#','time','A','B','C'], slice(1) => ['time','A','B','C']
        const text = [
            '# time A B C',
            '0 1 2 3',
            '1 4 5 6',
            '2 7 8 9',
        ].join('\n');

        const [names, data] = parseDat(text);
        assert.deepStrictEqual(names, ['time', 'A', 'B', 'C']);
        assert.strictEqual(data.length, 4); // 4 columns (time + 3 observables)
        assert.deepStrictEqual(data[0], ['0', '1', '2']); // time column
        assert.deepStrictEqual(data[1], ['1', '4', '7']); // A
        assert.deepStrictEqual(data[2], ['2', '5', '8']); // B
        assert.deepStrictEqual(data[3], ['3', '6', '9']); // C
    });

    test('returns empty arrays for empty input', () => {
        const [names, data] = parseDat('');
        assert.deepStrictEqual(names, []);
        assert.deepStrictEqual(data, []);
    });

    test('returns empty arrays for whitespace-only input', () => {
        const [names, data] = parseDat('   \n  \n  ');
        assert.deepStrictEqual(names, []);
        assert.deepStrictEqual(data, []);
    });

    test('returns empty arrays for header-only file (single line)', () => {
        const [names, data] = parseDat('# time A B C');
        assert.deepStrictEqual(names, []);
        assert.deepStrictEqual(data, []);
    });

    test('handles single data row', () => {
        const text = '# time X Y\n0 10 20';
        const [names, data] = parseDat(text);
        assert.deepStrictEqual(names, ['time', 'X', 'Y']);
        assert.strictEqual(data.length, 3);
        assert.deepStrictEqual(data[0], ['0']);
        assert.deepStrictEqual(data[1], ['10']);
        assert.deepStrictEqual(data[2], ['20']);
    });

    test('handles Windows-style line endings (\\r\\n)', () => {
        const text = '# time A\r\n0 1\r\n1 2\r\n';
        const [names, data] = parseDat(text);
        assert.deepStrictEqual(names, ['time', 'A']);
        assert.deepStrictEqual(data[0], ['0', '1']);
        assert.deepStrictEqual(data[1], ['1', '2']);
    });

    test('handles extra whitespace around values', () => {
        const text = '  # time  A  B  \n  0  1  2  \n  1  3  4  ';
        const [names, data] = parseDat(text);
        assert.deepStrictEqual(names, ['time', 'A', 'B']);
        assert.strictEqual(data.length, 3);
    });

    test('handles blank lines interspersed in data', () => {
        const text = '# time A\n\n0 1\n\n1 2\n';
        const [names, data] = parseDat(text);
        assert.deepStrictEqual(names, ['time', 'A']);
        assert.deepStrictEqual(data[1], ['1', '2']);
    });

    test('pads ragged short rows with empty strings instead of undefined', () => {
        const text = [
            '# time A B',
            '0 1 2',
            '1 3',       // missing B value
        ].join('\n');

        const [names, data] = parseDat(text);
        assert.deepStrictEqual(names, ['time', 'A', 'B']);
        assert.strictEqual(data.length, 3); // one column per header name
        assert.deepStrictEqual(data[0], ['0', '1']); // time
        assert.deepStrictEqual(data[1], ['1', '3']); // A
        assert.deepStrictEqual(data[2], ['2', '']);  // B: missing cell becomes ''
    });

    test('drops trailing columns that have no header name', () => {
        const text = [
            '# time A',
            '0 1 99', // extra unnamed column
            '1 2 98',
        ].join('\n');

        const [names, data] = parseDat(text);
        assert.deepStrictEqual(names, ['time', 'A']);
        assert.strictEqual(data.length, 2); // aligned to the header, extra column dropped
        assert.deepStrictEqual(data[0], ['0', '1']);
        assert.deepStrictEqual(data[1], ['1', '2']);
    });

    test('parses a real .gdat snippet', () => {
        const text = [
            '#          time    Atot        Btot',
            ' 0.000000e+00  1.000000e+02  0.000000e+00',
            ' 1.000000e+01  5.000000e+01  5.000000e+01',
        ].join('\n');

        const [names, data] = parseDat(text);
        assert.deepStrictEqual(names, ['time', 'Atot', 'Btot']);
        assert.strictEqual(data.length, 3);
        assert.strictEqual(data[0][0], '0.000000e+00');
    });
});
