#!/usr/bin/env node
// tools/wulfenite-bias-aspect-sweep.mjs — the B(r) calibration-pin instrument for the rung-4a.7
// Pb:Mo lever: aspect / topFrac (bevel share) / face count vs biasC, AT THE PARAMS THE RENDERER
// ACTUALLY PASSES (g=1.0 now that the per-step update un-freezes growthFrac; crystalId=0 per the
// js/99i cache contract). The retired hash band [1.4,2.8] had been eye-checked at the FROZEN
// tag-time g≈0.21 — this sweep re-placed the pins instead of reusing them (lesson: verify the
// kernel at the renderer's params, not your sweep value). Re-run before moving any
// WULFENITE_PBMO pin (js/45).
import { loadSimBundle } from './_harness.mjs';
const { wulffFaceSetForMineral, wulffPolyhedron } =
  await loadSimBundle({ toolName: 'wulfenite-bias-aspect-sweep', extraExports: ['wulffFaceSetForMineral', 'wulffPolyhedron'] });

function measure(biasC, g) {
  const faces = wulffFaceSetForMineral('wulfenite', g, 0, biasC);
  const poly = wulffPolyhedron(faces);
  const vs = poly.vertices;
  if (!vs.length) return { biasC, g, dead: true };
  const ext = (i) => Math.max(...vs.map(v => v[i])) - Math.min(...vs.map(v => v[i]));
  const thick = ext(1);                                  // Y = crystallographic c (the plate normal)
  const diam = Math.max(ext(0), ext(2));
  // bevel read: radius of the {001} top face vs the equatorial radius. 0 → knife-edge
  // plate (no visible top square shrink... actually 1 → no bevel), small top → {101} owns the side.
  const yMax = Math.max(...vs.map(v => v[1]));
  const topVs = vs.filter(v => Math.abs(v[1] - yMax) < 1e-6);
  const rad = (v) => Math.hypot(v[0], v[2]);
  const rTop = topVs.length ? Math.max(...topVs.map(rad)) : 0;
  const rEq = Math.max(...vs.map(rad));
  const nFaces = poly.faces.length;
  return { biasC, g, aspect: diam / thick, nFaces, topFrac: rTop / rEq, nV: vs.length };
}

for (const g of [1.0, 0.21]) {
  console.log(`\n=== g = ${g}  (crystalId=0, jitter constant) ===`);
  console.log('  biasC   aspect  faces  topFrac   read');
  for (let b = 0.3; b <= 3.21; b += 0.1) {
    const m = measure(+b.toFixed(2), g);
    if (m.dead) { console.log(`  ${b.toFixed(2)}   DEGENERATE`); continue; }
    let read = '';
    if (m.nFaces <= 8 && m.topFrac < 0.05) read = 'BIPYRAMID ({001} gone)';
    else if (m.aspect < 1.4) read = 'equant/blocky';
    else if (m.aspect < 2.6) read = 'stout tablet';
    else if (m.aspect < 4.2) read = 'plate';
    else read = 'thin plate';
    console.log(`  ${m.biasC.toFixed(2).padStart(5)}  ${m.aspect.toFixed(2).padStart(6)}  ${String(m.nFaces).padStart(4)}   ${m.topFrac.toFixed(3)}   ${read}`);
  }
}
console.log('\npin guide: Tsumeb ⟨r⟩=1.25 → want stout plate w/ visible bevel (aspect ~2.5-3.5, topFrac well <1).');
console.log('Mo-rich extrapolation end → thin plate ~aspect 6. Floor: stoutest still {001}-dominant.');
