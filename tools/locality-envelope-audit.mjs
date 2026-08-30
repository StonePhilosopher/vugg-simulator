/**
 * Fast locality/species-contract audit over the canonical archived claim cards.
 *
 * This intentionally does not re-run simulations. build:check and the claim-card
 * tests prove that the committed cards match the current scenario definitions and
 * deterministic seed-42 strips; this command turns those receipts into a cheap
 * science gate that can run on every local CI pass.
 *
 * Usage:
 *   node tools/locality-envelope-audit.mjs [--version N] [--scenario ID] [--check]
 *
 * Report mode exits zero and inventories unresolved contracts. --check exits
 * non-zero if any product is unclassified or any authored contract is violated.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { policyOfReceipt, sha256File } from './hash-policy.mjs';
import { fileURLToPath } from 'node:url';
import {
  LOCALITY_FREQUENCY_SEEDS,
  validateFrequencyScenarioReceipt,
} from './locality-frequency-contract.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function values(entries) {
  return (Array.isArray(entries) ? entries : []).map((entry) => (
    typeof entry === 'string'
      ? { mineral: entry, reason: null }
      : { ...entry, mineral: String(entry?.mineral || ''), reason: entry?.reason || null }
  )).filter((entry) => entry.mineral);
}

function duplicateValues(items) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of items) {
    if (seen.has(item)) duplicates.add(item);
    seen.add(item);
  }
  return [...duplicates].sort();
}

function intersection(a, b) {
  return [...a].filter((value) => b.has(value)).sort();
}

const DETERMINISTIC_RATIONALE_CONTRADICTIONS = [
  [/(?:^|\W)non[- ]deterministic(?:\W|$)/i, 'non-deterministic'],
  [/(?:^|\W)statistical(?:ly)?(?:\W|$)/i, 'statistical'],
  [/(?:^|\W)not\s+(?:a\s+)?(?:defining\s+)?deterministic(?:\W|$)/i, 'not deterministic'],
  [/(?:^|\W)not\s+guaranteed(?:\W|$)/i, 'not guaranteed'],
  [/(?:^|\W)not\s+required\s+in\s+every(?:\W|$)/i, 'not required in every'],
];

export function deterministicRationaleContradiction(reason) {
  const text = String(reason || '');
  const match = DETERMINISTIC_RATIONALE_CONTRADICTIONS.find(([pattern]) => pattern.test(text));
  return match ? match[1] : null;
}

export function auditCard(card, manifestScenario, {
  frequencyScenario = null,
  frequencySeeds = LOCALITY_FREQUENCY_SEEDS,
  actualStripSha256 = null,
  // The rule each artifact says it was made under. This audit compares a card's
  // published strip digest with the manifest's, so if the two were baked under
  // different rules the comparison is meaningless — and silently red — rather
  // than informative. Absent means the historical raw rule, never the current
  // one (tools/hash-policy.mjs).
  cardPolicy = null,
  manifestPolicy = null,
} = {}) {
  const errors = [];
  const warnings = [];
  const scenario = String(card?.scenario || manifestScenario?.id || '(unknown)');
  const fail = (message) => errors.push(`${scenario}: ${message}`);
  const warn = (message) => warnings.push(`${scenario}: ${message}`);

  if (!card || typeof card !== 'object') {
    fail('claim card is missing or malformed');
    return { scenario, errors, warnings, unresolved: [] };
  }
  if (!manifestScenario || typeof manifestScenario !== 'object') {
    fail('science-manifest scenario receipt is missing');
  } else {
    if (card.sim_version !== manifestScenario.archive?.sim_version) fail('SIM version differs from science manifest');
    if (card.model_digest !== manifestScenario.archive?.model_digest) fail('model digest differs from science manifest');
    if (card.scenario_spec_hash !== manifestScenario.scenario_spec_hash) fail('scenario spec hash differs from science manifest');
    if (card.scenario !== manifestScenario.id) fail(`scenario identity differs from science manifest (${manifestScenario.id})`);
    const manifestStripSha = manifestScenario.archive?.strip_sha256;
    if (!manifestStripSha || !/^[a-f0-9]{64}$/.test(manifestStripSha)) fail('science manifest lacks a valid strip SHA-256');
    // INSTEAD OF, not in addition to. Two hashes of the same file under two
    // rules are simply different numbers, so once the rules disagree the digest
    // comparisons below are not merely noisy — they are unanswerable, and
    // emitting them would send the next reader hunting for content drift that
    // does not exist. An earlier version reported the disagreement AND both
    // drift errors, which made this comment a claim rather than a behaviour;
    // the test now asserts the absence, not only the presence.
    //
    // Nothing passes silently: the disagreement is itself an error, so the
    // fleet audit still fails and the digests are re-checked once the rules
    // agree again.
    const policiesAgree = !cardPolicy || !manifestPolicy || cardPolicy === manifestPolicy;
    if (!policiesAgree) {
      fail(`claim card hash policy ${cardPolicy} differs from science manifest ${manifestPolicy}`
        + ' — strip digests are not comparable until they agree');
    } else {
      if (card.strip_sha256 !== manifestStripSha) fail('claim-card strip digest differs from science manifest');
      if (actualStripSha256 !== manifestStripSha) fail('archived strip bytes differ from pinned SHA-256');
    }
    if (frequencyScenario?.locality_frequency_spec_hash !== manifestScenario.locality_frequency_spec_hash) {
      fail('multi-seed frequency receipt differs from current behavioral scenario contract');
    }
  }

  const contract = card.claim?.expectation_contract || {};
  const deterministic = values(contract.deterministic);
  const statistical = values(contract.statistical);
  const aspirational = values(contract.aspirational);
  const exclusions = new Set(Object.keys(card.claim?.excluded_species || {}));
  const deterministicSet = new Set(deterministic.map((entry) => entry.mineral));
  const statisticalSet = new Set(statistical.map((entry) => entry.mineral));
  const aspirationalSet = new Set(aspirational.map((entry) => entry.mineral));

  for (const [tier, entries] of Object.entries({ deterministic, statistical, aspirational })) {
    const duplicates = duplicateValues(entries.map((entry) => entry.mineral));
    if (duplicates.length) fail(`${tier} tier repeats ${duplicates.join(', ')}`);
  }
  for (const [label, overlap] of [
    ['deterministic/statistical', intersection(deterministicSet, statisticalSet)],
    ['deterministic/aspirational', intersection(deterministicSet, aspirationalSet)],
    ['statistical/aspirational', intersection(statisticalSet, aspirationalSet)],
    ['deterministic/excluded', intersection(deterministicSet, exclusions)],
    ['statistical/excluded', intersection(statisticalSet, exclusions)],
    ['aspirational/excluded', intersection(aspirationalSet, exclusions)],
  ]) {
    if (overlap.length) fail(`${label} tiers overlap at ${overlap.join(', ')}`);
  }

  for (const [tier, entries] of Object.entries({ deterministic, statistical, aspirational })) {
    for (const entry of entries) {
      if (!entry.reason || !String(entry.reason).trim()) fail(`${tier} ${entry.mineral} lacks a geological rationale`);
      if (tier === 'deterministic') {
        const contradiction = deterministicRationaleContradiction(entry.reason);
        if (contradiction) {
          fail(`deterministic ${entry.mineral} rationale contradicts its evidence tier (${contradiction})`);
        }
      }
      for (const key of ['first_step_min', 'first_step_max']) {
        if (entry[key] != null && (!Number.isInteger(entry[key]) || entry[key] < 1)) {
          fail(`${tier} ${entry.mineral} has invalid ${key}=${entry[key]}`);
        }
      }
      if (entry.first_step_min != null && entry.first_step_max != null
          && entry.first_step_min > entry.first_step_max) {
        fail(`${tier} ${entry.mineral} has an inverted first-appearance window`);
      }
    }
  }
  for (const [mineral, reason] of Object.entries(card.claim?.excluded_species || {})) {
    if (!String(reason || '').trim()) fail(`excluded ${mineral} lacks a negative-evidence rationale`);
  }

  const paragenesis = Array.isArray(card.testimony?.paragenetic_order)
    ? card.testimony.paragenetic_order
    : [];
  const present = new Map(paragenesis.map((entry) => [entry.mineral, entry]));
  const unresolvedCanonical = [...present.keys()]
    .filter((mineral) => !deterministicSet.has(mineral)
      && !statisticalSet.has(mineral)
      && !aspirationalSet.has(mineral)
      && !exclusions.has(mineral))
    .sort();
  const aspirationalAppearances = [...present.keys()].filter((mineral) => aspirationalSet.has(mineral)).sort();
  const excludedAppearances = [...present.keys()].filter((mineral) => exclusions.has(mineral)).sort();
  const deterministicNoShows = [...deterministicSet].filter((mineral) => !present.has(mineral)).sort();

  if (unresolvedCanonical.length) warn(`unclassified archived products: ${unresolvedCanonical.join(', ')}`);
  if (aspirationalAppearances.length) fail(`aspirational products appeared and must be promoted or corrected: ${aspirationalAppearances.join(', ')}`);
  if (excludedAppearances.length) fail(`negative-evidence exclusions appeared: ${excludedAppearances.join(', ')}`);
  if (deterministicNoShows.length) fail(`deterministic no-shows: ${deterministicNoShows.join(', ')}`);

  for (const entry of [...deterministic, ...statistical]) {
    const appearance = present.get(entry.mineral);
    if (!appearance) continue;
    if (entry.first_step_min != null && appearance.first_step < entry.first_step_min) {
      fail(`${entry.mineral} appeared at step ${appearance.first_step}, before authored minimum ${entry.first_step_min}`);
    }
    if (entry.first_step_max != null && appearance.first_step > entry.first_step_max) {
      fail(`${entry.mineral} appeared at step ${appearance.first_step}, after authored maximum ${entry.first_step_max}`);
    }
  }

  const cardSurprises = [...(card.testimony?.surprises_not_in_expects || [])].sort();
  const authoredSurprises = [...unresolvedCanonical].sort();
  if (JSON.stringify(cardSurprises) !== JSON.stringify(authoredSurprises)) {
    fail('claim-card surprise testimony does not match the expectation tiers');
  }
  const cardExcluded = [...(card.testimony?.excluded_species_appearances || [])].sort();
  if (JSON.stringify(cardExcluded) !== JSON.stringify(excludedAppearances)) {
    fail('claim-card exclusion testimony does not match the authored negative evidence');
  }

  const panelSize = Array.isArray(frequencySeeds) ? frequencySeeds.length : 0;
  let occurrences = null;
  const unresolvedPanel = [];
  if (!frequencyScenario || typeof frequencyScenario !== 'object') {
    fail('multi-seed locality-frequency receipt is missing or malformed');
  } else if (panelSize < 2) {
    fail('multi-seed locality-frequency panel has fewer than two seeds');
  } else {
    const receiptValidation = validateFrequencyScenarioReceipt(frequencyScenario, frequencySeeds);
    for (const error of receiptValidation.errors) fail(`multi-seed locality-frequency ${error}`);
    occurrences = receiptValidation.occurrences;
    for (const [mineral, occurrence] of Object.entries(occurrences)) {
      const count = Number(occurrence?.count);
      if (!Number.isInteger(count) || count < 1 || count > panelSize) {
        fail(`multi-seed occurrence count for ${mineral} is invalid (${occurrence?.count})`);
        continue;
      }
      if (!deterministicSet.has(mineral) && !statisticalSet.has(mineral)
          && !aspirationalSet.has(mineral) && !exclusions.has(mineral)) {
        unresolvedPanel.push(mineral);
      }
      if (exclusions.has(mineral)) fail(`negative-evidence exclusion appeared in seed panel: ${mineral}`);
    }

    for (const entry of statistical) {
      const occurrence = occurrences[entry.mineral];
      const count = Number(occurrence?.count || 0);
      if (count === 0) {
        fail(`statistical ${entry.mineral} appeared in 0/${panelSize} seeds; classify it as aspirational`);
      } else if (count === panelSize) {
        fail(`statistical ${entry.mineral} appeared in ${count}/${panelSize} seeds; promote it to deterministic`);
      }
      for (const firstStep of Object.values(occurrence?.first_steps || {}).map(Number)) {
        if (entry.first_step_min != null && firstStep < entry.first_step_min) {
          fail(`${entry.mineral} appeared at step ${firstStep} in the seed panel, before authored minimum ${entry.first_step_min}`);
        }
        if (entry.first_step_max != null && firstStep > entry.first_step_max) {
          fail(`${entry.mineral} appeared at step ${firstStep} in the seed panel, after authored maximum ${entry.first_step_max}`);
        }
      }
    }
    for (const entry of deterministic) {
      const occurrence = occurrences[entry.mineral];
      const count = Number(occurrence?.count || 0);
      if (count !== panelSize) {
        fail(`deterministic ${entry.mineral} appeared in ${count}/${panelSize} seeds; classify it as statistical or correct the model`);
      }
      for (const firstStep of Object.values(occurrence?.first_steps || {}).map(Number)) {
        if (entry.first_step_min != null && firstStep < entry.first_step_min) {
          fail(`${entry.mineral} appeared at step ${firstStep} in the seed panel, before authored minimum ${entry.first_step_min}`);
        }
        if (entry.first_step_max != null && firstStep > entry.first_step_max) {
          fail(`${entry.mineral} appeared at step ${firstStep} in the seed panel, after authored maximum ${entry.first_step_max}`);
        }
      }
    }
    for (const entry of aspirational) {
      const count = Number(occurrences[entry.mineral]?.count || 0);
      if (count > 0) {
        fail(`aspirational ${entry.mineral} appeared in ${count}/${panelSize} seeds; promote it to statistical or deterministic`);
      }
    }
  }
  unresolvedPanel.sort();
  if (unresolvedPanel.length) warn(`unclassified multi-seed products: ${unresolvedPanel.join(', ')}`);
  const unresolved = [...new Set([...unresolvedCanonical, ...unresolvedPanel])].sort();

  return { scenario, errors, warnings, unresolved };
}

function parseArgs(argv) {
  const result = { check: false, version: null, scenarios: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') result.check = true;
    else if (arg === '--version') result.version = Number(argv[++i]);
    else if (arg === '--scenario') result.scenarios.push(...String(argv[++i] || '').split(',').filter(Boolean));
    else if (arg === '--help') result.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return result;
}

export function auditFleet({ root = ROOT, version = null, scenarios = [] } = {}) {
  const manifestPath = path.join(root, 'data', 'generated', 'science-provenance-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const selectedVersion = version ?? manifest.sim_version;
  if (!Number.isInteger(selectedVersion) || selectedVersion <= 0) throw new Error(`invalid version ${selectedVersion}`);
  if (selectedVersion !== manifest.sim_version) {
    throw new Error(`v${selectedVersion} is not the current science manifest v${manifest.sim_version}`);
  }
  const manifestById = new Map((manifest.scenarios || []).map((entry) => [entry.id, entry]));
  const frequencyPath = path.join(root, 'tests-js', 'baselines', `locality_frequency_v${selectedVersion}.json`);
  if (!fs.existsSync(frequencyPath)) throw new Error(`missing multi-seed frequency receipt: ${path.relative(root, frequencyPath)}`);
  const frequency = JSON.parse(fs.readFileSync(frequencyPath, 'utf8'));
  // Verified under the MANIFEST's declared rule, because it is the manifest's
  // number being checked. A manifest that declares none is historical and means
  // raw bytes — never today's rule.
  const manifestPolicy = policyOfReceipt(manifest);
  const manifestFrequency = manifest.locality_frequency;
  const actualFrequencySha256 = sha256File(frequencyPath, manifestPolicy);
  if (!manifestFrequency || manifestFrequency.path !== path.relative(root, frequencyPath).replaceAll('\\', '/')) {
    throw new Error('science manifest does not identify the current locality-frequency receipt');
  }
  if (manifestFrequency.sha256 !== actualFrequencySha256) {
    throw new Error('multi-seed locality-frequency receipt bytes differ from science-manifest SHA-256');
  }
  if (frequency.schema !== 'vugg-locality-frequency-baseline-v1') throw new Error(`unexpected locality-frequency schema ${frequency.schema}`);
  if (frequency.sim_version !== selectedVersion) throw new Error('locality-frequency SIM version is stale');
  if (frequency.model_digest !== manifest.model_digest) throw new Error('locality-frequency model digest is stale');
  if (JSON.stringify(frequency.seeds) !== JSON.stringify([...LOCALITY_FREQUENCY_SEEDS])) {
    throw new Error(`locality-frequency seed panel must be ${LOCALITY_FREQUENCY_SEEDS.join(', ')}`);
  }
  const names = scenarios.length ? [...new Set(scenarios)].sort() : [...manifestById.keys()].sort();
  const cardDir = path.join(root, 'archive', 'claim-cards', `v${selectedVersion}`);
  const missing = names.filter((name) => !manifestById.has(name));
  if (missing.length) throw new Error(`unknown scenario(s): ${missing.join(', ')}`);

  const results = names.map((name) => {
    const cardPath = path.join(cardDir, `${name}.json`);
    const card = fs.existsSync(cardPath) ? JSON.parse(fs.readFileSync(cardPath, 'utf8')) : null;
    const stripPath = path.join(root, 'archive', 'strips', `v${selectedVersion}`, `${name}.json`);
    // Hashed under the CARD's rule, since the digest is checked against the
    // card's own published claim. auditCard fails first if the card and the
    // manifest disagree about the rule, so this can never quietly compare two
    // numbers that were never comparable.
    const cardPolicy = card ? policyOfReceipt(card) : manifestPolicy;
    const actualStripSha256 = fs.existsSync(stripPath)
      ? sha256File(stripPath, cardPolicy) : null;
    return auditCard(card, manifestById.get(name), {
      frequencyScenario: frequency.scenarios?.[name],
      frequencySeeds: frequency.seeds,
      actualStripSha256,
      cardPolicy,
      manifestPolicy,
    });
  });
  return {
    version: selectedVersion,
    scenario_count: results.length,
    unresolved_scenario_count: results.filter((result) => result.unresolved.length).length,
    unresolved_species_count: results.reduce((sum, result) => sum + result.unresolved.length, 0),
    errors: results.flatMap((result) => result.errors),
    warnings: results.flatMap((result) => result.warnings),
    results,
  };
}

function printReport(report) {
  console.log(`[locality-envelope] v${report.version}: ${report.scenario_count} scenario(s)`);
  for (const warning of report.warnings) console.log(`  REVIEW ${warning}`);
  for (const error of report.errors) console.error(`  FAIL ${error}`);
  console.log(`[locality-envelope] ${report.unresolved_species_count} unclassified product(s) in ${report.unresolved_scenario_count} scenario(s); ${report.errors.length} contract violation(s)`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('node tools/locality-envelope-audit.mjs [--version N] [--scenario ID[,ID]] [--check]');
    return;
  }
  const report = auditFleet(args);
  printReport(report);
  if (args.check && (report.errors.length || report.unresolved_species_count)) process.exitCode = 1;
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) main().catch((error) => { console.error(error); process.exit(1); });
