import { tessellate, validateFrame } from './specimen.js';

// Disposable adapter. Receives only specimen records and a graphics library.
// Material color distinguishes contact surfaces; it does not claim trace color,
// fluorescence, or optically resolved compositional zones.
export class SpecimenView {
  constructor(THREE, group) { this.THREE=THREE; this.group=group; this.entries=new Map(); this.created=0; this.disposed=0; }
  sync(frame, {subdivision=0,wireframe=false}={}) {
    validateFrame(frame);
    if (![0,1].includes(subdivision)) throw Error('Unsupported subdivision');
    const alive=new Set();
    for (const c of frame.crystals) {
      alive.add(c.id);
      // Content key also protects against independent recordings reusing revisions.
      const key=JSON.stringify([c.completion,subdivision]);
      let entry=this.entries.get(c.id);
      if (entry?.key !== key) {
        if (entry) this.remove(c.id);
        const data=tessellate(c,subdivision), T=this.THREE;
        const geometry=new T.BufferGeometry();
        geometry.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));
        geometry.computeVertexNormals();
        data.groups.forEach(g=>geometry.addGroup(g.start,g.count,g.kind==='contact'?1:0));
        const materials=[
          new T.MeshStandardMaterial({color:0xe9d3b4,roughness:0.46,flatShading:true}),
          new T.MeshStandardMaterial({color:0x956d51,roughness:0.92,flatShading:true}),
        ];
        const mesh=new T.Mesh(geometry,materials);
        mesh.userData={crystalId:c.id};
        this.group.add(mesh);
        entry={key,mesh}; this.entries.set(c.id,entry); this.created++;
      }
      entry.mesh.material.forEach(m=>{m.wireframe=wireframe;});
    }
    for (const id of this.entries.keys()) if (!alive.has(id)) this.remove(id);
  }
  remove(id) {
    const entry=this.entries.get(id); if (!entry) return;
    this.group.remove(entry.mesh); entry.mesh.geometry.dispose();
    entry.mesh.material.forEach(m=>m.dispose());
    this.entries.delete(id); this.disposed++;
  }
  dispose() { for (const id of this.entries.keys()) this.remove(id); }
}
