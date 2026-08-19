/**
 * Generate and audit the Markdown narrative manifest.
 *
 * Canonical inputs:
 *   - data/minerals.json supplies the mineral registry and stable ordering.
 *   - narratives/*.md supplies the set of Markdown-backed narrators.
 *
 * The generated TypeScript file is consumed before js/05-narratives.ts.  The
 * audit also rejects stale inline `|| fallback` prose wherever a narrator has
 * already delegated its prose to narrative_blurb/variant/closing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const THIS_FILE = fileURLToPath(import.meta.url);
const ROOT = path.dirname(path.dirname(THIS_FILE));
const DATA_PATH = path.join(ROOT, 'data', 'minerals.json');
const NARRATIVE_DIR = path.join(ROOT, 'narratives');
const JS_DIR = path.join(ROOT, 'js');
const GENERATED_PATH = path.join(JS_DIR, '04-narrative-manifest.generated.ts');
const NARRATIVE_FUNCTIONS = new Set([
  'narrative_blurb',
  'narrative_closing',
  'narrative_variant',
]);

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n');
}

function parseNarrative(id, filename, text, errors) {
  const normalized = normalizeNewlines(text);
  const frontmatter = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!frontmatter) {
    errors.push(`${filename}: missing YAML frontmatter`);
  } else {
    const species = frontmatter[1].match(/^(?:species|mineral):\s*(.+?)\s*$/m)?.[1];
    if (species !== id) {
      errors.push(`${filename}: frontmatter species must be "${id}", found ${JSON.stringify(species)}`);
    }
  }

  const sections = new Map();
  const headings = Array.from(normalized.matchAll(/^## ([^\n]+)\s*$/gm));
  for (let index = 0; index < headings.length; index += 1) {
    const match = headings[index];
    const heading = match[1].trim();
    const bodyStart = match.index + match[0].length;
    const bodyEnd = index + 1 < headings.length ? headings[index + 1].index : normalized.length;
    const body = normalized.slice(bodyStart, bodyEnd).trim();
    if (sections.has(heading)) errors.push(`${filename}: duplicate section "${heading}"`);
    if (!body) errors.push(`${filename}: empty section "${heading}"`);
    sections.set(heading, body);
  }
  if (!sections.size) errors.push(`${filename}: no level-two narrative sections found`);
  return { id, filename, sections };
}

function stringLiteralValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function narrativeCallName(node) {
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return null;
  return NARRATIVE_FUNCTIONS.has(node.expression.text) ? node.expression.text : null;
}

function containsNarrativeCall(node) {
  if (narrativeCallName(node)) return true;
  let found = false;
  ts.forEachChild(node, child => {
    if (!found && containsNarrativeCall(child)) found = true;
  });
  return found;
}

function containsNarrativeResult(node, derivedIdentifiers) {
  if (narrativeCallName(node)) return true;
  if (ts.isIdentifier(node) && derivedIdentifiers.has(node.text)) return true;
  let found = false;
  ts.forEachChild(node, child => {
    if (!found && containsNarrativeResult(child, derivedIdentifiers)) found = true;
  });
  return found;
}

function containsInlineProse(node) {
  if (
    ts.isStringLiteral(node)
    || ts.isNoSubstitutionTemplateLiteral(node)
    || ts.isTemplateExpression(node)
  ) return true;
  let found = false;
  ts.forEachChild(node, child => {
    if (!found && containsInlineProse(child)) found = true;
  });
  return found;
}

function narrativeDerivedIdentifiers(sourceFile) {
  const derived = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    function visit(node) {
      let identifier = null;
      let value = null;
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        identifier = node.name.text;
        value = node.initializer;
      } else if (
        ts.isBinaryExpression(node)
        && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isIdentifier(node.left)
      ) {
        identifier = node.left.text;
        value = node.right;
      }
      if (
        identifier
        && !derived.has(identifier)
        && containsNarrativeResult(value, derived)
      ) {
        derived.add(identifier);
        changed = true;
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
  return derived;
}

function sourceLocation(sourceFile, node) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const displayName = path.isAbsolute(sourceFile.fileName)
    ? path.relative(ROOT, sourceFile.fileName)
    : sourceFile.fileName;
  return `${displayName.replace(/\\/g, '/')}:${line + 1}:${character + 1}`;
}

function auditNarratorSyntaxSource(sourceFile) {
  const derivedIdentifiers = narrativeDerivedIdentifiers(sourceFile);
  const inlineFallbacks = [];
  const dynamicVariants = [];

  function visit(node) {
    if (narrativeCallName(node) === 'narrative_variant' && stringLiteralValue(node.arguments[1]) === null) {
      dynamicVariants.push(
        `${sourceLocation(sourceFile, node)}: narrative_variant key must be a string literal; use exhaustive literal branches`,
      );
    }
    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.BarBarToken
      && containsNarrativeResult(node.left, derivedIdentifiers)
    ) {
      inlineFallbacks.push(
        `${sourceLocation(sourceFile, node)}: stale inline fallback after Markdown narrative result`,
      );
    }
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && /fallback/i.test(node.name.text)
      && node.initializer
      && containsInlineProse(node.initializer)
    ) {
      inlineFallbacks.push(
        `${sourceLocation(sourceFile, node)}: stale named inline fallback prose`,
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return { inlineFallbacks, dynamicVariants };
}

export function auditNarratorSourceText(sourceText, filename = 'fixture.ts') {
  const sourceFile = ts.createSourceFile(
    filename,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  return auditNarratorSyntaxSource(sourceFile);
}

function auditNarratorSources(documents, errors) {
  const referenced = new Set();
  let dynamicVariantCount = 0;
  let callCount = 0;
  let fallbackCount = 0;
  const files = fs.readdirSync(JS_DIR)
    .filter(name => /^92.*\.ts$/.test(name))
    .sort();

  for (const name of files) {
    const filename = path.join(JS_DIR, name);
    const sourceText = fs.readFileSync(filename, 'utf8');
    const sourceFile = ts.createSourceFile(filename, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const syntaxAudit = auditNarratorSyntaxSource(sourceFile);
    fallbackCount += syntaxAudit.inlineFallbacks.length;
    dynamicVariantCount += syntaxAudit.dynamicVariants.length;
    errors.push(...syntaxAudit.inlineFallbacks, ...syntaxAudit.dynamicVariants);

    function visit(node) {
      const callName = narrativeCallName(node);
      if (callName) {
        callCount += 1;
        const species = stringLiteralValue(node.arguments[0]);
        const loc = sourceLocation(sourceFile, node);
        if (!species) {
          errors.push(`${loc}: ${callName} species must be a string literal`);
        } else if (!documents.has(species)) {
          errors.push(`${loc}: ${callName} references missing narratives/${species}.md`);
        } else {
          referenced.add(species);
          let section = callName === 'narrative_blurb' ? 'blurb' : 'closing';
          if (callName === 'narrative_variant') {
            const variant = stringLiteralValue(node.arguments[1]);
            if (variant === null) {
              section = null;
            } else {
              section = `variant: ${variant}`;
            }
          }
          if (section && !documents.get(species).sections.has(section)) {
            errors.push(`${loc}: narratives/${species}.md is missing section "${section}"`);
          }
        }
      }

      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }

  for (const id of documents.keys()) {
    if (!referenced.has(id)) errors.push(`narratives/${id}.md is never referenced by a narrator`);
  }
  return { callCount, fallbackCount, dynamicVariantCount };
}

function renderManifest(ids) {
  const entries = ids.map(id => `  ${JSON.stringify(id)},`).join('\n');
  return `// AUTO-GENERATED by tools/narrative-workflow.mjs. DO NOT EDIT.\n`
    + `// Inputs: data/minerals.json + narratives/*.md\n\n`
    + `const _NARRATIVE_MANIFEST = Object.freeze([\n${entries}\n]);\n`;
}

function main() {
  const check = process.argv.includes('--check');
  const errors = [];
  const mineralDoc = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const minerals = mineralDoc.minerals || {};
  const narrativeFiles = fs.readdirSync(NARRATIVE_DIR)
    .filter(name => name.endsWith('.md'))
    .sort();
  const documents = new Map();

  for (const filename of narrativeFiles) {
    const id = filename.slice(0, -3);
    if (!Object.prototype.hasOwnProperty.call(minerals, id)) {
      errors.push(`narratives/${filename}: species is absent from data/minerals.json`);
    }
    const doc = parseNarrative(
      id,
      `narratives/${filename}`,
      fs.readFileSync(path.join(NARRATIVE_DIR, filename), 'utf8'),
      errors,
    );
    documents.set(id, doc);
  }

  const manifest = Object.keys(minerals).filter(id => documents.has(id));
  for (const id of documents.keys()) {
    if (!manifest.includes(id)) errors.push(`narratives/${id}.md could not be placed in the mineral-order manifest`);
  }

  const sourceAudit = auditNarratorSources(documents, errors);
  const expected = renderManifest(manifest);
  const actual = fs.existsSync(GENERATED_PATH)
    ? normalizeNewlines(fs.readFileSync(GENERATED_PATH, 'utf8'))
    : '';

  if (check) {
    if (actual !== expected) {
      errors.push('js/04-narrative-manifest.generated.ts is stale; run npm run gen:narratives');
    }
  } else if (actual !== expected) {
    fs.writeFileSync(GENERATED_PATH, expected, 'utf8');
    console.log(`[narratives] wrote ${path.relative(ROOT, GENERATED_PATH)} (${manifest.length} species)`);
  }

  if (errors.length) {
    console.error(`[narratives] FAIL (${errors.length} issue${errors.length === 1 ? '' : 's'})`);
    for (const error of errors) console.error(`  - ${error}`);
    return 1;
  }

  console.log(
    `[narratives] PASS: ${manifest.length} files, ${sourceAudit.callCount} statically validated calls, `
      + `${sourceAudit.dynamicVariantCount} dynamic variants, 0 inline fallbacks`,
  );
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(THIS_FILE)) {
  process.exitCode = main();
}
