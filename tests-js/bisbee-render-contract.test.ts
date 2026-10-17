import { describe, expect, it } from 'vitest';
import { summarizeBisbeeRenderComparison } from '../tools/bisbee-render-contract.mjs';

const samples = () => Array.from({ length: 12 }, (_, index) => {
  const pair = Math.floor(index / 2);
  const variant = (pair % 2 === 0 ? ['baseline', 'candidate'] : ['candidate', 'baseline'])[index % 2];
  return { pair, variant, ms: variant === 'baseline' ? 1000 : 700,
    meshes_equal: true, science_unchanged: true,
    orbit: Array.from({ length: 36 }, () => ({ cpu_ms: 5, gpu_ms: 8, gpu_unavailable: null })),
    retained: { heap: 1000000, info: { programs: 8, memory: { geometries: 50, textures: 7 },
      render: { calls: 415, triangles: 1145910, points: 0, lines: 0 } } } };
});

describe('bounded rendering comparison acceptance', () => {
  it('reports separate timing and retention evidence for complete matching pairs', () => {
    expect(summarizeBisbeeRenderComparison(samples())).toMatchObject({ status: 'passed',
      baseline: { construction_median_ms: 1000 }, candidate: { construction_median_ms: 700 } });
  });
  it('rejects incomplete, reordered or scientifically different comparisons', () => {
    expect(() => summarizeBisbeeRenderComparison(samples().slice(1))).toThrow();
    for (const change of [(rows: any[]) => { rows[0].variant = 'candidate'; },
      (rows: any[]) => { rows[0].science_unchanged = false; },
      (rows: any[]) => { rows[0].meshes_equal = false; },
      (rows: any[]) => { rows[0].retained.info.memory.geometries++; }]) {
      const rows = samples(); change(rows);
      expect(() => summarizeBisbeeRenderComparison(rows)).toThrow();
    }
  });
  it('cannot turn lost GPU observation into a passed GPU gate', () => {
    const rows: any[] = samples(); rows[0].orbit[0] = { cpu_ms: 5, gpu_ms: null, gpu_unavailable: 'disjoint' };
    expect(summarizeBisbeeRenderComparison(rows)).toMatchObject({ status: 'inconclusive', gates: { steady_gpu: null } });
  });
  it('fails the fixed speed, slow-frame and retained-heap limits', () => {
    for (const change of [(row: any) => { row.ms = 950; },
      (row: any) => { row.orbit[0].cpu_ms = 50; row.orbit[1].cpu_ms = 50; },
      (row: any) => { row.retained.heap = 2000000; }]) {
      const rows = samples(); rows.filter(row => row.variant === 'candidate').forEach(change);
      expect(summarizeBisbeeRenderComparison(rows).status).toBe('failed');
    }
  });
});
