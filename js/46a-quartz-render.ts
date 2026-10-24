// R4a quartz: fixed crystallographic planes, unequal development, and prism
// striations. Render-only: no RNG draws, growth records or scientific volumes change.
// Cell: Handbook of Mineralogy quartz, a=4.9135 Å, c=5.4050 Å.
// r commonly exceeds z in area: Gault, Am. Mineral. 34:142–162 (1949).
// Transverse prism striations: van Praagh & Willis, Nature 169:623–624 (1952),
// doi:10.1038/169623b0. The shader depicts shallow relief, not a claim that all
// striations are oscillatory prism/rhombohedron combinations.
// Face distances and the history-to-relief mapping below are representative
// rendering choices, NOT measured face velocities or a growth-mechanism claim.
const _QUARTZ_32 = _wulffBuildGroup([
  [[-0.5, 0, _WULFF_S3], [0, 1, 0], [-_WULFF_S3, 0, -0.5]],
  [[1, 0, 0], [0, -1, 0], [0, 0, -1]],
]);

function quartzFormNormals(h: number, k: number, l: number): number[][] {
  const seed = _wulffNorm([h / 4.9135, l / 5.4050, (h + 2 * k) / (4.9135 * Math.sqrt(3))]);
  const found = new Map<string, number[]>();
  for (const op of _QUARTZ_32) {
    const n = _wulffMatVec(op, seed);
    found.set(n.map((v: number) => Math.abs(v) < 1e-10 ? '0' : v.toFixed(8)).join(','), n);
  }
  return [...found.values()];
}

function quartzRenderHistory(crystal: any, replayStep: number | null): any {
  const zones = (crystal.zones || []).filter((z: any) => Number.isFinite(z.thickness_um)
    && z.thickness_um > 0 && (replayStep == null || z.step <= replayStep));
  const total = zones.reduce((s: number, z: any) => s + z.thickness_um, 0);
  let cumulative = 0, change = 0;
  const candidates: any[] = [];
  for (let i = 0; i < zones.length; i++) {
    if (i) {
      const a = zones[i - 1].thickness_um, b = zones[i].thickness_um;
      const strength = Math.abs(b - a) / Math.max(a, b);
      change += strength;
      if (strength > 0.2 && total > 0) candidates.push({ at: cumulative / total - 0.5, strength });
    }
    cumulative += zones[i].thickness_um;
  }
  const variability = zones.length > 1 ? change / (zones.length - 1) : 0;
  // Keep the strongest 16 episode boundaries; stable ordering and no future zones
  // during replay. Positions are a normalized growth-history display, not measured
  // traces of those events on each individual prism face.
  const bands = candidates.sort((a, b) => b.strength - a.strength || a.at - b.at).slice(0, 16)
    .sort((a, b) => a.at - b.at);
  return { contrast: Math.round((0.12 + variability * 0.12) * 100) / 100,
    phase: ((Math.abs(crystalRenderSeed(crystal)) * 5) % 16) * Math.PI / 8,
    bands, variability, growth_um: total };
}

function quartzRenderFaces(widthRatio: number, contrast: number, phase: number, doubleEnded = false): any[] {
  // Unit c length, uniform final scale. Change distances to develop aspect;
  // never anisotropically stretch the completed termination.
  const radius = 0.4 * Math.max(0.2, Math.min(1.1, widthRatio));
  const faces: any[] = quartzFormNormals(1, 0, 0).map(n => ({ n, d: radius * Math.sqrt(3) / 2, family: 'm' }));
  for (const [h, k, family] of [[1, 0, 'r'], [0, 1, 'z']] as any[]) {
    for (const n of quartzFormNormals(h, k, 1)) {
      if (n[1] <= 0) continue; // attached prism: flat basal scar, free +c termination
      const azimuth = Math.atan2(n[2], n[0]);
      faces.push({ n, family, d: n[1] * 0.5 + radius * ((family === 'z' ? contrast : 0)
        + 0.035 * Math.cos(azimuth - phase)) });
    }
  }
  faces.push({ n: [0, -1, 0], d: 0.5, family: 'scar' });
  // Unequal planes move the apex laterally. Translate the termination planes
  // together along c to retain the existing length/base-at-anchor contract.
  const first = wulffPolyhedron(faces);
  if (!first?.vertices.length) return faces;
  const peak = Math.max(...first.vertices.map((v: number[]) => v[1]));
  for (const face of faces) if (face.n[1] > 0) face.d += face.n[1] * (0.5 - peak);
  if(doubleEnded){
    // Selected source-branch dependency: the recorded habit already names
    // both terminations. Quartz's existing 32 group relates ends by C2 about
    // a; this rotates the recorded upper families, without new form tuning.
    faces.splice(faces.findIndex(f=>f.family==='scar'),1);
    for(const f of faces.filter(f=>f.n[1]>0))faces.push({n:[f.n[0],-f.n[1],-f.n[2]],d:f.d,family:f.family});
  }
  return faces;
}

function makeQuartzRenderGeometry(widthRatio: number, contrast: number, phase: number, doubleEnded = false): any {
  const faces = quartzRenderFaces(widthRatio, contrast, phase, doubleEnded);
  const poly = wulffPolyhedron(faces);
  if (!poly || (doubleEnded?poly.faces.length<12:poly.faces.length!==13)) return null;
  const geometry = _wulffPolyToGeom(poly, 1);
  if (geometry) geometry.userData.quartzR4 = { widthRatio, contrast, phase, doubleEnded,
    families: poly.faces.map((f: any) => faces[f.plane].family) };
  return geometry;
}

function applyQuartzStriations(material: any, history: any): void {
  const previous = material.onBeforeCompile;
  const cacheKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => cacheKey() + '|quartz-prism-striations-r4a';
  material.userData.quartzStriations = { pitch_mm: 0.18, history_bands: history.bands.length };
  material.onBeforeCompile = (shader: any) => {
    previous.call(material, shader);
    shader.uniforms.uQuartzBandCount = { value: history.bands.length };
    shader.uniforms.uQuartzBands = { value: Array.from({ length: 16 }, (_, i) =>
      new THREE.Vector2(history.bands[i]?.at || 0, history.bands[i]?.strength || 0)) };
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec3 vQuartzLocal;\nvarying float vQuartzPrism;\nvarying float vQuartzLength;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvQuartzLocal = position;\nvQuartzPrism = 1.0 - step(0.05, abs(normal.y));\nvQuartzLength = length(modelMatrix[1].xyz);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vQuartzLocal;
      varying float vQuartzPrism;
      varying float vQuartzLength;
      uniform int uQuartzBandCount;
      uniform vec2 uQuartzBands[16];`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (vQuartzPrism > 0.9) {
        float y = vQuartzLocal.y * vQuartzLength;
        float footprint = max(fwidth(y), 0.0001);
        float phase = y * 34.906585 + 0.55 * sin(y * 7.1);
        float resolved = 1.0 - smoothstep(0.035, 0.12, footprint);
        float slope = (0.012 * sin(phase) + 0.003 * sin(phase * 2.713)) * resolved;
        for (int i = 0; i < 16; i++) {
          if (i >= uQuartzBandCount) break;
          float width = max(0.025, footprint);
          float t = (y - uQuartzBands[i].x * vQuartzLength) / width;
          slope += 0.035 * uQuartzBands[i].y * t * exp(-t * t) * resolved;
        }
        // Surface gradient in view coordinates; prism-only, no painted stripes
        // and no altered silhouettes, shadows, depth geometry or picking.
        vec3 dx = dFdx(-vViewPosition), dy = dFdy(-vViewPosition);
        vec3 rx = cross(dy, normal), ry = cross(normal, dx);
        float determinant = dot(dx, rx);
        if (abs(determinant) > 1e-12) {
          vec3 gradient = (rx * dFdx(y) + ry * dFdy(y)) / determinant;
          normal = normalize(normal - slope * gradient);
        }
      }`);
  };
}
