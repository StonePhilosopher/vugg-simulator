// Renderer-independent pilot. No DOM, Three.js, live simulator, or RNG access.
// The injected half-space kernel is the existing js/46 implementation.
export const SCHEMA = 'vugg-calcite-specimen-pilot-v1';
export const clone = value => JSON.parse(JSON.stringify(value, (_key, item) => {
  if(typeof item==='number'&&!Number.isFinite(item))throw Error('Non-finite specimen fact');
  if(['function','symbol','bigint'].includes(typeof item))throw Error('Non-serializable specimen fact');
  return item;
}));
export function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const scale = (a, k) => a.map(x => x * k);
const add = (a, b) => a.map((x, i) => x + b[i]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = a => scale(a, 1 / Math.hypot(...a));
const finite = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw Error(`Invalid ${label}`);
};
function vector(v, label) {
  if (!Array.isArray(v) || v.length !== 3) throw Error(`Invalid ${label}`);
  v.forEach(x => finite(x, label));
}

// Same rotation as setFromUnitVectors(+Y, axis) followed by local rotateY(yaw).
function rotation(axis, yaw) {
  const u = unit(axis), from = [0, 1, 0];
  const w = 1 + dot(from, u);
  const q = w < 1e-10 ? [0, 0, 1] : cross(from, u);
  const norm = Math.hypot(...q, w < 1e-10 ? 0 : w);
  const v = scale(q, 1 / norm), qw = w < 1e-10 ? 0 : w / norm;
  return p => {
    const r = [Math.cos(yaw)*p[0]+Math.sin(yaw)*p[2], p[1], -Math.sin(yaw)*p[0]+Math.cos(yaw)*p[2]];
    return add(r, add(scale(cross(v, r), 2*qw), scale(cross(v, cross(v, r)), 2)));
  };
}

export function validateInput(input) {
  if (!input || !Number.isInteger(input.step) || input.step < 0 || !input.source?.kind
      || !Array.isArray(input.crystals)) throw Error('Invalid capture envelope');
  const ids = new Set();
  for (const c of input.crystals) {
    if (!Number.isInteger(c.id) || ids.has(c.id)) throw Error('Duplicate or invalid crystal id');
    ids.add(c.id);
    if (c.mineral !== 'calcite' || c.twinned || c.enclosedBy != null || c.surfaceGrowth
      || c.growthEnvironment==='air' || !['rhombohedral', 'scalenohedral'].includes(c.habit)) {
      throw Error(`Unsupported pilot crystal ${c.id}: requires untwinned plain calcite`);
    }
    for (const k of ['cLengthMm','aWidthMm','bookedVolumeMm3','totalGrowthUm','yaw','exposureK','attachedFraction']) finite(c[k], k);
    if (c.cLengthMm <= 0 || c.aWidthMm <= 0 || c.bookedVolumeMm3 < 0 || c.totalGrowthUm <= 0
        || c.attachedFraction < 0 || c.attachedFraction > 0.95) throw Error('Invalid physical extent');
    vector(c.anchor, 'anchor'); vector(c.axis, 'axis');
    if (Math.hypot(...c.axis) < 1e-10) throw Error('Invalid axis');
    if (!c.form || !Array.isArray(c.zones)) throw Error('Missing form or zone history');
    finite(c.form.biasC, 'biasC'); finite(c.form.growthFrac, 'growthFrac');
    if (c.form.biasC <= 0 || c.form.growthFrac < 0 || c.form.growthFrac > 1) throw Error('Invalid form');
    for (const z of c.zones) {
      finite(z.thickness_um, 'zone thickness');
      if (!Number.isInteger(z.step) || z.step > input.step) throw Error('Future or invalid zone');
    }
  }
}

function body(c) {
  return {
    id: c.id,
    center: add(c.anchor, scale(unit(c.axis), c.cLengthMm*(0.5-c.attachedFraction))),
    reach: 0.5 * Math.hypot(c.aWidthMm, c.aWidthMm, c.cLengthMm),
    growth: c.totalGrowthUm,
  };
}
function neighbors(me, bodies) {
  return bodies.filter(b => b.id !== me.id && Math.hypot(...sub(b.center, me.center)) < me.reach+b.reach);
}
export function geometryVolume(poly) {
  // Translation-relative tetrahedra avoid cancellation far from the origin.
  const origin=poly.vertices[0];
  if(!origin)return 0;
  let volume = 0;
  for (const f of poly.faces) for (let i=1; i<f.verts.length-1; i++) {
    volume += dot(sub(poly.vertices[f.verts[0]],origin), cross(sub(poly.vertices[f.verts[i]],origin), sub(poly.vertices[f.verts[i+1]],origin)))/6;
  }
  return Math.abs(volume);
}
const claim = (classification, source, limitation = null) => ({ classification, source, limitation });

function complete(c, me, near, kernel, sourceKind) {
  // Relocates the existing O1b scalar approximation. It is NOT a face-growth solver.
  const shadow = Math.min(0.15, near.reduce((sum, b) => {
    const r = me.reach+b.reach;
    return sum + (r-Math.hypot(...sub(b.center, me.center)))/r;
  }, 0)*0.10);
  const exposure = Math.min(0.32, c.exposureK+shadow);
  const native = kernel.faceSet('calcite', c.form.growthFrac, 0, c.form.biasC, exposure);
  const full = kernel.polyhedron(native);
  if (full.vertices.length < 4) throw Error('Degenerate calcite form; no primitive substitution');
  const extent = Math.max(...full.vertices.flat().map(Math.abs));
  const s = 0.5*c.cLengthMm/extent;
  const rotate = rotation(c.axis, c.yaw);
  const planes = native.map((f, index) => {
    const n = rotate(f.n);
    return { n, d: f.d*s+dot(n, me.center), kind: 'form', sourceIndex: index };
  });
  // Audit at matched physical scale. None of these volumes changes inventory.
  const fullVolumeMm3 = geometryVolume(full) * s**3;
  if (c.attachedFraction > 0) {
    const ys = full.vertices.map(v => v[1]);
    const ymin = Math.min(...ys), ymax = Math.max(...ys);
    const f = Math.max(0.05, Math.min(0.95, c.attachedFraction));
    const ycut = c.attachmentAtNucleus && ymin < 0 && ymax > 0 ? 0 : ymin+f*(ymax-ymin);
    const n = rotate([0,-1,0]);
    planes.push({ n, d: -ycut*s+dot(n, me.center), kind: 'attachment' });
  }
  const attachedVolumeMm3 = geometryVolume(kernel.polyhedron(planes));
  // Relocates O2's integrated-growth meeting-plane approximation using physical
  // dimensions, never visibility floors. Geometry remains procedural completion.
  for (const b of near) {
    const delta = sub(b.center, me.center), distance = Math.hypot(...delta);
    if (distance < 1e-3) continue;
    const n = scale(delta, 1/distance);
    const d = dot(n, me.center)+distance*me.growth/(me.growth+b.growth);
    planes.push({ n, d, kind: 'contact', neighborId: b.id });
  }
  const poly = kernel.polyhedron(planes);
  if (poly.vertices.length < 4 || poly.faces.length < 4) throw Error(`Empty completed crystal ${c.id}`);
  const sourceClass = sourceKind === 'live-model-capture' ? 'scientifically-resolved' : 'procedurally-completed';
  const authority = {
    identity: claim(sourceClass, sourceKind==='live-model-capture'?'captured model identity; not external validation':'authored test-fixture identity'),
    habit: claim('procedurally-completed', 'captured existing habit classifier at this step', 'Not a lifetime identity or a face-by-face growth solution; earlier frames retain their own input.'),
    dimensions: claim(sourceClass, 'Crystal.add_zone current dimensions; no visibility floor'),
    bookedVolume: claim(sourceClass, 'Crystal._volume_mm3 accepted-zone inventory'),
    zoneComposition: claim(sourceClass, 'captured GrowthZone values at this step', 'Composition records are not spatially resolved zoning surfaces.'),
    dissolution: claim(sourceClass, 'accepted negative zones and etch receipts; original model volume retreat', 'No resolved face retreat or dissolution microtopography is inferred.'),
    regrowth: claim(sourceClass, 'accepted positive zone after a negative zone', 'A historical outer envelope is not a surviving internal boundary.'),
    anchor: claim(sourceClass, 'captured physical anchor'),
    axis: claim('procedurally-completed', 'recorded substrate-normal/gravity/tilt orientation rule', 'Not a face-by-face crystallographic growth solution.'),
    yaw: claim('procedurally-completed', 'existing deterministic crystal-ID yaw'),
    formParameters: claim('procedurally-completed', 'captured _wulffForm calibrated envelope parameters; supporting integrals in facts.formation', 'Model-informed form completion, not integrated face-advance history.'),
    exposureIntegral: claim(sourceClass, 'captured _o1aExp; growth-weighted base/tip model supersaturation', 'Absent integrals use the existing zero-exposure default.'),
    surfaces: claim('procedurally-completed', 'js/46 Wulff envelope; js/99i O1b neighbor shadow', 'Single-envelope completion; does not integrate each face through time.'),
    contacts: claim('procedurally-completed', 'js/99i O2 integrated-growth meeting planes', 'Approximate contact placement, not simulated face arrest.'),
    attachment: claim('procedurally-completed', 'existing half-form attachment rule'),
    internalBoundaries: {...claim('procedurally-completed', 'none generated', 'Past envelopes are snapshots, not proof of surviving internal zones after dissolution.'),status:'unresolved'},
    inclusions: claim(sourceClass, 'captured enclosure relationships and receipts', 'Exact interior positions are unresolved and are not drawn.'),
  };
  return {
    id: c.id, facts: clone(c), authority,
    dependencies: near.map(b => b.id).sort((a,b) => a-b),
    completion: { planes, poly, volumeMm3: geometryVolume(poly), exposureK: exposure,
      volumeAudit: { fullVolumeMm3, attachedVolumeMm3,
        fullToBooked: fullVolumeMm3/c.bookedVolumeMm3,
        attachmentRetention: attachedVolumeMm3/fullVolumeMm3,
        contactRetention: geometryVolume(poly)/attachedVolumeMm3 },
      volumeIsMassAuthority: false, visibilityScale: 1 },
  };
}

export class SpecimenRecorder {
  constructor(kernel) { this.kernel=kernel; this.cache=new Map(); this.frames=[]; this.compilations=0; }
  capture(input) {
    validateInput(input);
    const owned = clone(input);
    owned.crystals.sort((a,b)=>a.id-b.id);
    const bodies=owned.crystals.map(body);
    const nextCache=new Map();
    const crystals=owned.crystals.map((c, index) => {
      const near=neighbors(bodies[index], bodies);
      const key=JSON.stringify([owned.source.kind,c,near]);
      const old=this.cache.get(c.id);
      if (old?.key === key) { nextCache.set(c.id,old); return old.record; }
      // Canonical JSON numbers (including +0 instead of -0) at the authority
      // boundary, so the first render and a save/load render have identical data.
      const record=freeze(clone({ ...complete(c,bodies[index],near,this.kernel,owned.source.kind), revision:(old?.record.revision||0)+1 }));
      nextCache.set(c.id,{key,record}); this.compilations++;
      return record;
    });
    this.cache=nextCache;
    const frame=freeze({ schema:SCHEMA, step:owned.step, source:owned.source, crystals });
    this.frames.push(frame);
    return frame;
  }
}

// Public record boundary: reject unsupported display transformations and bad
// geometry. No growth kernel is reachable from the rendering adapter.
export function validateFrame(frame) {
  if (frame?.schema !== SCHEMA || !Array.isArray(frame.crystals)) throw Error('Invalid specimen schema');
  validateInput({step:frame.step,source:frame.source,crystals:frame.crystals.map(c=>c.facts)});
  const ids=new Set();
  for (const c of frame.crystals) {
    if (c.id !== c.facts.id || ids.has(c.id) || !Number.isInteger(c.revision) || c.revision<1) throw Error('Invalid specimen identity');
    ids.add(c.id);
    if (c.completion?.visibilityScale !== 1 || c.completion?.volumeIsMassAuthority !== false) throw Error('Invalid specimen authority');
    if (c.authority?.surfaces?.classification !== 'procedurally-completed') throw Error('Unsupported surface authority');
    const {vertices,faces}=c.completion.poly;
    if (vertices.length<4 || faces.length<4) throw Error('Invalid specimen solid');
    vertices.forEach(v=>vector(v,'vertex'));
    for(const p of c.completion.planes){vector(p.n,'plane normal');finite(p.d,'plane distance');if(Math.abs(Math.hypot(...p.n)-1)>1e-6)throw Error('Invalid plane normal');}
    for(const v of vertices)for(const p of c.completion.planes)if(dot(v,p.n)>p.d+1.1e-6)throw Error('Vertex outside preserved boundary');
    const edges=new Map(),seenPlanes=new Set();
    for (const f of faces) {
      if (!Array.isArray(f.verts) || f.verts.length<3 || !c.completion.planes[f.plane]) throw Error('Invalid specimen face');
      if (f.verts.some(i=>!Number.isInteger(i)||i<0||i>=vertices.length)) throw Error('Invalid vertex reference');
      if(new Set(f.verts).size!==f.verts.length||seenPlanes.has(f.plane))throw Error('Duplicate specimen face/vertex');
      seenPlanes.add(f.plane);
      const p=c.completion.planes[f.plane];
      if(f.verts.some(i=>Math.abs(dot(vertices[i],p.n)-p.d)>1.1e-6))throw Error('Face does not lie on its preserved plane');
      const a=vertices[f.verts[0]],b=vertices[f.verts[1]],d=vertices[f.verts[2]];
      if(dot(cross(sub(b,a),sub(d,a)),p.n)<=0)throw Error('Invalid face winding');
      for(let i=0;i<f.verts.length;i++){
        const a=f.verts[i],b=f.verts[(i+1)%f.verts.length],key=[Math.min(a,b),Math.max(a,b)].join(':');
        const edge=edges.get(key)||{count:0,balance:0};edge.count++;edge.balance+=a<b?1:-1;edges.set(key,edge);
      }
    }
    if([...edges.values()].some(e=>e.count!==2||e.balance!==0))throw Error('Specimen surface is not closed');
    finite(c.completion.volumeMm3,'completed volume');
    if(Math.abs(geometryVolume(c.completion.poly)-c.completion.volumeMm3)>1e-7*Math.max(1,c.completion.volumeMm3))throw Error('Completed volume mismatch');
    const audit=c.completion.volumeAudit;
    if(!audit||['fullVolumeMm3','attachedVolumeMm3','fullToBooked','attachmentRetention','contactRetention'].some(k=>typeof audit[k]!=='number'||!Number.isFinite(audit[k])||audit[k]<=0))throw Error('Invalid volume factors');
    const tolerance=Math.max(1e-10,c.completion.volumeMm3*1e-8);
    if(audit.attachmentRetention>1+1e-8||audit.contactRetention>1+1e-8
      ||Math.abs(audit.fullVolumeMm3-c.facts.bookedVolumeMm3*audit.fullToBooked)>tolerance
      ||Math.abs(audit.attachedVolumeMm3-audit.fullVolumeMm3*audit.attachmentRetention)>tolerance
      ||Math.abs(c.completion.volumeMm3-audit.attachedVolumeMm3*audit.contactRetention)>tolerance)throw Error('Volume factor closure failed');
  }
  return frame;
}

export function tessellate(record, subdivision=0) {
  if (![0,1].includes(subdivision)) throw Error('Only exact planar subdivision is supported');
  const {vertices,faces}=record.completion.poly, positions=[], groups=[];
  function triangle(a,b,c,depth) {
    if (!depth) { positions.push(...a,...b,...c); return; }
    const ab=scale(add(a,b),.5), bc=scale(add(b,c),.5), ca=scale(add(c,a),.5);
    triangle(a,ab,ca,0); triangle(ab,b,bc,0); triangle(ca,bc,c,0); triangle(ab,bc,ca,0);
  }
  for (const f of faces) {
    const start=positions.length/3;
    for (let i=1;i<f.verts.length-1;i++) triangle(vertices[f.verts[0]],vertices[f.verts[i]],vertices[f.verts[i+1]],subdivision);
    groups.push({ start,count:positions.length/3-start,kind:record.completion.planes[f.plane].kind });
  }
  return {positions,groups};
}
