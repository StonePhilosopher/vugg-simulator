import crypto from 'node:crypto';

export const LOCALITY_FREQUENCY_SEEDS = Object.freeze([1, 2, 42]);

export function expectationMinerals(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => (typeof entry === 'string' ? entry : entry?.mineral))
    .filter((mineral) => typeof mineral === 'string' && mineral.length > 0);
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`
  )).join(',')}}`;
}

function sortedObject(entries) {
  return Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b)));
}

// `runs` are the primary observations. `occurrences` is only a convenient
// index and must always be reproducible from those observations; otherwise a
// hand-edited count could silently change a deterministic/statistical claim.
export function reconstructFrequencyOccurrences(frequencyScenario, frequencySeeds) {
  const errors = [];
  const expectedSeeds = Array.isArray(frequencySeeds) ? [...frequencySeeds] : [];
  const expectedSeedSet = new Set(expectedSeeds);
  if (expectedSeeds.length !== expectedSeedSet.size) {
    errors.push('declared seed panel contains duplicates');
  }

  const runs = Array.isArray(frequencyScenario?.runs) ? frequencyScenario.runs : [];
  if (!Array.isArray(frequencyScenario?.runs)) errors.push('runs must be an array');
  const duration = Number(frequencyScenario?.duration_steps);
  const seenSeeds = new Set();
  const occurrenceMap = new Map();

  for (const [index, run] of runs.entries()) {
    const seed = Number(run?.seed);
    if (!Number.isInteger(seed) || !expectedSeedSet.has(seed)) {
      errors.push(`runs[${index}] has undeclared or invalid seed ${run?.seed}`);
      continue;
    }
    if (seenSeeds.has(seed)) {
      errors.push(`seed ${seed} has more than one run`);
      continue;
    }
    seenSeeds.add(seed);

    const species = Array.isArray(run?.species) ? run.species : [];
    const canonicalSpecies = [...new Set(species
      .filter((mineral) => typeof mineral === 'string' && mineral.length > 0))].sort();
    if (!Array.isArray(run?.species)
        || canonicalJson(species) !== canonicalJson(canonicalSpecies)) {
      errors.push(`seed ${seed} species must be unique, nonempty strings in sorted order`);
    }
    const firstSteps = run?.first_steps;
    if (!firstSteps || typeof firstSteps !== 'object' || Array.isArray(firstSteps)) {
      errors.push(`seed ${seed} first_steps must be an object`);
      continue;
    }
    const firstStepSpecies = Object.keys(firstSteps).sort();
    if (canonicalJson(firstStepSpecies) !== canonicalJson(canonicalSpecies)) {
      errors.push(`seed ${seed} species and first_steps keys differ`);
    }

    for (const mineral of canonicalSpecies) {
      const firstStep = Number(firstSteps[mineral]);
      if (!Number.isInteger(firstStep) || firstStep < 1
          || (Number.isInteger(duration) && duration > 0 && firstStep > duration)) {
        errors.push(`seed ${seed} ${mineral} has invalid first step ${firstSteps[mineral]}`);
      }
      const occurrence = occurrenceMap.get(mineral) || { seeds: [], first_steps: new Map() };
      occurrence.seeds.push(seed);
      occurrence.first_steps.set(String(seed), firstStep);
      occurrenceMap.set(mineral, occurrence);
    }
  }

  for (const seed of expectedSeeds) {
    if (!seenSeeds.has(seed)) errors.push(`declared seed ${seed} has no run`);
  }
  if (runs.length !== expectedSeeds.length) {
    errors.push(`run count ${runs.length} differs from seed-panel size ${expectedSeeds.length}`);
  }

  const occurrences = {};
  for (const [mineral, occurrence] of [...occurrenceMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))) {
    const orderedSeeds = expectedSeeds.filter((seed) => occurrence.seeds.includes(seed));
    occurrences[mineral] = {
      count: orderedSeeds.length,
      seeds: orderedSeeds,
      first_steps: sortedObject(orderedSeeds.map((seed) => (
        [String(seed), occurrence.first_steps.get(String(seed))]
      ))),
    };
  }
  return { occurrences, errors };
}

export function validateFrequencyScenarioReceipt(frequencyScenario, frequencySeeds) {
  const result = reconstructFrequencyOccurrences(frequencyScenario, frequencySeeds);
  const supplied = frequencyScenario?.occurrences;
  if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) {
    result.errors.push('occurrences must be an object');
  } else if (canonicalJson(supplied) !== canonicalJson(result.occurrences)) {
    result.errors.push('occurrences do not match the canonical reconstruction from runs');
  }
  return result;
}

// Moving a mineral between deterministic/statistical/aspirational tiers does
// not change execution: locality-sensitive engines consume their UNION as the
// positive licence. Hash that union plus every behavior-bearing scenario field
// so a tier promotion can reuse the measurements, while any chemistry, event,
// exclusion, duration, window, prerequisite, or licence-union change invalidates
// the frequency receipt.
export function localityFrequencySpecHash(spec) {
  const copy = structuredClone(spec || {});
  const positiveSpecies = [...new Set([
    ...expectationMinerals(copy.expects_species),
    ...expectationMinerals(copy.deterministic_species),
    ...expectationMinerals(copy.statistical_species),
    ...expectationMinerals(copy.aspirational_species),
  ])].sort();
  delete copy.expects_species;
  delete copy.deterministic_species;
  delete copy.statistical_species;
  delete copy.aspirational_species;
  copy._positive_species_license = positiveSpecies;
  return crypto.createHash('sha256').update(canonicalJson(copy)).digest('hex');
}
