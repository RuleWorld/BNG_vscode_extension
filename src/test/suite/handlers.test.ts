import * as assert from 'assert';
import {
    createStandaloneRegulatoryInputText,
    createStandaloneRulevizInputText,
    getAutoOpenPlotOutputFileNames
} from '../../commands/handlers';

suite('Visualization Handlers', () => {
    test('replaces top-level actions with a standalone regulatory ruleNames action', () => {
        const source = [
            'begin model',
            'begin parameters',
            '  k 1',
            'end parameters',
            'end model',
            '',
            'simulate({method=>"ssa"})',
            'visualize({type=>"contactmap"})',
            ''
        ].join('\n');

        const result = createStandaloneRegulatoryInputText(source);

        assert.strictEqual(result.includes('simulate({method=>"ssa"})'), false);
        assert.strictEqual(result.includes('visualize({type=>"contactmap"})'), false);
        assert.match(result, /visualize\(\{type=>"regulatory",ruleNames=>1\}\)\n$/);
    });

    test('removes actions blocks before appending the standalone regulatory action', () => {
        const source = [
            'begin model',
            'begin parameters',
            '  k 1',
            'end parameters',
            'end model',
            '',
            'begin actions',
            '  simulate({method=>"ode"})',
            '  visualize({type=>"contactmap"})',
            'end actions',
            ''
        ].join('\n');

        const result = createStandaloneRegulatoryInputText(source);

        assert.strictEqual(result.includes('begin actions'), false);
        assert.strictEqual(result.includes('simulate({method=>"ode"})'), false);
        assert.strictEqual(result.includes('visualize({type=>"contactmap"})'), false);
        assert.match(result, /end model\n\nvisualize\(\{type=>"regulatory",ruleNames=>1\}\)\n$/);
    });

    test('appends both standalone RuleViz views for the unified RuleViz feature', () => {
        const source = [
            'begin model',
            'begin parameters',
            '  k 1',
            'end parameters',
            'end model',
            '',
            'simulate({method=>"ssa"})',
            'visualize({type=>"ruleviz_operation"})',
            ''
        ].join('\n');

        const result = createStandaloneRulevizInputText(source);

        assert.strictEqual(result.includes('simulate({method=>"ssa"})'), false);
        assert.strictEqual(result.includes('visualize({type=>"ruleviz_operation"})'), false);
        assert.match(
            result,
            /visualize\(\{type=>"ruleviz_pattern",each=>1\}\)\nvisualize\(\{type=>"ruleviz_operation",each=>1\}\)\n$/
        );
    });

    test('prefers gdat and scan outputs over cdat during auto-open', () => {
        const result = getAutoOpenPlotOutputFileNames(
            [
                'other.scan',
                'model_output.scan',
                'notes.txt',
                'model_output.cdat',
                'model_output.gdat',
                'other.gdat'
            ],
            'model_output'
        );

        assert.deepStrictEqual(result, [
            'model_output.gdat',
            'model_output.scan',
            'other.gdat',
            'other.scan'
        ]);
    });

    test('falls back to cdat when it is the only plottable output', () => {
        const result = getAutoOpenPlotOutputFileNames(
            [
                'model_output.cdat',
                'notes.txt'
            ],
            'model_output'
        );

        assert.deepStrictEqual(result, ['model_output.cdat']);
    });

    test('does not auto-open intermediate gdat files for parameter scans', () => {
        const source = [
            'begin model',
            'end model',
            '',
            'parameter_scan({method=>"ode",parameter=>"k",par_min=>0,par_max=>10,n_scan_pts=>5})',
            ''
        ].join('\n');

        const result = getAutoOpenPlotOutputFileNames(
            [
                'model_output.gdat',
                'model_output_001.gdat',
                'model_output_002.gdat',
                'model_output.scan'
            ],
            'model_output',
            source
        );

        assert.deepStrictEqual(result, ['model_output.scan']);
    });

    test('auto-opens suffixed simulate outputs that match explicit simulate actions', () => {
        const source = [
            'begin model',
            'end model',
            '',
            'simulate({method=>"ode",t_end=>10})',
            'simulate({method=>"ode",suffix=>"run2",t_end=>10})',
            ''
        ].join('\n');

        const result = getAutoOpenPlotOutputFileNames(
            [
                'model_output_run2.gdat',
                'model_output.gdat',
                'model_output_auxiliary.gdat'
            ],
            'model_output',
            source
        );

        assert.deepStrictEqual(result, [
            'model_output.gdat',
            'model_output_run2.gdat'
        ]);
    });
});
