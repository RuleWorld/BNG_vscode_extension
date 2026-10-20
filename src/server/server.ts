import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    InitializeResult,
    TextDocumentSyncKind,
    Diagnostic,
    DiagnosticSeverity,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    Definition,
    Location,
    ReferenceParams,
    Hover,
    MarkupKind,
    InsertTextFormat,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseBnglDocument, BnglDocument, BnglDiagnostic, stripComment } from './parser';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// Cache the latest parse result per document URI
const documentCache = new Map<string, BnglDocument>();

connection.onInitialize((_params: InitializeParams): InitializeResult => {
    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                triggerCharacters: [' '],
            },
            definitionProvider: true,
            referencesProvider: true,
            hoverProvider: true,
        },
    };
});

// ── Diagnostics ─────────────────────────────────────────────────────

documents.onDidChangeContent(change => {
    validateDocument(change.document);
});

documents.onDidClose(e => {
    documentCache.delete(e.document.uri);
    connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

function severityToLsp(severity: BnglDiagnostic['severity']): DiagnosticSeverity {
    switch (severity) {
        case 'error': return DiagnosticSeverity.Error;
        case 'warning': return DiagnosticSeverity.Warning;
        case 'info': return DiagnosticSeverity.Information;
    }
}

function getOrParseDocument(textDocument: TextDocument): BnglDocument {
    const cached = documentCache.get(textDocument.uri);
    if (cached) return cached;
    const parsed = parseBnglDocument(textDocument.getText());
    documentCache.set(textDocument.uri, parsed);
    return parsed;
}

function validateDocument(textDocument: TextDocument): void {
    const text = textDocument.getText();
    const parsed = parseBnglDocument(text);
    documentCache.set(textDocument.uri, parsed);

    const diagnostics: Diagnostic[] = parsed.diagnostics.map(d => ({
        severity: severityToLsp(d.severity),
        range: {
            start: { line: d.line, character: d.startChar ?? 0 },
            end: { line: d.endLine ?? d.line, character: d.endChar ?? Number.MAX_SAFE_INTEGER },
        },
        message: d.message,
        source: 'bngl',
    }));

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// ── BNGL language data ──────────────────────────────────────────────
// Source of truth: BioNetGen bng2/Perl2/ (BNGModel.pm, BNGAction.pm,
// Expression.pm, RateLaw.pm, RxnRule.pm, Observable.pm)

// All valid block types (BNGModel.pm:241-256)
const BLOCK_TYPES = [
    'parameters', 'molecule types', 'seed species', 'species',
    'reaction rules', 'observables', 'functions',
    'compartments', 'actions', 'protocol',
    'energy patterns', 'population maps', 'population types',
    'reactions', 'groups', 'model',
];

// All actions recognized by BioNetGen (BNGModel.pm, BNGAction.pm)
const ACTION_NAMES: { name: string; detail: string; snippet: string }[] = [
    // Simulation
    { name: 'simulate', detail: 'Run simulation (general purpose)', snippet: 'simulate({method=>"ode",t_start=>0,t_end=>100,n_steps=>200})' },
    { name: 'simulate_ode', detail: 'ODE simulation', snippet: 'simulate_ode({t_start=>0,t_end=>100,n_steps=>200})' },
    { name: 'simulate_ssa', detail: 'SSA (Gillespie) stochastic simulation', snippet: 'simulate_ssa({t_start=>0,t_end=>100,n_steps=>200})' },
    { name: 'simulate_pla', detail: 'Partitioned-leaping simulation', snippet: 'simulate_pla({t_start=>0,t_end=>100,n_steps=>200})' },
    { name: 'simulate_psa', detail: 'Partial propensity stochastic simulation', snippet: 'simulate_psa({t_start=>0,t_end=>100,n_steps=>200})' },
    { name: 'simulate_nf', detail: 'Network-free (NFsim) simulation', snippet: 'simulate_nf({t_start=>0,t_end=>100,n_steps=>200})' },
    { name: 'simulate_protocol', detail: 'Run simulation protocol', snippet: 'simulate_protocol()' },

    // Network generation
    { name: 'generate_network', detail: 'Generate reaction network from rules', snippet: 'generate_network({overwrite=>1})' },
    { name: 'generate_hybrid_model', detail: 'Generate hybrid particle/population model', snippet: 'generate_hybrid_model({overwrite=>1})' },

    // Parameter/concentration manipulation
    { name: 'setParameter', detail: 'Set parameter value', snippet: 'setParameter("${1:name}",${2:value})' },
    { name: 'setConcentration', detail: 'Set species concentration', snippet: 'setConcentration("${1:species}",${2:value})' },
    { name: 'addConcentration', detail: 'Add to species concentration', snippet: 'addConcentration("${1:species}",${2:value})' },
    { name: 'saveParameters', detail: 'Cache current parameter values', snippet: 'saveParameters()' },
    { name: 'resetParameters', detail: 'Restore cached parameter values', snippet: 'resetParameters()' },
    { name: 'saveConcentrations', detail: 'Cache current species concentrations', snippet: 'saveConcentrations()' },
    { name: 'resetConcentrations', detail: 'Restore cached species concentrations', snippet: 'resetConcentrations()' },

    // Analysis
    { name: 'parameter_scan', detail: 'Scan over a parameter range', snippet: 'parameter_scan({method=>"ode",parameter=>"${1:param}",par_min=>${2:0},par_max=>${3:1},n_scan_pts=>${4:10},t_end=>${5:100},n_steps=>${6:200}})' },
    { name: 'bifurcate', detail: 'Bifurcation analysis', snippet: 'bifurcate({method=>"ode",parameter=>"${1:param}",par_min=>${2:0},par_max=>${3:1},n_scan_pts=>${4:10},t_end=>${5:100},n_steps=>${6:200}})' },
    { name: 'LinearParameterSensitivity', detail: 'Compute linear parameter sensitivities', snippet: 'LinearParameterSensitivity()' },

    // Export
    { name: 'writeSBML', detail: 'Export model to SBML format', snippet: 'writeSBML()' },
    { name: 'writeMexFile', detail: 'Export MEX file for MATLAB', snippet: 'writeMexFile()' },
    { name: 'writeMfile', detail: 'Export MATLAB .m file', snippet: 'writeMfile()' },
    { name: 'writeNetwork', detail: 'Write reaction network to .net file', snippet: 'writeNetwork()' },

    // Visualization
    { name: 'visualize', detail: 'Generate visualization (contact map, rule viz, regulatory graph)', snippet: 'visualize({type=>"${1|contactmap,ruleviz_pattern,ruleviz_operation,regulatory|}"})' },

    // File I/O
    { name: 'readFile', detail: 'Read a BioNetGen file', snippet: 'readFile({file=>"${1:filename}"})' },

    // System
    { name: 'setOption', detail: 'Set model option', snippet: 'setOption("${1:option}","${2:value}")' },
    { name: 'quit', detail: 'Exit BioNetGen', snippet: 'quit()' },
    { name: 'version', detail: 'Print BioNetGen version', snippet: 'version()' },
];

// Built-in math functions (Expression.pm)
const BUILTIN_FUNCTIONS: { name: string; signature: string; detail: string }[] = [
    // Trigonometric
    { name: 'sin', signature: 'sin(x)', detail: 'Sine' },
    { name: 'cos', signature: 'cos(x)', detail: 'Cosine' },
    { name: 'tan', signature: 'tan(x)', detail: 'Tangent' },
    { name: 'asin', signature: 'asin(x)', detail: 'Arcsine' },
    { name: 'acos', signature: 'acos(x)', detail: 'Arccosine' },
    { name: 'atan', signature: 'atan(x)', detail: 'Arctangent' },
    // Hyperbolic
    { name: 'sinh', signature: 'sinh(x)', detail: 'Hyperbolic sine' },
    { name: 'cosh', signature: 'cosh(x)', detail: 'Hyperbolic cosine' },
    { name: 'tanh', signature: 'tanh(x)', detail: 'Hyperbolic tangent' },
    { name: 'asinh', signature: 'asinh(x)', detail: 'Inverse hyperbolic sine' },
    { name: 'acosh', signature: 'acosh(x)', detail: 'Inverse hyperbolic cosine' },
    { name: 'atanh', signature: 'atanh(x)', detail: 'Inverse hyperbolic tangent' },
    // Exponential / logarithmic
    { name: 'exp', signature: 'exp(x)', detail: 'Exponential (e^x)' },
    { name: 'ln', signature: 'ln(x)', detail: 'Natural logarithm' },
    { name: 'log10', signature: 'log10(x)', detail: 'Base-10 logarithm' },
    { name: 'log2', signature: 'log2(x)', detail: 'Base-2 logarithm' },
    { name: 'sqrt', signature: 'sqrt(x)', detail: 'Square root' },
    { name: 'abs', signature: 'abs(x)', detail: 'Absolute value' },
    // Rounding
    { name: 'rint', signature: 'rint(x)', detail: 'Round to nearest integer' },
    // Aggregate
    { name: 'min', signature: 'min(a, b)', detail: 'Minimum of arguments' },
    { name: 'max', signature: 'max(a, b)', detail: 'Maximum of arguments' },
    { name: 'sum', signature: 'sum(a, b, ...)', detail: 'Sum of arguments' },
    { name: 'avg', signature: 'avg(a, b, ...)', detail: 'Average of arguments' },
    // Conditional
    { name: 'if', signature: 'if(cond, true_val, false_val)', detail: 'Conditional expression' },
    // Special
    { name: 'mratio', signature: 'mratio(a, b, c)', detail: 'Multi-state ratio function: a*(a-1)*...*(a-c+1) / (b*(b-1)*...*(b-c+1))' },
    { name: 'time', signature: 'time()', detail: 'Current simulation time' },
    { name: 'tfun', signature: "tfun('file.tfun') | tfun([x],[y],index)", detail: 'Table function — interpolate from file or inline data arrays' },
    { name: 'TFUN', signature: "TFUN(observable, 'file')", detail: 'Legacy table function (uppercase, backward compatible)' },
];

// Math constants (Expression.pm)
const MATH_CONSTANTS: { name: string; detail: string }[] = [
    { name: '_pi', detail: 'Mathematical constant \u03C0 (3.14159...)' },
    { name: '_e', detail: "Mathematical constant e (Euler's number, 2.71828...)" },
];

// Rate law types for reaction rules (RateLaw.pm)
const RATE_LAW_TYPES: { name: string; signature: string; detail: string }[] = [
    { name: 'Sat', signature: 'Sat(kcat, Km)', detail: 'Saturation kinetics: kcat / (1 + Km/[S])' },
    { name: 'MM', signature: 'MM(Vmax, Km)', detail: 'Michaelis-Menten: Vmax * [S] / (Km + [S])' },
    { name: 'Hill', signature: 'Hill(Vmax, K, n)', detail: 'Hill kinetics: Vmax * [S]^n / (K^n + [S]^n)' },
    { name: 'Arrhenius', signature: 'Arrhenius(A, Ea)', detail: 'Arrhenius rate: A * exp(-Ea / (kB*T))' },
    { name: 'FunctionProduct', signature: 'FunctionProduct(f1, f2)', detail: 'Product of two local functions as rate law' },
];

// Hover docs for actions — keyed by action name
const ACTION_DOCS: Record<string, string> = {};
for (const a of ACTION_NAMES) {
    ACTION_DOCS[a.name] = `${a.detail}\n\nSnippet: \`${a.snippet.replace(/\$\{\d+[^}]*\}/g, '...')}\``;
}

// Hover docs for built-in functions
const BUILTIN_FUNCTION_DOCS: Record<string, string> = {};
for (const f of BUILTIN_FUNCTIONS) {
    BUILTIN_FUNCTION_DOCS[f.name] = `**built-in** \`${f.signature}\`\n\n${f.detail}`;
}

// Hover docs for rate law types
const RATE_LAW_DOCS: Record<string, string> = {};
for (const r of RATE_LAW_TYPES) {
    RATE_LAW_DOCS[r.name] = `**rate law** \`${r.signature}\`\n\n${r.detail}`;
}

// ── Completion ──────────────────────────────────────────────────────

function getEnclosingBlockType(doc: BnglDocument, line: number): string | null {
    // doc.blocks is ordered by close ("end") time, so for nested blocks the innermost closes
    // first and is matched here before any enclosing block (e.g. the surrounding "model" wrapper).
    for (const block of doc.blocks) {
        if (line > block.startLine && (block.endLine === -1 || line < block.endLine)) {
            if (block.type !== 'model') return block.type;
        }
    }
    return null;
}

connection.onCompletion((params: TextDocumentPositionParams): CompletionItem[] => {
    const textDocument = documents.get(params.textDocument.uri);
    if (!textDocument) return [];

    const line = textDocument.getText({
        start: { line: params.position.line, character: 0 },
        end: params.position,
    });
    const trimmed = line.trimStart();

    // After "begin " or "end " — suggest block types
    const beginEndMatch = trimmed.match(/^(begin|end)\s+$/i);
    if (beginEndMatch) {
        return BLOCK_TYPES.map(bt => ({
            label: bt,
            kind: CompletionItemKind.Keyword,
            detail: `${beginEndMatch[1]} ${bt}`,
        }));
    }

    // Partial block type after begin/end
    const partialMatch = trimmed.match(/^(begin|end)\s+(\S+.*)$/i);
    if (partialMatch) {
        const partial = partialMatch[2].toLowerCase();
        return BLOCK_TYPES
            .filter(bt => bt.startsWith(partial))
            .map(bt => ({
                label: bt,
                kind: CompletionItemKind.Keyword,
                detail: `${partialMatch[1]} ${bt}`,
            }));
    }

    const parsed = getOrParseDocument(textDocument);
    const blockType = getEnclosingBlockType(parsed, params.position.line);

    // Inside actions block or top-level — suggest action names
    if (blockType === 'actions' || blockType === 'protocol' || blockType === null) {
        return ACTION_NAMES.map(a => ({
            label: a.name,
            kind: CompletionItemKind.Function,
            detail: a.detail,
            insertText: a.snippet,
            insertTextFormat: InsertTextFormat.Snippet,
        }));
    }

    // Inside reaction rules — suggest rate law types, parameters, functions, molecules, builtins
    if (blockType === 'reaction rules') {
        return [
            ...getExpressionCompletions(parsed),
            ...getMoleculeCompletions(parsed),
            ...getRateLawCompletions(),
        ];
    }

    // Inside expression contexts — suggest parameters, functions, builtins
    if (blockType === 'parameters' || blockType === 'functions' ||
        blockType === 'energy patterns') {
        return getExpressionCompletions(parsed);
    }

    // Inside seed species, observables — suggest molecules + expression completions
    if (blockType === 'seed species' || blockType === 'observables') {
        return [
            ...getMoleculeCompletions(parsed),
            ...getExpressionCompletions(parsed),
        ];
    }

    return [];
});

function getExpressionCompletions(parsed: BnglDocument): CompletionItem[] {
    const items: CompletionItem[] = [];
    for (const p of parsed.parameters) {
        items.push({
            label: p.name,
            kind: CompletionItemKind.Variable,
            detail: `Parameter: ${p.value}`,
        });
    }
    for (const f of parsed.functions) {
        items.push({
            label: f.name,
            kind: CompletionItemKind.Function,
            detail: `Function: ${f.name}(${f.args})`,
            insertText: `${f.name}()`,
        });
    }
    for (const o of parsed.observables) {
        items.push({
            label: o.name,
            kind: CompletionItemKind.Variable,
            detail: `Observable (${o.type}): ${o.pattern}`,
        });
    }
    // Built-in functions
    for (const bf of BUILTIN_FUNCTIONS) {
        items.push({
            label: bf.name,
            kind: CompletionItemKind.Function,
            detail: `Built-in: ${bf.detail}`,
            insertText: `${bf.name}(\${1})`,
            insertTextFormat: InsertTextFormat.Snippet,
        });
    }
    // Math constants
    for (const mc of MATH_CONSTANTS) {
        items.push({
            label: mc.name,
            kind: CompletionItemKind.Constant,
            detail: mc.detail,
        });
    }
    return items;
}

function getMoleculeCompletions(parsed: BnglDocument): CompletionItem[] {
    return parsed.moleculeTypes.map(mt => {
        const sig = mt.components.length > 0
            ? `${mt.name}(${mt.components.map(c => c.states.length > 0 ? `${c.name}~${c.states.join('~')}` : c.name).join(',')})`
            : `${mt.name}()`;
        return {
            label: mt.name,
            kind: CompletionItemKind.Class,
            detail: `Molecule type: ${sig}`,
            insertText: sig,
        };
    });
}

function getRateLawCompletions(): CompletionItem[] {
    return RATE_LAW_TYPES.map(r => ({
        label: r.name,
        kind: CompletionItemKind.TypeParameter,
        detail: `Rate law: ${r.detail}`,
        insertText: `${r.name}(\${1})`,
        insertTextFormat: InsertTextFormat.Snippet,
    }));
}

// ── Go-to-definition ────────────────────────────────────────────────

function getWordAtPosition(textDocument: TextDocument, line: number, character: number): { word: string; start: number; end: number } | null {
    const lineText = textDocument.getText({
        start: { line, character: 0 },
        end: { line: line + 1, character: 0 },
    });
    // Find word boundaries around the cursor
    const wordRegex = /\w+/g;
    let match;
    while ((match = wordRegex.exec(lineText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (character >= start && character <= end) {
            return { word: match[0], start, end };
        }
    }
    return null;
}

interface SymbolDefinition {
    name: string;
    line: number;
    kind: string;
    detail: string;
}

function getAllDefinitions(parsed: BnglDocument): SymbolDefinition[] {
    const defs: SymbolDefinition[] = [];
    for (const p of parsed.parameters) {
        defs.push({ name: p.name, line: p.line, kind: 'parameter', detail: `= ${p.value}` });
    }
    for (const mt of parsed.moleculeTypes) {
        const sig = mt.components.length > 0
            ? `(${mt.components.map(c => c.states.length > 0 ? `${c.name}~${c.states.join('~')}` : c.name).join(',')})`
            : '()';
        defs.push({ name: mt.name, line: mt.line, kind: 'molecule type', detail: sig });
    }
    for (const o of parsed.observables) {
        defs.push({ name: o.name, line: o.line, kind: 'observable', detail: `${o.type}: ${o.pattern}` });
    }
    for (const f of parsed.functions) {
        defs.push({ name: f.name, line: f.line, kind: 'function', detail: `(${f.args}) = ${f.body}` });
    }
    for (const c of parsed.compartments) {
        defs.push({ name: c.name, line: c.line, kind: 'compartment', detail: `${c.dimensions}D, size=${c.size}${c.outside ? ', outside=' + c.outside : ''}` });
    }
    return defs;
}

connection.onDefinition((params: TextDocumentPositionParams): Definition | null => {
    const textDocument = documents.get(params.textDocument.uri);
    if (!textDocument) return null;

    const wordInfo = getWordAtPosition(textDocument, params.position.line, params.position.character);
    if (!wordInfo) return null;

    const parsed = getOrParseDocument(textDocument);
    const defs = getAllDefinitions(parsed);
    const def = defs.find(d => d.name === wordInfo.word);
    if (!def) return null;

    return Location.create(params.textDocument.uri, {
        start: { line: def.line, character: 0 },
        end: { line: def.line, character: Number.MAX_SAFE_INTEGER },
    });
});

// ── Find All References ─────────────────────────────────────────────

connection.onReferences((params: ReferenceParams): Location[] => {
    const textDocument = documents.get(params.textDocument.uri);
    if (!textDocument) return [];

    const wordInfo = getWordAtPosition(textDocument, params.position.line, params.position.character);
    if (!wordInfo) return [];

    const parsed = getOrParseDocument(textDocument);
    const defs = getAllDefinitions(parsed);
    const def = defs.find(d => d.name === wordInfo.word);
    if (!def) return [];

    // Find all occurrences of this word in the document
    const text = textDocument.getText();
    const lines = text.split(/\r?\n/);
    const locations: Location[] = [];
    const regex = new RegExp(`\\b${wordInfo.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');

    for (let i = 0; i < lines.length; i++) {
        // string-aware comment boundary (ignores '#' inside quoted strings), matching the parser
        const codeLength = stripComment(lines[i]).length;
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(lines[i])) !== null) {
            // Skip if this match falls inside a comment
            if (match.index >= codeLength) continue;

            // Include the definition if requested
            if (i === def.line && !params.context.includeDeclaration) continue;

            locations.push(Location.create(params.textDocument.uri, {
                start: { line: i, character: match.index },
                end: { line: i, character: match.index + wordInfo.word.length },
            }));
        }
    }

    return locations;
});

// ── Hover ───────────────────────────────────────────────────────────

connection.onHover((params: TextDocumentPositionParams): Hover | null => {
    const textDocument = documents.get(params.textDocument.uri);
    if (!textDocument) return null;

    const wordInfo = getWordAtPosition(textDocument, params.position.line, params.position.character);
    if (!wordInfo) return null;

    const parsed = getOrParseDocument(textDocument);
    const hoverRange = {
        start: { line: params.position.line, character: wordInfo.start },
        end: { line: params.position.line, character: wordInfo.end },
    };

    // Check if it's a defined symbol (parameter, molecule type, observable, function, compartment)
    const defs = getAllDefinitions(parsed);
    const def = defs.find(d => d.name === wordInfo.word);
    if (def) {
        return {
            contents: { kind: MarkupKind.Markdown, value: `**${def.kind}** \`${def.name}\`\n\n\`${def.detail}\`` },
            range: hoverRange,
        };
    }

    // Check if it's a built-in function
    const builtinDoc = BUILTIN_FUNCTION_DOCS[wordInfo.word];
    if (builtinDoc) {
        return { contents: { kind: MarkupKind.Markdown, value: builtinDoc }, range: hoverRange };
    }

    // Check if it's a rate law type
    const rateLawDoc = RATE_LAW_DOCS[wordInfo.word];
    if (rateLawDoc) {
        return { contents: { kind: MarkupKind.Markdown, value: rateLawDoc }, range: hoverRange };
    }

    // Check if it's an action name
    const actionDoc = ACTION_DOCS[wordInfo.word];
    if (actionDoc) {
        return {
            contents: { kind: MarkupKind.Markdown, value: `**action** \`${wordInfo.word}\`\n\n${actionDoc}` },
            range: hoverRange,
        };
    }

    // Check if it's a math constant
    const mathConst = MATH_CONSTANTS.find(c => c.name === wordInfo.word);
    if (mathConst) {
        return {
            contents: { kind: MarkupKind.Markdown, value: `**constant** \`${mathConst.name}\`\n\n${mathConst.detail}` },
            range: hoverRange,
        };
    }

    return null;
});

documents.listen(connection);
connection.listen();
