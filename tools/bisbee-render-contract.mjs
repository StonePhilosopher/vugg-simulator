import assert from 'node:assert/strict';

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return (sorted[(sorted.length - 1) >> 1] + sorted[sorted.length >> 1]) / 2;
};
const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
const positive = value => Number.isFinite(value) && value > 0;

// Measurement acceptance only. This does not certify the scientific model.
export function summarizeBisbeeRenderComparison(samples) {
  assert.equal(samples.length, 12, 'six complete alternating pairs are required');
  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index], pair = Math.floor(index / 2);
    const expected = (pair % 2 === 0 ? ['baseline', 'candidate'] : ['candidate', 'baseline'])[index % 2];
    assert.equal(sample.pair, pair, 'pair order changed');
    assert.equal(sample.variant, expected, 'variant order changed');
    assert.equal(sample.meshes_equal, true, 'mesh/material comparison failed');
    assert.equal(sample.science_unchanged, true, 'scientific record changed');
    assert.ok(positive(sample.ms) && positive(sample.retained?.heap), 'invalid construction/heap measurement');
    assert.equal(sample.orbit?.length, 36, 'incomplete orbit sample');
    for (const frame of sample.orbit) {
      assert.ok(positive(frame.cpu_ms), 'invalid CPU measurement');
      assert.ok(frame.gpu_ms == null
        ? ['extension-unavailable', 'query-unavailable', 'disjoint'].includes(frame.gpu_unavailable)
        : positive(frame.gpu_ms) && frame.gpu_unavailable === null, 'invalid GPU measurement');
    }
    const info = sample.retained?.info;
    assert.ok(info && Number.isInteger(info.programs), 'missing graphics resource counts');
    const resource = [info.memory.geometries, info.memory.textures, info.programs,
      info.render.calls, info.render.triangles, info.render.points, info.render.lines];
    assert.ok(resource.every(value => Number.isSafeInteger(value) && value >= 0), 'invalid graphics counts');
    const first = samples[0].retained.info;
    assert.deepEqual(resource, [first.memory.geometries, first.memory.textures, first.programs,
      first.render.calls, first.render.triangles, first.render.points, first.render.lines], 'graphics resources or drawing work changed');
  }
  const summarize = variant => {
    const rows = samples.filter(sample => sample.variant === variant);
    const frames = rows.flatMap(sample => sample.orbit);
    const gpu = frames.filter(frame => frame.gpu_ms != null).map(frame => frame.gpu_ms);
    return {
      construction_median_ms: median(rows.map(sample => sample.ms)),
      construction_p95_ms: p95(rows.map(sample => sample.ms)),
      retained_heap_median_bytes: median(rows.map(sample => sample.retained.heap)),
      cpu_median_ms: median(frames.map(frame => frame.cpu_ms)),
      cpu_p95_ms: p95(frames.map(frame => frame.cpu_ms)),
      gpu_valid_samples: gpu.length,
      gpu_unavailable_samples: frames.length - gpu.length,
      gpu_median_ms: gpu.length ? median(gpu) : null,
      gpu_p95_ms: gpu.length ? p95(gpu) : null,
    };
  };
  const baseline = summarize('baseline'), candidate = summarize('candidate');
  const improvement = 1 - candidate.construction_median_ms / baseline.construction_median_ms;
  const within = key => candidate[key] <= baseline[key] + Math.max(1, baseline[key] * 0.10);
  const gpuComplete = baseline.gpu_unavailable_samples === 0 && candidate.gpu_unavailable_samples === 0;
  const gates = {
    construction: improvement >= 0.15,
    steady_cpu: within('cpu_median_ms') && within('cpu_p95_ms'),
    steady_gpu: gpuComplete ? within('gpu_median_ms') && within('gpu_p95_ms') : null,
    retained_heap: candidate.retained_heap_median_bytes <= baseline.retained_heap_median_bytes * 1.10,
    identical_meshes_records_and_resource_counts: true,
  };
  return {
    schema: 'bisbee-render-comparison-v1', trust: 'measurement-only-not-scientific-validation',
    baseline, candidate, construction_improvement_fraction: improvement, gates,
    status: Object.values(gates).includes(false) ? 'failed'
      : Object.values(gates).includes(null) ? 'inconclusive' : 'passed',
  };
}
