import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { parseBnglDocument, parseMoleculeTypeSignature, normalizeBlockType } from '../../server/parser';

suite('BNGL Parser', () => {

    suite('normalizeBlockType', () => {
        test('normalizes aliases', () => {
            assert.strictEqual(normalizeBlockType('rules'), 'reaction rules');
            assert.strictEqual(normalizeBlockType('molecules'), 'molecule types');
            assert.strictEqual(normalizeBlockType('species'), 'seed species');
        });

        test('preserves canonical names', () => {
            assert.strictEqual(normalizeBlockType('parameters'), 'parameters');
            assert.strictEqual(normalizeBlockType('reaction rules'), 'reaction rules');
            assert.strictEqual(normalizeBlockType('observables'), 'observables');
        });

        test('strips comments and is case-insensitive', () => {
            assert.strictEqual(normalizeBlockType('Parameters # stuff'), 'parameters');
            assert.strictEqual(normalizeBlockType('REACTION RULES'), 'reaction rules');
        });
    });

    suite('parseMoleculeTypeSignature', () => {
        test('parses simple molecule with no components', () => {
            const result = parseMoleculeTypeSignature('Xm()');
            assert.strictEqual(result.name, 'Xm');
            assert.strictEqual(result.components.length, 0);
        });

        test('parses molecule with binding sites', () => {
            const result = parseMoleculeTypeSignature('A(b,c)');
            assert.strictEqual(result.name, 'A');
            assert.strictEqual(result.components.length, 2);
            assert.strictEqual(result.components[0].name, 'b');
            assert.strictEqual(result.components[1].name, 'c');
        });

        test('parses molecule with states', () => {
            const result = parseMoleculeTypeSignature('A(s~u~p)');
            assert.strictEqual(result.name, 'A');
            assert.strictEqual(result.components.length, 1);
            assert.strictEqual(result.components[0].name, 's');
            assert.deepStrictEqual(result.components[0].states, ['u', 'p']);
        });

        test('parses molecule with mixed components', () => {
            const result = parseMoleculeTypeSignature('Rec(l,d~Y~pY)');
            assert.strictEqual(result.name, 'Rec');
            assert.strictEqual(result.components.length, 2);
            assert.strictEqual(result.components[0].name, 'l');
            assert.deepStrictEqual(result.components[0].states, []);
            assert.strictEqual(result.components[1].name, 'd');
            assert.deepStrictEqual(result.components[1].states, ['Y', 'pY']);
        });

        test('handles bare name without parens', () => {
            const result = parseMoleculeTypeSignature('X');
            assert.strictEqual(result.name, 'X');
            assert.strictEqual(result.components.length, 0);
        });
    });

    suite('parseBnglDocument — blocks', () => {
        test('parses a simple model with begin/end blocks', () => {
            const text = [
                'begin model',
                'begin parameters',
                '  k1 1.0',
                'end parameters',
                'end model',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.blocks.length, 2);

            const paramBlock = doc.blocks.find(b => b.type === 'parameters');
            assert.ok(paramBlock);
            assert.strictEqual(paramBlock.startLine, 1);
            assert.strictEqual(paramBlock.endLine, 3);

            const modelBlock = doc.blocks.find(b => b.type === 'model');
            assert.ok(modelBlock);
            assert.strictEqual(modelBlock.startLine, 0);
            assert.strictEqual(modelBlock.endLine, 4);
        });

        test('reports unclosed blocks', () => {
            const text = [
                'begin parameters',
                '  k1 1.0',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.blocks.length, 1);
            assert.strictEqual(doc.blocks[0].endLine, -1);
            assert.ok(doc.diagnostics.some(d => d.severity === 'error' && d.message.includes('Unclosed')));
        });

        test('reports unmatched end', () => {
            const text = [
                'end parameters',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.ok(doc.diagnostics.some(d => d.severity === 'error' && d.message.includes('Unmatched')));
        });

        test('reports mismatched block names (begin parameters / end species)', () => {
            const text = [
                'begin parameters',
                '  k1  1.0',
                'end species',
            ].join('\n');

            const doc = parseBnglDocument(text);
            // "end species" doesn't match "begin parameters"
            assert.ok(doc.diagnostics.some(d => d.message.includes('Unmatched')));
            // The parameters block is left unclosed
            assert.ok(doc.diagnostics.some(d => d.message.includes('Unclosed')));
        });

        test('handles block name aliases', () => {
            const text = [
                'begin reaction rules',
                '  A() -> B() k1',
                'end rules',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.blocks.length, 1);
            assert.strictEqual(doc.blocks[0].type, 'reaction rules');
            assert.strictEqual(doc.diagnostics.length, 0);
        });
    });

    suite('parseBnglDocument — parameters', () => {
        test('parses parameter definitions', () => {
            const text = [
                'begin parameters',
                '  k1  1.0',
                '  k2  2.5e-3',
                '  V_ref  1.0',
                'end parameters',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.parameters.length, 3);
            assert.strictEqual(doc.parameters[0].name, 'k1');
            assert.strictEqual(doc.parameters[0].value, '1.0');
            assert.strictEqual(doc.parameters[1].name, 'k2');
            assert.strictEqual(doc.parameters[1].value, '2.5e-3');
            assert.strictEqual(doc.parameters[2].name, 'V_ref');
        });

        test('strips inline comments from parameter values', () => {
            const text = [
                'begin parameters',
                '  NA  6.02e23  # Avogadro',
                'end parameters',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.parameters.length, 1);
            assert.strictEqual(doc.parameters[0].name, 'NA');
            assert.strictEqual(doc.parameters[0].value, '6.02e23');
        });
    });

    suite('parseBnglDocument — molecule types', () => {
        test('parses molecule type definitions', () => {
            const text = [
                'begin molecule types',
                '  Xm()',
                '  A(b,s~u~p)',
                'end molecule types',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.moleculeTypes.length, 2);
            assert.strictEqual(doc.moleculeTypes[0].name, 'Xm');
            assert.strictEqual(doc.moleculeTypes[0].components.length, 0);
            assert.strictEqual(doc.moleculeTypes[1].name, 'A');
            assert.strictEqual(doc.moleculeTypes[1].components.length, 2);
        });
    });

    suite('parseBnglDocument — seed species', () => {
        test('parses seed species', () => {
            const text = [
                'begin seed species',
                '  Xm()  100',
                '  A(b,s~u)  0',
                'end seed species',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.seedSpecies.length, 2);
            assert.strictEqual(doc.seedSpecies[0].pattern, 'Xm()');
            assert.strictEqual(doc.seedSpecies[0].count, '100');
            assert.strictEqual(doc.seedSpecies[1].pattern, 'A(b,s~u)');
            assert.strictEqual(doc.seedSpecies[1].count, '0');
        });
    });

    suite('parseBnglDocument — observables', () => {
        test('parses observable definitions', () => {
            const text = [
                'begin observables',
                '  Molecules  Obs_A  A()',
                '  Species    Obs_B  B(s~p)',
                'end observables',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.observables.length, 2);
            assert.strictEqual(doc.observables[0].type, 'Molecules');
            assert.strictEqual(doc.observables[0].name, 'Obs_A');
            assert.strictEqual(doc.observables[0].pattern, 'A()');
            assert.strictEqual(doc.observables[1].type, 'Species');
            assert.strictEqual(doc.observables[1].name, 'Obs_B');
        });
    });

    suite('parseBnglDocument — functions', () => {
        test('parses function definitions', () => {
            const text = [
                'begin functions',
                '  rate_A() = k1 * Obs_A / (Km + Obs_A)',
                '  total() = Obs_A + Obs_B',
                'end functions',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.functions.length, 2);
            assert.strictEqual(doc.functions[0].name, 'rate_A');
            assert.strictEqual(doc.functions[0].args, '');
            assert.strictEqual(doc.functions[0].body, 'k1 * Obs_A / (Km + Obs_A)');
            assert.strictEqual(doc.functions[1].name, 'total');
        });
    });

    suite('parseBnglDocument — reaction rules', () => {
        test('parses forward reaction rules', () => {
            const text = [
                'begin reaction rules',
                '  0 -> A()  k_syn',
                '  A() -> 0  k_deg',
                'end reaction rules',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.rules.length, 2);
            assert.strictEqual(doc.rules[0].reactants, '0');
            assert.strictEqual(doc.rules[0].products, 'A()');
            assert.strictEqual(doc.rules[0].rate, 'k_syn');
        });

        test('parses bimolecular rules', () => {
            const text = [
                'begin reaction rules',
                '  A() + B() -> C() k1',
                'end reaction rules',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.rules.length, 1);
            assert.strictEqual(doc.rules[0].reactants, 'A() + B()');
        });

        test('parses labeled rules', () => {
            const text = [
                'begin reaction rules',
                '  _R1: 0 -> A() k_syn',
                'end reaction rules',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.rules.length, 1);
            assert.strictEqual(doc.rules[0].reactants, '0');
            assert.strictEqual(doc.rules[0].rate, 'k_syn');
            assert.strictEqual(doc.rules[0].sourceText, '_R1: 0 -> A() k_syn');
        });

        test('strips trailing keywords like DeleteMolecules', () => {
            const text = [
                'begin reaction rules',
                '  _R3: R1() -> 0 k_deg DeleteMolecules',
                'end reaction rules',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.rules.length, 1);
            assert.strictEqual(doc.rules[0].rate, 'k_deg');
            assert.strictEqual(doc.rules[0].products, '0');
        });

        test('k_deg used with DeleteMolecules is not flagged as unused', () => {
            const text = [
                'begin parameters',
                '  k_deg  1.0',
                'end parameters',
                'begin reaction rules',
                '  _R3: R1() -> 0 k_deg DeleteMolecules',
                'end reaction rules',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.ok(!doc.diagnostics.some(d => d.message.includes('"k_deg"') && d.message.includes('never referenced')));
        });
    });

    suite('parseBnglDocument — actions', () => {
        test('parses action calls', () => {
            const text = [
                'begin actions',
                '  generate_network({overwrite=>1})',
                '  simulate({method=>"ode",t_end=>100,n_steps=>200})',
                'end actions',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.actions.length, 2);
            assert.strictEqual(doc.actions[0].name, 'generate_network');
            assert.strictEqual(doc.actions[1].name, 'simulate');
            assert.ok(doc.actions[1].args.includes('method=>"ode"'));
        });
    });

    suite('parseBnglDocument — full model', () => {
        test('parses a complete model file', () => {
            const text = [
                'begin model',
                'begin parameters',
                '  k1  1.0',
                '  k2  2.0',
                'end parameters',
                'begin molecule types',
                '  A()',
                '  B()',
                'end molecule types',
                'begin seed species',
                '  A()  100',
                '  B()  0',
                'end seed species',
                'begin observables',
                '  Molecules  Obs_A  A()',
                '  Molecules  Obs_B  B()',
                'end observables',
                'begin functions',
                '  total() = Obs_A + Obs_B',
                'end functions',
                'begin reaction rules',
                '  A() -> B()  k1',
                '  B() -> A()  k2',
                'end reaction rules',
                'end model',
                'begin actions',
                '  generate_network({overwrite=>1})',
                '  simulate({method=>"ode",t_end=>10,n_steps=>100})',
                'end actions',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.diagnostics.length, 0);
            assert.strictEqual(doc.parameters.length, 2);
            assert.strictEqual(doc.moleculeTypes.length, 2);
            assert.strictEqual(doc.seedSpecies.length, 2);
            assert.strictEqual(doc.observables.length, 2);
            assert.strictEqual(doc.functions.length, 1);
            assert.strictEqual(doc.rules.length, 2);
            assert.strictEqual(doc.actions.length, 2);
            // model + parameters + molecule types + seed species + observables + functions + reaction rules + actions = 8
            assert.strictEqual(doc.blocks.length, 8);
        });
    });

    suite('parseBnglDocument — validation', () => {
        test('detects duplicate parameter names', () => {
            const text = [
                'begin parameters',
                '  k1  1.0',
                '  k2  2.0',
                '  k1  3.0',
                'end parameters',
            ].join('\n');

            const doc = parseBnglDocument(text);
            const dupes = doc.diagnostics.filter(d => d.message.includes('Duplicate parameter'));
            assert.strictEqual(dupes.length, 1);
            assert.ok(dupes[0].message.includes('"k1"'));
            assert.strictEqual(dupes[0].line, 3);
        });

        test('detects duplicate molecule type names', () => {
            const text = [
                'begin molecule types',
                '  A()',
                '  B()',
                '  A(s~u~p)',
                'end molecule types',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.ok(doc.diagnostics.some(d => d.message.includes('Duplicate molecule type') && d.message.includes('"A"')));
        });

        test('detects duplicate observable names', () => {
            const text = [
                'begin observables',
                '  Molecules  Obs_A  A()',
                '  Molecules  Obs_A  B()',
                'end observables',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.ok(doc.diagnostics.some(d => d.message.includes('Duplicate observable')));
        });

        test('warns on empty blocks', () => {
            const text = [
                'begin parameters',
                'end parameters',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.ok(doc.diagnostics.some(d => d.severity === 'warning' && d.message.includes('Empty')));
        });

        test('does not warn on model wrapper block', () => {
            const text = [
                'begin model',
                'end model',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.ok(!doc.diagnostics.some(d => d.message.includes('Empty "model"')));
        });

        test('warns on unused parameters', () => {
            const text = [
                'begin parameters',
                '  k1  1.0',
                '  k_unused  99',
                'end parameters',
                'begin reaction rules',
                '  0 -> A()  k1',
                'end reaction rules',
            ].join('\n');

            const doc = parseBnglDocument(text);
            const unused = doc.diagnostics.filter(d => d.message.includes('never referenced'));
            assert.strictEqual(unused.length, 1);
            assert.ok(unused[0].message.includes('"k_unused"'));
        });

        test('does not warn on parameter used in function body', () => {
            const text = [
                'begin parameters',
                '  Km  10',
                'end parameters',
                'begin functions',
                '  rate() = Obs_A / (Km + Obs_A)',
                'end functions',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.ok(!doc.diagnostics.some(d => d.message.includes('"Km"') && d.message.includes('never referenced')));
        });

        test('does not false-match k1 when k10 is referenced', () => {
            const text = [
                'begin parameters',
                '  k1   1.0',
                '  k10  10.0',
                'end parameters',
                'begin reaction rules',
                '  0 -> A()  k10',
                'end reaction rules',
            ].join('\n');

            const doc = parseBnglDocument(text);
            // k1 is unused (k10 does not count), k10 is used
            const unused = doc.diagnostics.filter(d => d.message.includes('never referenced'));
            assert.strictEqual(unused.length, 1);
            assert.ok(unused[0].message.includes('"k1"'));
        });
    });

    suite('parseBnglDocument — comments and whitespace', () => {
        test('skips comment-only lines', () => {
            const text = [
                'begin parameters',
                '  # This is a comment',
                '  k1  1.0',
                '  # Another comment',
                'end parameters',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.parameters.length, 1);
        });

        test('skips blank lines', () => {
            const text = [
                'begin parameters',
                '',
                '  k1  1.0',
                '',
                'end parameters',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.parameters.length, 1);
        });
    });

    suite('parseBnglDocument — line continuation', () => {
        test('joins lines ending with backslash', () => {
            const text = [
                'begin parameters',
                '  k1  \\',
                '    1.0',
                'end parameters',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.parameters.length, 1);
            assert.strictEqual(doc.parameters[0].name, 'k1');
            assert.ok(doc.parameters[0].value.includes('1.0'));
        });

        test('handles multiple continuation lines', () => {
            const text = [
                'begin functions',
                '  rate() = a \\',
                '    + b \\',
                '    + c',
                'end functions',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.functions.length, 1);
            assert.ok(doc.functions[0].body.includes('a'));
            assert.ok(doc.functions[0].body.includes('b'));
            assert.ok(doc.functions[0].body.includes('c'));
        });
    });

    suite('parseBnglDocument — top-level actions', () => {
        test('parses bare action calls outside any block', () => {
            const text = [
                'begin model',
                'begin parameters',
                '  k1 1.0',
                'end parameters',
                'end model',
                '',
                'generate_network({overwrite=>1})',
                'simulate({method=>"ode",t_end=>10,n_steps=>100})',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.actions.length, 2);
            assert.strictEqual(doc.actions[0].name, 'generate_network');
            assert.strictEqual(doc.actions[1].name, 'simulate');
        });

        test('parses visualize actions at top level', () => {
            const text = [
                'begin model',
                'end model',
                "visualize({type=>'contactmap'})",
                "visualize({type=>'ruleviz_pattern'})",
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.actions.length, 2);
            assert.strictEqual(doc.actions[0].name, 'visualize');
            assert.strictEqual(doc.actions[1].name, 'visualize');
        });

        test('parses action with trailing semicolon', () => {
            const text = 'generate_network({overwrite=>1});';

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.actions.length, 1);
            assert.strictEqual(doc.actions[0].name, 'generate_network');
        });
    });

    suite('parseBnglDocument — compartments', () => {
        test('parses compartment definitions', () => {
            const text = [
                'begin compartments',
                '  EC   3  vol_EC',
                '  PM   2  sa_PM  EC',
                '  CP   3  vol_CP  PM',
                'end compartments',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.compartments.length, 3);
            assert.strictEqual(doc.compartments[0].name, 'EC');
            assert.strictEqual(doc.compartments[0].dimensions, 3);
            assert.strictEqual(doc.compartments[0].size, 'vol_EC');
            assert.strictEqual(doc.compartments[0].outside, '');
            assert.strictEqual(doc.compartments[1].name, 'PM');
            assert.strictEqual(doc.compartments[1].dimensions, 2);
            assert.strictEqual(doc.compartments[1].outside, 'EC');
            assert.strictEqual(doc.compartments[2].name, 'CP');
            assert.strictEqual(doc.compartments[2].outside, 'PM');
        });
    });

    suite('parseBnglDocument — energy patterns', () => {
        test('parses energy pattern definitions', () => {
            const text = [
                'begin energy patterns',
                '  A(b!1).B(a!1)  -5.0',
                '  Protein(Y~p)   Gf_phos',
                'end energy patterns',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.energyPatterns.length, 2);
            assert.strictEqual(doc.energyPatterns[0].energy, '-5.0');
            assert.strictEqual(doc.energyPatterns[1].energy, 'Gf_phos');
        });
    });

    suite('parseBnglDocument — Counter observable type', () => {
        test('parses Counter observables', () => {
            const text = [
                'begin observables',
                '  Molecules  Obs_A  A()',
                '  Counter    count_events  0',
                'end observables',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.observables.length, 2);
            assert.strictEqual(doc.observables[1].type, 'Counter');
            assert.strictEqual(doc.observables[1].name, 'count_events');
        });
    });

    suite('parseBnglDocument — rule labels', () => {
        test('preserves rule label in AST', () => {
            const text = [
                'begin reaction rules',
                '  myRule: A() -> B() k1',
                'end reaction rules',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.rules.length, 1);
            assert.strictEqual(doc.rules[0].label, 'myRule');
        });

        test('handles rules with no label', () => {
            const text = [
                'begin reaction rules',
                '  A() -> B() k1',
                'end reaction rules',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.rules[0].label, '');
        });
    });

    suite('parseBnglDocument — priority keyword', () => {
        test('strips priority=N from rule', () => {
            const text = [
                'begin reaction rules',
                '  A() -> B() k1 priority=5',
                'end reaction rules',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.rules.length, 1);
            assert.strictEqual(doc.rules[0].rate, 'k1');
        });
    });

    suite('parseBnglDocument — unused parameter with compartment size', () => {
        test('parameter used as compartment size is not flagged unused', () => {
            const text = [
                'begin parameters',
                '  vol_CP 1.0',
                'end parameters',
                'begin compartments',
                '  CP 3 vol_CP',
                'end compartments',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.ok(!doc.diagnostics.some(d => d.message.includes('"vol_CP"') && d.message.includes('never referenced')));
        });
    });

    suite('parseBnglDocument — bidirectional rules', () => {
        test('parses reversible rule with <->', () => {
            const text = [
                'begin reaction rules',
                '  A() + B() <-> C() kf, kr',
                'end reaction rules',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.rules.length, 1);
            assert.strictEqual(doc.rules[0].reactants, 'A() + B()');
            // "C() kf," is products, "kr" is rate (last token)
            // The rate for bidirectional is the full "kf, kr" pair
            assert.ok(doc.rules[0].products.includes('C()'));
        });
    });

    suite('parseBnglDocument — string-aware comment stripping', () => {
        test('does not strip # inside double-quoted strings', () => {
            const text = [
                'begin actions',
                '  simulate({method=>"ode",suffix=>"run#1",t_end=>100})',
                'end actions',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.actions.length, 1);
            assert.ok(doc.actions[0].args.includes('run#1'));
        });

        test('strips # outside of strings normally', () => {
            const text = [
                'begin parameters',
                '  k1  1.0  # rate constant',
                'end parameters',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.parameters[0].value, '1.0');
        });
    });

    suite('parseBnglDocument — function alternate form', () => {
        test('parses function without parens (name = expression)', () => {
            const text = [
                'begin functions',
                '  total = Obs_A + Obs_B',
                'end functions',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.functions.length, 1);
            assert.strictEqual(doc.functions[0].name, 'total');
            assert.strictEqual(doc.functions[0].args, '');
            assert.strictEqual(doc.functions[0].body, 'Obs_A + Obs_B');
        });
    });

    suite('parseBnglDocument — parameter equals syntax', () => {
        test('parses parameter with = sign', () => {
            const text = [
                'begin parameters',
                '  k1 = 1.0',
                '  k2=2.0',
                'end parameters',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.parameters.length, 2);
            assert.strictEqual(doc.parameters[0].name, 'k1');
            assert.strictEqual(doc.parameters[0].value, '1.0');
            assert.strictEqual(doc.parameters[1].name, 'k2');
            assert.strictEqual(doc.parameters[1].value, '2.0');
        });
    });

    suite('parseBnglDocument — seed species $ modifier', () => {
        test('parses species with $ fixed modifier', () => {
            const text = [
                'begin seed species',
                '  $A()  100',
                'end seed species',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.seedSpecies.length, 1);
            assert.strictEqual(doc.seedSpecies[0].pattern, 'A()');
            assert.strictEqual(doc.seedSpecies[0].count, '100');
        });
    });

    suite('parseBnglDocument — multiple trailing rule keywords', () => {
        test('strips multiple keywords', () => {
            const text = [
                'begin reaction rules',
                '  A() -> 0 k_deg DeleteMolecules MoveConnected',
                'end reaction rules',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.rules[0].rate, 'k_deg');
        });

        test('strips exclude_reactants with parens', () => {
            const text = [
                'begin reaction rules',
                '  A(b) + B(a) -> A(b!1).B(a!1) kf exclude_reactants(1,A(b!+))',
                'end reaction rules',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.rules[0].rate, 'kf');
        });

        test('strips TotalRate keyword', () => {
            const text = [
                'begin reaction rules',
                '  0 -> A() k_syn TotalRate',
                'end reaction rules',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.rules[0].rate, 'k_syn');
        });
    });

    suite('parseBnglDocument — numeric line labels', () => {
        test('strips numeric labels from parameters', () => {
            const text = [
                'begin parameters',
                '  1  k1  1.0',
                '  2  k2  2.0',
                'end parameters',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.parameters.length, 2);
            assert.strictEqual(doc.parameters[0].name, 'k1');
            assert.strictEqual(doc.parameters[1].name, 'k2');
        });

        test('strips numeric labels from observables', () => {
            const text = [
                'begin observables',
                '  1  Molecules  Obs_A  A()',
                'end observables',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.observables.length, 1);
            assert.strictEqual(doc.observables[0].name, 'Obs_A');
        });
    });

    suite('parseBnglDocument — observable with multiple patterns', () => {
        test('parses observable with comma-separated patterns', () => {
            const text = [
                'begin observables',
                '  Molecules  Obs_AB  A(), B()',
                'end observables',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.observables.length, 1);
            assert.strictEqual(doc.observables[0].name, 'Obs_AB');
            assert.ok(doc.observables[0].pattern.includes('A()'));
            assert.ok(doc.observables[0].pattern.includes('B()'));
        });
    });

    suite('parseBnglDocument — unused parameter in action args', () => {
        test('parameter used in action args is not flagged unused', () => {
            const text = [
                'begin parameters',
                '  t_end_val  100',
                'end parameters',
                'begin actions',
                '  simulate({method=>"ode",t_end=>t_end_val})',
                'end actions',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.ok(!doc.diagnostics.some(d =>
                d.message.includes('"t_end_val"') && d.message.includes('never referenced')
            ));
        });
    });

    suite('parseBnglDocument — unused parameter in energy pattern', () => {
        test('parameter used in energy pattern is not flagged unused', () => {
            const text = [
                'begin parameters',
                '  Gf  5.0',
                'end parameters',
                'begin energy patterns',
                '  A(b!1).B(a!1)  Gf',
                'end energy patterns',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.ok(!doc.diagnostics.some(d =>
                d.message.includes('"Gf"') && d.message.includes('never referenced')
            ));
        });

        test('parameter used in a multi-token energy expression is not flagged unused', () => {
            // The energy is split off at the last whitespace, so the parameter lands in the
            // pattern half; it must still count as a reference.
            const text = [
                'begin parameters',
                '  Gbond  2.5',
                'end parameters',
                'begin energy patterns',
                '  A(b!1).B(a!1)  Gbond * 0.5',
                'end energy patterns',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.ok(!doc.diagnostics.some(d =>
                d.message.includes('"Gbond"') && d.message.includes('never referenced')
            ));
        });
    });

    suite('parseBnglDocument — unused parameter referencing another parameter', () => {
        test('parameter referencing another parameter counts as usage', () => {
            const text = [
                'begin parameters',
                '  base_rate  1.0',
                '  k1  2 * base_rate',
                'end parameters',
                'begin reaction rules',
                '  0 -> A()  k1',
                'end reaction rules',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.ok(!doc.diagnostics.some(d =>
                d.message.includes('"base_rate"') && d.message.includes('never referenced')
            ));
        });
    });

    suite('parseBnglDocument — duplicate function names', () => {
        test('detects duplicate function names', () => {
            const text = [
                'begin functions',
                '  rate() = k1 * Obs_A',
                '  rate() = k2 * Obs_B',
                'end functions',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.ok(doc.diagnostics.some(d => d.message.includes('Duplicate function') && d.message.includes('"rate"')));
        });
    });

    suite('parseBnglDocument — trailing backslash at EOF', () => {
        test('handles file ending with continuation backslash', () => {
            const text = 'begin parameters\n  k1  \\';

            const doc = parseBnglDocument(text);
            // Should not crash — unclosed block is reported
            assert.ok(doc.diagnostics.some(d => d.message.includes('Unclosed')));
        });
    });

    suite('parseBnglDocument — protocol block', () => {
        test('parses actions inside protocol block', () => {
            const text = [
                'begin protocol',
                '  simulate({method=>"ode",t_end=>10})',
                'end protocol',
            ].join('\n');

            const doc = parseBnglDocument(text);
            assert.strictEqual(doc.actions.length, 1);
            assert.strictEqual(doc.actions[0].name, 'simulate');
        });
    });

    suite('parseBnglDocument — real BNGL model file', () => {
        test('parses Gardner2000 model without errors', () => {
            const modelPath = path.resolve(__dirname, '../../../examples/Gardner2000.bngl');
            if (!fs.existsSync(modelPath)) {
                // Skip if model file not available (CI environments)
                return;
            }
            const text = fs.readFileSync(modelPath, 'utf-8');
            const doc = parseBnglDocument(text);

            // Should have no error diagnostics (warnings are OK)
            const errors = doc.diagnostics.filter(d => d.severity === 'error');
            assert.strictEqual(errors.length, 0, `Unexpected errors: ${errors.map(e => e.message).join(', ')}`);

            // Basic structure checks
            assert.ok(doc.parameters.length > 0, 'Should have parameters');
            assert.ok(doc.moleculeTypes.length > 0, 'Should have molecule types');
            assert.ok(doc.seedSpecies.length > 0, 'Should have seed species');
            assert.ok(doc.observables.length > 0, 'Should have observables');
            assert.ok(doc.functions.length > 0, 'Should have functions');
            assert.ok(doc.rules.length > 0, 'Should have rules');
            assert.ok(doc.actions.length > 0, 'Should have actions');
        });

        test('parses Kholodenko2000 model without errors', () => {
            const modelPath = path.resolve(__dirname, '../../../examples/Kholodenko2000.bngl');
            if (!fs.existsSync(modelPath)) {
                return;
            }
            const text = fs.readFileSync(modelPath, 'utf-8');
            const doc = parseBnglDocument(text);

            const errors = doc.diagnostics.filter(d => d.severity === 'error');
            assert.strictEqual(errors.length, 0, `Unexpected errors: ${errors.map(e => e.message).join(', ')}`);

            assert.ok(doc.parameters.length >= 20, 'Should have many parameters');
            assert.ok(doc.functions.length >= 10, 'Should have many functions');
            assert.ok(doc.rules.length >= 10, 'Should have many rules');
        });

        test('parses nfkb model without errors', () => {
            const modelPath = path.resolve(__dirname, '../../../examples/nfkb.bngl');
            if (!fs.existsSync(modelPath)) {
                return;
            }
            const text = fs.readFileSync(modelPath, 'utf-8');
            const doc = parseBnglDocument(text);

            const errors = doc.diagnostics.filter(d => d.severity === 'error');
            assert.strictEqual(errors.length, 0, `Unexpected errors: ${errors.map(e => e.message).join(', ')}`);

            assert.ok(doc.parameters.length >= 30, 'Should have many parameters');
            assert.ok(doc.functions.length >= 3, 'Should have functions');
            assert.ok(doc.seedSpecies.length >= 20, 'Should have many seed species');
            assert.ok(doc.rules.length >= 15, 'Should have many rules');
        });
    });
});
