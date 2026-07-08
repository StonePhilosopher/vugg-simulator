// tools/o3-selection-oracle.mjs — the ANALYTIC ORACLE for W-F O3 (geometric
// selection). PROPOSAL-ONTOGENY rung O3: "Instruments first: survivor-density-
// vs-height probe checked against Gray's d^(−1/2) and Krapivsky's bounds — an
// analytic oracle BEFORE any render ships." This is that instrument, and it is
// deliberately STANDALONE (no sim bundle): it encodes the physics from the
// literature so the eventual engine change has an independent law to match, not
// a circular self-check.
//
// THE LAW BEING REPRODUCED
// ------------------------
// Geometric selection (Kolmogorov 1949; van der Drift 1967; Gray 1984): grains
// nucleate on a substrate at RANDOM orientations and grow anisotropically (fast
// along a crystallographic axis, slow perpendicular). A grain whose fast axis
// points into the void outruns its neighbors and buries the ones whose fast
// axis is tilted away. Two verified consequences, which this MC must exhibit:
//   (1) SURVIVOR DENSITY thins as a power law in height above the substrate:
//       n(h) ∝ h^(−1/2)  (Gray 1984 Math.Geol. 16(1):91-100, 2-D Monte Carlo).
//       Equivalently column WIDTH w(h) ∝ h^(+1/2).
//   (2) SURVIVAL OF THE MOST-NORMAL: ⟨|tilt|⟩ of the survivors → 0 as h grows
//       (van der Drift 1967). The palisade is EARNED by competition, not painted.
//
// THE MODEL — anisotropic Johnson–Mehl (tilted-ellipse weighted Voronoi)
// ---------------------------------------------------------------------
// The cleanest faithful construction of "survival of the fastest normal
// component." Each grain g nucleates at x_g on the substrate (y=0) with tilt
// θ_g (fast-axis angle from the +y wall-normal). Its growth front at time t is
// an ELLIPSE: semi-axis a·t along its axis (fast), b·t perpendicular (slow),
// anisotropy k = a/b ≥ 1. A point p is owned by the grain that REACHES IT FIRST:
//   t_g(p) = sqrt( (along/a)² + (perp/b)² ),  (along,perp) = R(−θ_g)·(p − x_g)
// with the substrate periodic (minimal-image on the x-separation; y is open).
// k = 1 ⇒ isotropic ⇒ ordinary Voronoi ⇒ NO selection (control); k > 1 ⇒
// grains pointing up reach high points first ⇒ selection. This is standard
// anisotropic-JMAK; it is NOT the eventual engine (the engine uses a cheap local
// neighbor rule) — it is the LAW the engine's fleet statistics must match.
//
// WHAT IT EXTRACTS FOR THE ENGINE
// -------------------------------
//   • confirmation the exponent is −1/2 (so the oracle itself is trustworthy),
//   • the tilt distribution to draw at nucleation (default: fully random, the
//     Gray/van der Drift setup — θ uniform on the outward hemisphere),
//   • how selection strength scales with anisotropy k (calibration knob),
//   • the survivor-tilt envelope ⟨|θ|⟩(h) the engine's burial rule must recover.
//
// Usage: node tools/o3-selection-oracle.mjs [--seeds N] [--k a/b] [--quick]

// ---- deterministic PRNG (no Date/Math.random in the measurement path so the
// oracle is byte-reproducible run to run) ---------------------------------
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- tilt distributions on the outward hemisphere ------------------------
// 2-D: "fully random nucleation" = the fast axis uniformly oriented in the
// outward half-plane ⇒ θ uniform in (−π/2, +π/2). This is Gray's setup.
const TILT = {
  uniform: (rnd) => (rnd() - 0.5) * Math.PI,            // θ ∈ (−90°, +90°)
  gauss30: (rnd) => {                                   // concentrated draw
    // Box–Muller, σ = 30°, rejected to (−90°,90°)
    let z;
    do {
      const u1 = Math.max(1e-12, rnd()), u2 = rnd();
      z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * (30 * Math.PI / 180);
    } while (Math.abs(z) >= Math.PI / 2);
    return z;
  },
};

// ---- one Monte-Carlo realization ----------------------------------------
// Returns per-height { h, columns, meanAbsTiltDeg } sampled across the
// periodic substrate. columns = number of distinct contiguous ownership
// domains around the x-ring at that height = surviving column count.
function realize({ W, H, N, k, tiltFn, nx, ny, rnd }) {
  const a = k, b = 1;                       // fast / slow front speeds
  // Nucleate N grains at random x, random tilt.
  const gx = new Float64Array(N), gs = new Float64Array(N), gc = new Float64Array(N), gt = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    gx[i] = rnd() * W;
    const th = tiltFn(rnd);
    gt[i] = th; gs[i] = Math.sin(th); gc[i] = Math.cos(th);
  }
  const halfW = W / 2;
  const out = [];
  for (let iy = 1; iy <= ny; iy++) {
    const y = (iy / ny) * H;
    let changes = 0, tiltSum = 0;
    let prevOwner = -1, firstOwner = -1;
    for (let ix = 0; ix < nx; ix++) {
      const px = (ix / nx) * W;
      // find owning grain = argmin arrival time
      let best = Infinity, owner = -1;
      for (let g = 0; g < N; g++) {
        // minimal-image x-separation (substrate periodic; y open)
        let dx = px - gx[g];
        if (dx > halfW) dx -= W; else if (dx < -halfW) dx += W;
        const along = dx * gs[g] + y * gc[g];      // R(−θ)·(dx,y), fast component
        const perp = dx * gc[g] - y * gs[g];       // slow component
        const t = Math.sqrt((along * along) / (a * a) + (perp * perp) / (b * b));
        if (t < best) { best = t; owner = g; }
      }
      if (ix === 0) { firstOwner = owner; }
      else if (owner !== prevOwner) { changes++; }
      prevOwner = owner;
      tiltSum += Math.abs(gt[owner]);
    }
    // periodic wrap: last→first boundary
    if (prevOwner !== firstOwner) changes++;
    const columns = Math.max(1, changes);          // distinct domains around the ring
    out.push({ h: y, columns, meanAbsTiltDeg: (tiltSum / nx) * 180 / Math.PI });
  }
  return out;
}

// ---- least-squares slope of ln(y) on the log-log survivor curve ----------
function fitExponent(rows, hMin, hMax) {
  const xs = [], ys = [];
  for (const r of rows) {
    if (r.h >= hMin && r.h <= hMax && r.columns > 0) {
      xs.push(Math.log(r.h)); ys.push(Math.log(r.columns));
    }
  }
  const n = xs.length;
  if (n < 3) return { slope: NaN, r2: NaN, n };
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const slope = sxy / sxx;
  const r2 = (sxy * sxy) / (sxx * syy);
  return { slope, r2, n };
}

// ---- average many realizations at fixed params ---------------------------
function ensemble({ W, H, N, k, tiltFn, nx, ny, seeds }) {
  let acc = null;
  for (let s = 0; s < seeds; s++) {
    const rnd = mulberry32((1013904223 ^ ((s + 1) * 2654435761)) >>> 0);
    const rows = realize({ W, H, N, k, tiltFn, nx, ny, rnd });
    if (!acc) acc = rows.map(r => ({ h: r.h, columns: 0, meanAbsTiltDeg: 0 }));
    for (let i = 0; i < rows.length; i++) { acc[i].columns += rows[i].columns; acc[i].meanAbsTiltDeg += rows[i].meanAbsTiltDeg; }
  }
  for (const r of acc) { r.columns /= seeds; r.meanAbsTiltDeg /= seeds; }
  return acc;
}

// ==========================================================================
const argSeeds = process.argv.indexOf('--seeds');
const SEEDS = argSeeds >= 0 ? Math.max(1, parseInt(process.argv[argSeeds + 1], 10) | 0) : 6;
const argK = process.argv.indexOf('--k');
const K_ONE = argK >= 0 ? parseFloat(process.argv[argK + 1]) : null;
const QUICK = process.argv.includes('--quick');

// grid — kept modest so the brute-force O(nx·ny·N) owner search stays a few
// seconds; --quick halves it for iteration.
const W = QUICK ? 240 : 360;
const H = QUICK ? 200 : 300;
const N = QUICK ? 140 : 220;          // grains on the substrate (dense druse)
const nx = QUICK ? 260 : 400;         // x samples per height
const ny = QUICK ? 200 : 300;         // height samples
const fitLo = H * 0.10, fitHi = H * 0.80;

console.log('# O3 GEOMETRIC-SELECTION ORACLE — Gray (1984) d^(−1/2) survivor law');
console.log(`# grid W=${W} H=${H} grains=${N} samples=${nx}×${ny} seeds=${SEEDS}  fit window h∈[${fitLo.toFixed(0)},${fitHi.toFixed(0)}]`);
console.log('# n(h) ∝ h^p  — Gray predicts p = −0.50 (columns coarsen as √h)\n');

const kList = K_ONE != null ? [K_ONE] : (QUICK ? [1.0, 2.0, 3.0] : [1.0, 1.5, 2.0, 3.0, 5.0]);

console.log('anisotropy k=a/b   exponent p     R²      n@h_lo→n@h_hi   ⟨|tilt|⟩ base→top   verdict');
console.log('----------------   ----------     ----    -------------   -----------------   -------');
const results = [];
for (const k of kList) {
  const rows = ensemble({ W, H, N, k, tiltFn: TILT.uniform, nx, ny, seeds: SEEDS });
  const fit = fitExponent(rows, fitLo, fitHi);
  const nLo = rows.find(r => r.h >= fitLo)?.columns ?? NaN;
  const nHi = [...rows].reverse().find(r => r.h <= fitHi)?.columns ?? NaN;
  const tBase = rows[Math.floor(rows.length * 0.05)]?.meanAbsTiltDeg ?? NaN;
  const tTop = rows[Math.floor(rows.length * 0.95)]?.meanAbsTiltDeg ?? NaN;
  // k=1 (isotropic) is the CONTROL: should show NO selection (p≈0, flat tilt).
  let verdict;
  if (k === 1.0) verdict = (Math.abs(fit.slope) < 0.15) ? 'control ok (no selection)' : 'CONTROL FAIL';
  else verdict = (Math.abs(fit.slope - (-0.5)) < 0.12) ? '≈ −1/2 ✓' : (fit.slope < -0.15 ? 'selects (off −1/2)' : 'WEAK');
  results.push({ k, ...fit, tBase, tTop });
  console.log(
    `${k.toFixed(2).padStart(14)}     ${fit.slope.toFixed(3).padStart(7)}     ${fit.r2.toFixed(3)}   ` +
    `${nLo.toFixed(1).padStart(5)}→${nHi.toFixed(1).padStart(5)}   ` +
    `${tBase.toFixed(1).padStart(5)}°→${tTop.toFixed(1).padStart(5)}°       ${verdict}`,
  );
}

// Detailed survivor curve for the reference anisotropy (k=2, a plausible
// crystal fast/slow ratio) — the shape the engine's fleet probe will match.
const kRef = K_ONE != null ? K_ONE : 2.0;
const ref = ensemble({ W, H, N, k: kRef, tiltFn: TILT.uniform, nx, ny, seeds: SEEDS });
console.log(`\n# SURVIVOR CURVE (k=${kRef}, uniform tilt) — the engine's fleet statistics target`);
console.log('  h/H     columns n(h)   n/n0     ⟨|tilt|⟩');
const n0 = ref[0].columns;
for (const frac of [0.02, 0.05, 0.1, 0.2, 0.35, 0.5, 0.7, 0.9, 1.0]) {
  const r = ref[Math.min(ref.length - 1, Math.round(frac * ny) - 1)] || ref[ref.length - 1];
  console.log(`  ${frac.toFixed(2)}    ${r.columns.toFixed(1).padStart(8)}      ${(r.columns / n0).toFixed(3)}    ${r.meanAbsTiltDeg.toFixed(1).padStart(5)}°`);
}

// Sensitivity to the tilt distribution (does a concentrated nucleation draw
// still select?) — informs whether the engine needs fully-random or can use a
// tighter, more legible spread (spec risk #2: keep the hero termination readable).
console.log('\n# TILT-DISTRIBUTION SENSITIVITY (k=' + kRef + ')');
for (const [name, fn] of Object.entries(TILT)) {
  const rows = ensemble({ W, H, N, k: kRef, tiltFn: fn, nx, ny, seeds: SEEDS });
  const fit = fitExponent(rows, fitLo, fitHi);
  const tBase = rows[Math.floor(rows.length * 0.05)].meanAbsTiltDeg;
  const tTop = rows[Math.floor(rows.length * 0.95)].meanAbsTiltDeg;
  console.log(`  ${name.padEnd(8)}  p=${fit.slope.toFixed(3)}  R²=${fit.r2.toFixed(3)}  ⟨|tilt|⟩ ${tBase.toFixed(1)}°→${tTop.toFixed(1)}°`);
}

const refFit = results.find(r => Math.abs(r.k - kRef) < 1e-9) || fitExponent(ref, fitLo, fitHi);
console.log('\n# ORACLE VERDICT');
const p = (refFit.slope ?? fitExponent(ref, fitLo, fitHi).slope);
console.log(`  reference k=${kRef}: measured exponent p = ${p.toFixed(3)}  (Gray target −0.50)`);
console.log(`  ${Math.abs(p + 0.5) < 0.12 ? '✓ oracle reproduces the d^(−1/2) survivor law — trustworthy as the engine target'
                                          : '✗ exponent off target — DEBUG the MC before trusting it as an oracle'}`);
