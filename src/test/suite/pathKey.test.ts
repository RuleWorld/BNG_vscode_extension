import * as assert from 'assert';
import { isPathInsideOrEqual, isSamePath, normalizePathKey } from '../../utils/pathKey';

suite('Path keys', () => {
    test('Windows keys ignore drive-letter and path case, and normalize separators', () => {
        assert.strictEqual(normalizePathKey('C:\\Users\\Runner\\Model.bngl', 'win32'), 'c:\\users\\runner\\model.bngl');
        assert.ok(isSamePath('c:\\Users\\RUNNER~1\\Temp\\x.gdat', 'C:/Users/runner~1/Temp/X.gdat', 'win32'));
        assert.ok(isSamePath('C:\\a\\b\\..\\c', 'c:\\a\\c', 'win32'));
    });

    test('POSIX keys stay case-sensitive', () => {
        assert.ok(isSamePath('/tmp/a/../b.bngl', '/tmp/b.bngl', 'linux'));
        assert.ok(!isSamePath('/tmp/Model.bngl', '/tmp/model.bngl', 'linux'));
    });

    test('isPathInsideOrEqual matches the folder and its descendants only', () => {
        assert.ok(isPathInsideOrEqual('c:\\out\\results_m\\run1', 'C:\\OUT\\results_m', 'win32'));
        assert.ok(isPathInsideOrEqual('C:\\out\\results_m', 'c:\\out\\results_m\\', 'win32'));
        assert.ok(!isPathInsideOrEqual('C:\\out\\results_m2', 'C:\\out\\results_m', 'win32'));
        assert.ok(isPathInsideOrEqual('/out/results_m/run1', '/out/results_m', 'linux'));
        assert.ok(!isPathInsideOrEqual('/out/results_m2/run1', '/out/results_m', 'linux'));
    });
});
