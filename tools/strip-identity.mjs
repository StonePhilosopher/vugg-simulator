/** Strict provenance guard shared by strip generators and review tooling. */
export function assertStripIdentity(strip, expected) {
  if (!strip || typeof strip !== 'object') {
    throw new Error('[strip-identity] strip testimony is missing or malformed');
  }
  const version = Number(expected?.version);
  const digest = String(expected?.modelDigest || '');
  const scenario = expected?.scenario == null ? null : String(expected.scenario);
  const seed = expected?.seed == null ? null : Number(expected.seed);
  const specHash = expected?.scenarioSpecHash == null ? null : String(expected.scenarioSpecHash);
  if (!Number.isInteger(version) || version <= 0 || !digest) {
    throw new Error('[strip-identity] expected version and model digest are required');
  }
  if (strip.sim_version !== version) {
    throw new Error(`[strip-identity] SIM version mismatch: strip=${strip.sim_version ?? 'missing'}, expected=${version}`);
  }
  if (strip.model_digest !== digest) {
    throw new Error(`[strip-identity] model digest mismatch: strip=${strip.model_digest ?? 'missing'}, expected=${digest}`);
  }
  if (scenario !== null && strip.scenario !== scenario) {
    throw new Error(`[strip-identity] scenario mismatch: strip=${strip.scenario ?? 'missing'}, expected=${scenario}`);
  }
  if (seed !== null && strip.seed !== seed) {
    throw new Error(`[strip-identity] seed mismatch: strip=${strip.seed ?? 'missing'}, expected=${seed}`);
  }
  if (specHash !== null && strip.scenario_spec_hash !== specHash) {
    throw new Error(`[strip-identity] scenario spec hash mismatch: strip=${strip.scenario_spec_hash ?? 'missing'}, expected=${specHash}`);
  }
  return strip;
}
