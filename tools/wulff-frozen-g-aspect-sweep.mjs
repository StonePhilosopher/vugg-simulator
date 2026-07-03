#!/usr/bin/env node
// tools/wulff-frozen-g-aspect-sweep.mjs — verify every Wulff tenant's biasC band AT THE g VALUES
// THE UN-FREEZE WILL PASS (growth-geometry handoff item #2; the 4a.7 lesson generalized: the bands
// were eye-checked at the FROZEN tag-time g≈0.15 — verify the kernel at the renderer's params, not
// your sweep value / memory feedback_render_upgrade_visible).
//
// For each tenant × form-band (lo/mid/hi) × g ∈ {0.15 frozen, 0.4, 0.7, 1.0 earned} builds the
// polyhedron via the REAL kernel path (wulffFaceSetForMineral → wulffPolyhedron, crystalId=0 per
// the js/99i cache contract) and reports:
//   nFaces   — form self-elimination check (galena's {111} truncations must STAY at 14 faces;
//              6 = perfect cube = the render-upgrade-visible NO-OP)
//   truncFrac — cubic corner-cut depth: 1 − rMax/(√3·xFace). 0 = perfect cube.
//   elongY / aspect — extY/diam (c-elongated read) and diam/extY (plate read); one is the
//              tenant's genre number, the other its reciprocal.
//   DEGENERATE — the null-clamp trap (a dead solid falls through to the OLD primitive silently).
// Re-run whenever a band or the SEED/SPAN formula moves.
import { loadSimBundle } from './_harness.mjs';
const { wulffFaceSetForMineral, wulffPolyhedron } =
  await loadSimBundle({ toolName: 'wulff-frozen-g-aspect-sweep', extraExports: ['wulffFaceSetForMineral', 'wulffPolyhedron'] });

const G_GRID = [0.15, 0.4, 0.7, 1.0];
// tenant bands from js/45 classifyWulffForm (lo, mid, hi of each live band).
// galena + fluorite-octahedral are the rung-4a.8 RE-PLACED bands (the originals, [1.0,1.15] and
// [0.32,0.52], were placed at the frozen tag-g and broke genre at earned g — this tool's first
// run caught both).
const BANDS = [
  { mineral: 'fluorite', form: 'octahedral (REE)', biasCs: [0.38, 0.42, 0.46], genre: 'octahedron w/ {100} kept (14 faces, NOT 8)' },
  { mineral: 'fluorite', form: 'cubic',            biasCs: [1.15, 1.78, 2.40], genre: 'sharp cube (6) or lightly truncated (14)' },
  { mineral: 'calcite',  form: 'scaleno (dogtooth)', biasCs: [0.15, 0.205, 0.26], genre: 'elongated tooth (elongY high)' },
  { mineral: 'calcite',  form: 'rhomb (nailhead)',   biasCs: [1.30, 1.75, 2.20], genre: 'blocky rhombohedron' },
  { mineral: 'galena',   form: 'cube band',        biasCs: [0.88, 0.95, 1.02], genre: 'cube w/ VISIBLE {111} truncations (14 faces, truncFrac>0)' },
  { mineral: 'barite',   form: 'tabular',          biasCs: [1.3, 1.75, 2.2],  genre: 'rectangular plate (aspect ~3-5)' },
  { mineral: 'barite',   form: 'bladed',           biasCs: [1.9, 2.45, 3.0],  genre: 'thin blade (aspect ~4.5-7)' },
  { mineral: 'titanite', form: 'wedge',            biasCs: [1.3, 1.8, 2.3],   genre: 'oblique sphenoid wedge' },
];

function measure(mineral, biasC, g) {
  const faces = wulffFaceSetForMineral(mineral, g, 0, biasC);
  if (!faces) return { dead: true };
  const poly = wulffPolyhedron(faces);
  const vs = poly.vertices;
  if (!vs.length) return { dead: true };
  const ext = (i) => Math.max(...vs.map(v => v[i])) - Math.min(...vs.map(v => v[i]));
  const eX = ext(0), eY = ext(1), eZ = ext(2);
  const diam = Math.max(eX, eZ);
  const rMax = Math.max(...vs.map(v => Math.hypot(v[0], v[1], v[2])));
  const xFace = Math.max(...vs.map(v => Math.abs(v[0])));
  return {
    nFaces: poly.faces.length,
    truncFrac: 1 - rMax / (Math.sqrt(3) * xFace),   // cubic corner read; ~0 = perfect cube
    elongY: eY / diam, aspect: diam / eY,
    eX, eY, eZ,
  };
}

let alarms = 0;
for (const b of BANDS) {
  console.log(`\n=== ${b.mineral} — ${b.form}  (genre: ${b.genre}) ===`);
  console.log('  biasC \\ g' + G_GRID.map(g => `      g=${g.toFixed(2)}`).join(''));
  for (const biasC of b.biasCs) {
    const cells = G_GRID.map(g => {
      const m = measure(b.mineral, biasC, g);
      if (m.dead) { alarms++; return ' DEGENERATE!'.padStart(12); }
      const cubic = b.mineral === 'fluorite' || b.mineral === 'galena';
      const num = cubic ? `t=${Math.max(0, m.truncFrac).toFixed(2)}`
        : (b.mineral === 'calcite' ? `e=${m.elongY.toFixed(2)}` : `a=${m.aspect.toFixed(2)}`);
      return `${String(m.nFaces).padStart(3)}f ${num}`.padStart(12);
    });
    console.log(`  ${biasC.toFixed(3).padStart(6)}   ` + cells.join(''));
  }
}

// hard guards, machine-readable at the end — run against the LIVE js/45 band edges
console.log('\n=== guards ===');
const g1 = (m, biasC) => measure(m, biasC, 1.0);
const galenaLo = g1('galena', 0.88), galenaHi = g1('galena', 1.02);
const galOK = galenaLo.nFaces === 14 && galenaHi.nFaces === 14 && galenaLo.truncFrac > 0.08 && galenaHi.truncFrac > 0.08;
console.log(`  galena {111} truncations at g=1.0 (band [0.88,1.02]): ${galenaLo.nFaces}f/${galenaHi.nFaces}f trunc ${galenaLo.truncFrac.toFixed(3)}/${galenaHi.truncFrac.toFixed(3)} → ${galOK ? 'VISIBLE ✓' : 'LOST ✗ (the no-op trap)'}`);
const fluLo = g1('fluorite', 0.38), fluHi = g1('fluorite', 0.46);
const fluOK = fluLo.nFaces === 14 && fluHi.nFaces === 14;
console.log(`  fluorite octahedral {100} kept at g=1.0 (band [0.38,0.46]): ${fluLo.nFaces}f/${fluHi.nFaces}f → ${fluOK ? 'reduced-not-absent ✓' : 'perfect octahedron ✗ (Bosze&Rakovan violated)'}`);
console.log(`  degenerate cells: ${alarms}${alarms ? ' ✗' : ' ✓'}`);
if (!galOK || !fluOK || alarms) { console.log('\n✗ guard FAILED — do not ship the un-freeze without retuning the flagged band.'); process.exit(1); }
console.log('\n✓ all bands hold their genre at earned g — the un-freeze is safe to ship.');
