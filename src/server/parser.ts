/**
 * Lightweight line-by-line state machine parser for BNGL files.
 * Produces a structured AST without any vscode dependency.
 *
 * Language reference: BioNetGen source (bng2/Perl2/)
 * EBNF reference: docs/bngl-grammar.md
 */

// ── AST node types ──────────────────────────────────────────────────

export interface LocationRange {
    startLine: number;
    endLine: number;
}

export interface BnglParameter {
    name: string;
    value: string;
    line: number;
}

export interface MoleculeComponent {
    name: string;
    states: string[];  // e.g. ['u', 'p'] for s~u~p
}

export interface BnglMoleculeType {
    name: string;
    components: MoleculeComponent[];
    line: number;
}

export interface BnglSeedSpecies {
    pattern: string;
    count: string;
    line: number;
}

export interface BnglObservable {
    type: string;      // "Molecules", "Species", or "Counter"
    name: string;
    pattern: string;
    line: number;
}

export interface BnglFunction {
    name: string;
    args: string;      // raw arg string inside parens
    body: string;      // expression after =
    line: number;
}

export interface BnglRule {
    label: string;     // optional rule label (e.g. "_R3")
    reactants: string;
    products: string;
    rate: string;
    sourceText: string;
    line: number;
}

export interface BnglAction {
    name: string;
    args: string;
    line: number;
}

export interface BnglCompartment {
    name: string;
    dimensions: number;  // 2 (surface) or 3 (volume)
    size: string;
    outside: string;     // name of containing compartment, or empty
    line: number;
}

export interface BnglEnergyPattern {
    pattern: string;
    energy: string;
    line: number;
}

export interface BnglBlock {
    type: string;          // normalized block type (e.g. "parameters", "molecule types")
    rawType: string;       // original text after "begin "
    startLine: number;
    endLine: number;       // -1 if unclosed
    endRawType: string;    // original text after "end " (empty if unclosed)
}

export interface BnglDiagnostic {
    line: number;
    endLine?: number;
    startChar?: number;
    endChar?: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
}

export interface BnglDocument {
    blocks: BnglBlock[];
    parameters: BnglParameter[];
    moleculeTypes: BnglMoleculeType[];
    seedSpecies: BnglSeedSpecies[];
    observables: BnglObservable[];
    functions: BnglFunction[];
    rules: BnglRule[];
    actions: BnglAction[];
    compartments: BnglCompartment[];
    energyPatterns: BnglEnergyPattern[];
    diagnostics: BnglDiagnostic[];
}

// ── Normalization ───────────────────────────────────────────────────

// All valid block types recognized by BioNetGen (BNGModel.pm:241-256)
const BLOCK_ALIASES: Record<string, string> = {
    'rules': 'reaction rules',
    'molecules': 'molecule types',
    'species': 'seed species',
};

export function normalizeBlockType(raw: string): string {
    const cleaned = raw.trim().toLowerCase().split('#')[0].trim();
    return BLOCK_ALIASES[cleaned] ?? cleaned;
}

// ── Molecule type parsing ───────────────────────────────────────────

export function parseMoleculeTypeSignature(text: string): { name: string; components: MoleculeComponent[] } {
    // e.g. "A(b,s~u~p,l)" or "Xm()"
    const parenIdx = text.indexOf('(');
    if (parenIdx === -1) {
        return { name: text.trim(), components: [] };
    }
    const name = text.substring(0, parenIdx).trim();
    const closeIdx = text.lastIndexOf(')');
    const inner = text.substring(parenIdx + 1, closeIdx > parenIdx ? closeIdx : text.length).trim();
    if (!inner) {
        return { name, components: [] };
    }
    const components = inner.split(',').map(c => {
        const parts = c.trim().split('~');
        return {
            name: parts[0],
            states: parts.slice(1),
        };
    });
    return { name, components };
}

// ── Line continuation preprocessing ─────────────────────────────────

/**
 * Join lines ending with \ (line continuation character).
 * Returns an array where each entry is the logical line text,
 * plus a mapping from logical line index to physical line index.
 */
function preprocessLineContinuation(lines: string[]): { logicalLines: string[]; lineMap: number[] } {
    const logicalLines: string[] = [];
    const lineMap: number[] = [];
    let buffer = '';
    let startLine = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const stripped = line.replace(/\s+$/, '');
        if (stripped.endsWith('\\')) {
            if (buffer === '') startLine = i;
            buffer += stripped.slice(0, -1);
        } else {
            if (buffer !== '') {
                buffer += line;
                logicalLines.push(buffer);
                lineMap.push(startLine);
                buffer = '';
            } else {
                logicalLines.push(line);
                lineMap.push(i);
            }
        }
    }
    // If file ends with trailing backslash, flush the buffer
    if (buffer !== '') {
        logicalLines.push(buffer);
        lineMap.push(startLine);
    }

    return { logicalLines, lineMap };
}

// ── Main parser ─────────────────────────────────────────────────────

export function parseBnglDocument(text: string): BnglDocument {
    const rawLines = text.split(/\r?\n/);
    const { logicalLines, lineMap } = preprocessLineContinuation(rawLines);

    const doc: BnglDocument = {
        blocks: [],
        parameters: [],
        moleculeTypes: [],
        seedSpecies: [],
        observables: [],
        functions: [],
        rules: [],
        actions: [],
        compartments: [],
        energyPatterns: [],
        diagnostics: [],
    };

    const blockStack: { type: string; rawType: string; startLine: number }[] = [];

    for (let i = 0; i < logicalLines.length; i++) {
        const line = logicalLines[i];
        const physLine = lineMap[i];
        const trimmed = line.trimStart();

        // Skip blank lines and comments
        if (trimmed === '' || trimmed.startsWith('#')) {
            continue;
        }

        // begin block
        const beginMatch = trimmed.match(/^begin\s+(.+)/i);
        if (beginMatch) {
            const rawType = beginMatch[1].split('#')[0].trim();
            const type = normalizeBlockType(rawType);
            blockStack.push({ type, rawType, startLine: physLine });
            continue;
        }

        // end block
        const endMatch = trimmed.match(/^end\s+(.+)/i);
        if (endMatch) {
            const rawEndType = endMatch[1].split('#')[0].trim();
            const endType = normalizeBlockType(rawEndType);

            // Find matching begin on the stack (search from top)
            let matched = false;
            for (let j = blockStack.length - 1; j >= 0; j--) {
                if (blockStack[j].type === endType) {
                    const begin = blockStack.splice(j, 1)[0];
                    doc.blocks.push({
                        type: begin.type,
                        rawType: begin.rawType,
                        startLine: begin.startLine,
                        endLine: physLine,
                        endRawType: rawEndType,
                    });
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                doc.diagnostics.push({
                    line: physLine,
                    message: `Unmatched "end ${rawEndType}" — no corresponding "begin"`,
                    severity: 'error',
                });
            }
            continue;
        }

        // Parse content based on current block context
        const currentBlock = blockStack.length > 0 ? blockStack[blockStack.length - 1] : null;

        if (!currentBlock) {
            // Top-level: bare action calls (outside any block)
            // Per BNGL spec: Model = [{Option}], ({Block} | "begin model"...) , [{Action}]
            parseActionLine(trimmed, physLine, doc);
            continue;
        }

        switch (currentBlock.type) {
            case 'parameters':
                parseParameterLine(trimmed, physLine, doc);
                break;
            case 'molecule types':
                parseMoleculeTypeLine(trimmed, physLine, doc);
                break;
            case 'seed species':
                parseSeedSpeciesLine(trimmed, physLine, doc);
                break;
            case 'observables':
                parseObservableLine(trimmed, physLine, doc);
                break;
            case 'functions':
                parseFunctionLine(trimmed, physLine, doc);
                break;
            case 'reaction rules':
                parseRuleLine(trimmed, physLine, doc);
                break;
            case 'actions':
            case 'protocol':
                parseActionLine(trimmed, physLine, doc);
                break;
            case 'compartments':
                parseCompartmentLine(trimmed, physLine, doc);
                break;
            case 'energy patterns':
                parseEnergyPatternLine(trimmed, physLine, doc);
                break;
            // reactions, groups, population types, population maps — recognized but not parsed in detail
        }
    }

    // Any remaining items on the stack are unclosed blocks
    for (const unclosed of blockStack) {
        doc.blocks.push({
            type: unclosed.type,
            rawType: unclosed.rawType,
            startLine: unclosed.startLine,
            endLine: -1,
            endRawType: '',
        });
        doc.diagnostics.push({
            line: unclosed.startLine,
            message: `Unclosed "begin ${unclosed.rawType}" — no corresponding "end"`,
            severity: 'error',
        });
    }

    validateDocument(doc);
    return doc;
}

// ── Validation (runs after parsing) ─────────────────────────────────

function validateDocument(doc: BnglDocument): void {
    checkDuplicates(doc.parameters, 'Parameter', doc);
    checkDuplicates(doc.moleculeTypes, 'Molecule type', doc);
    checkDuplicates(doc.observables, 'Observable', doc);
    checkDuplicates(doc.functions, 'Function', doc);
    checkEmptyBlocks(doc);
    checkUnusedParameters(doc);
}

function checkDuplicates(items: { name: string; line: number }[], label: string, doc: BnglDocument): void {
    const seen = new Map<string, number>();
    for (const item of items) {
        const prev = seen.get(item.name);
        if (prev !== undefined) {
            doc.diagnostics.push({
                line: item.line,
                message: `Duplicate ${label.toLowerCase()} "${item.name}" (first defined on line ${prev + 1})`,
                severity: 'error',
            });
        } else {
            seen.set(item.name, item.line);
        }
    }
}

function checkEmptyBlocks(doc: BnglDocument): void {
    // A block with endLine - startLine <= 1 has no content lines
    for (const block of doc.blocks) {
        if (block.endLine === -1) continue; // unclosed, already reported
        if (block.type === 'model') continue; // model is a wrapper
        if (block.endLine - block.startLine <= 1) {
            doc.diagnostics.push({
                line: block.startLine,
                message: `Empty "${block.rawType}" block`,
                severity: 'warning',
            });
        }
    }
}

function checkUnusedParameters(doc: BnglDocument): void {
    // Collect all text where parameters could be referenced
    const referenceTexts: string[] = [];
    for (const p of doc.parameters) referenceTexts.push(p.value);
    for (const f of doc.functions) referenceTexts.push(f.body);
    for (const r of doc.rules) referenceTexts.push(r.reactants, r.products, r.rate);
    for (const s of doc.seedSpecies) referenceTexts.push(s.count);
    for (const o of doc.observables) referenceTexts.push(o.pattern);
    for (const a of doc.actions) referenceTexts.push(a.args);
    for (const c of doc.compartments) referenceTexts.push(c.size);
    // include the pattern as well as the energy: a multi-token energy expression leaves the
    // parameter in the pattern half (the parser splits energy off at the last whitespace)
    for (const ep of doc.energyPatterns) referenceTexts.push(ep.pattern, ep.energy);
    const allRefs = referenceTexts.join(' ');

    for (const param of doc.parameters) {
        // Use word boundary check to avoid false matches (e.g. "k1" matching "k10")
        const regex = new RegExp(`\\b${param.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        if (!regex.test(allRefs)) {
            doc.diagnostics.push({
                line: param.line,
                message: `Parameter "${param.name}" is defined but never referenced`,
                severity: 'warning',
            });
        }
    }
}

// ── Line parsers for each block type ────────────────────────────────

export function stripComment(line: string): string {
    // Strip # comments, respecting double-quoted strings
    let inString = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            inString = !inString;
        } else if (line[i] === '#' && !inString) {
            return line.substring(0, i);
        }
    }
    return line;
}

/** Strip optional line label: "1 " (number + whitespace) or "name:" */
function stripLineLabel(content: string): { label: string; rest: string } {
    // Numeric label: "1  content"
    const numMatch = content.match(/^(\d+)\s+(.+)/);
    if (numMatch) {
        return { label: numMatch[1], rest: numMatch[2] };
    }
    // Named label: "name: content"
    const nameMatch = content.match(/^(\w+):\s*(.*)/);
    if (nameMatch) {
        return { label: nameMatch[1], rest: nameMatch[2] };
    }
    return { label: '', rest: content };
}

function parseParameterLine(trimmed: string, line: number, doc: BnglDocument): void {
    const content = stripComment(trimmed).trim();
    if (!content) return;
    // Parameter lines: [label] name  value  or  name=value
    const { rest } = stripLineLabel(content);
    const match = rest.match(/^(\w+)\s*=?\s*(.+)/);
    if (match) {
        doc.parameters.push({
            name: match[1],
            value: match[2].trim(),
            line,
        });
    }
}

function parseMoleculeTypeLine(trimmed: string, line: number, doc: BnglDocument): void {
    const content = stripComment(trimmed).trim();
    if (!content) return;
    const { rest } = stripLineLabel(content);
    const { name, components } = parseMoleculeTypeSignature(rest);
    doc.moleculeTypes.push({ name, components, line });
}

function parseSeedSpeciesLine(trimmed: string, line: number, doc: BnglDocument): void {
    const content = stripComment(trimmed).trim();
    if (!content) return;
    const { rest } = stripLineLabel(content);
    // Seed species: [$ modifier] pattern  count
    const cleaned = rest.replace(/^\$\s*/, '');
    // The pattern can contain parens/dots/etc. Count is the last token.
    const lastSpace = cleaned.lastIndexOf(' ');
    const lastTab = cleaned.lastIndexOf('\t');
    const sep = Math.max(lastSpace, lastTab);
    if (sep > 0) {
        doc.seedSpecies.push({
            pattern: cleaned.substring(0, sep).trim(),
            count: cleaned.substring(sep).trim(),
            line,
        });
    }
}

function parseObservableLine(trimmed: string, line: number, doc: BnglDocument): void {
    const content = stripComment(trimmed).trim();
    if (!content) return;
    const { rest } = stripLineLabel(content);
    // Observable: Type  Name  Pattern(s)
    // Types: Molecules, Species, Counter (from Observable.pm)
    const match = rest.match(/^(Molecules|Species|Counter)\s+(\w+)\s+(.+)/i);
    if (match) {
        doc.observables.push({
            type: match[1],
            name: match[2],
            pattern: match[3].trim(),
            line,
        });
    }
}

function parseFunctionLine(trimmed: string, line: number, doc: BnglDocument): void {
    const content = stripComment(trimmed).trim();
    if (!content) return;
    const { rest } = stripLineLabel(content);
    // Function: name(args) = expression  OR  name = expression (parameterized)
    const match = rest.match(/^(\w+)\(([^)]*)\)\s*=\s*(.+)/);
    if (match) {
        doc.functions.push({
            name: match[1],
            args: match[2].trim(),
            body: match[3].trim(),
            line,
        });
        return;
    }
    // Alternate form without parens: name = expression
    const altMatch = rest.match(/^(\w+)\s*=\s*(.+)/);
    if (altMatch) {
        doc.functions.push({
            name: altMatch[1],
            args: '',
            body: altMatch[2].trim(),
            line,
        });
    }
}

// BNGL keywords that can appear after the rate in a reaction rule
// From RxnRule.pm: DeleteMolecules, MoveConnected, TotalRate, priority,
// exclude_reactants, include_reactants, exclude_products, include_products
const RULE_KEYWORDS = new Set([
    'DeleteMolecules', 'MoveConnected', 'TotalRate',
    'exclude_reactants', 'include_reactants',
    'exclude_products', 'include_products',
]);

function parseRuleLine(trimmed: string, line: number, doc: BnglDocument): void {
    const sourceText = stripComment(trimmed).trim();
    let content = sourceText;
    if (!content) return;

    // Strip optional rule label (e.g. "_R3:" or "rule1:")
    // Only strip colon-style labels — numeric labels are ambiguous with "0" (null species)
    let label = '';
    const labelMatch = content.match(/^(\w+):\s*(.*)/);
    if (labelMatch) {
        label = labelMatch[1];
        content = labelMatch[2];
    }

    // Reaction rule: reactants -> products  rate  [keywords]
    // Also supports bidirectional: reactants <-> products  rate1, rate2
    const arrowMatch = content.match(/^(.+?)\s*(->|<->)\s*(.+)/);
    if (arrowMatch) {
        const after = arrowMatch[3].trim();
        const parts = after.split(/\s+/);

        // Strip trailing BNGL keywords (DeleteMolecules, MoveConnected, etc.)
        // Keywords may have parenthesized args like exclude_reactants(1,A())
        // Also strip priority=<value>
        while (parts.length > 1) {
            const last = parts[parts.length - 1];
            const baseName = last.replace(/\(.*\)$/, '');
            if (RULE_KEYWORDS.has(baseName) || /^priority\s*=/.test(last)) {
                parts.pop();
            } else {
                break;
            }
        }

        if (parts.length >= 2) {
            // Heuristic: rate is the last whitespace-delimited token, so a multi-token rate
            // expression (e.g. "k1 * 2") leaves its leading tokens in `products`. This is fine
            // for the unused-parameter scan, which scans reactants + products + rate together;
            // do not rely on `rate` alone as a precise rate expression.
            const rate = parts[parts.length - 1];
            const products = parts.slice(0, -1).join(' ');
            doc.rules.push({ label, reactants: arrowMatch[1].trim(), products, rate, sourceText, line });
        } else {
            doc.rules.push({ label, reactants: arrowMatch[1].trim(), products: after, rate: '', sourceText, line });
        }
    }
}

function parseActionLine(trimmed: string, line: number, doc: BnglDocument): void {
    const content = stripComment(trimmed).trim();
    if (!content) return;
    // Action: name({args}) or name(args) with optional trailing semicolon
    const match = content.match(/^(\w+)\((.*)\)\s*;?\s*$/);
    if (match) {
        doc.actions.push({
            name: match[1],
            args: match[2]?.trim() ?? '',
            line,
        });
    }
}

function parseCompartmentLine(trimmed: string, line: number, doc: BnglDocument): void {
    const content = stripComment(trimmed).trim();
    if (!content) return;
    const { rest } = stripLineLabel(content);
    // Compartment: Name  Dimensions(2|3)  Size  [OutsideName]
    const match = rest.match(/^(\w+)\s+(2|3)\s+(\S+)(?:\s+(\w+))?/);
    if (match) {
        doc.compartments.push({
            name: match[1],
            dimensions: parseInt(match[2]),
            size: match[3],
            outside: match[4] ?? '',
            line,
        });
    }
}

function parseEnergyPatternLine(trimmed: string, line: number, doc: BnglDocument): void {
    const content = stripComment(trimmed).trim();
    if (!content) return;
    const { rest } = stripLineLabel(content);
    // Energy pattern: Pattern  EnergyExpression
    // The pattern ends at the last whitespace before the energy value
    const lastSpace = rest.lastIndexOf(' ');
    const lastTab = rest.lastIndexOf('\t');
    const sep = Math.max(lastSpace, lastTab);
    if (sep > 0) {
        doc.energyPatterns.push({
            pattern: rest.substring(0, sep).trim(),
            energy: rest.substring(sep).trim(),
            line,
        });
    }
}
