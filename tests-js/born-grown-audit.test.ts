import {beforeAll, afterAll, describe, expect, it} from 'vitest';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, realpathSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname, basename} from 'node:path';
import {execFileSync} from 'node:child_process';

// Exercise the real measurement CLI with synthetic crystals, not a science run.
const samples = [['below_micro',0.09996],['at_micro',0.1],['below_eye',0.99996],['at_eye',1],['above_eye',1.00001]] as const;
let root: string;
let first: any, relabelled: any, changedBaseline: any, runtimeOne: any, runtimeTwo: any;
let initialRows: string, roleRows: string, baselineRows: string, initialText: string;
const report = () => JSON.parse(readFileSync(join(root,'.local-evidence/born-grown-audit/report.json'),'utf8'));
const rows = () => readFileSync(join(root,'.local-evidence/born-grown-audit/runs.jsonl'),'utf8');

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(),'vugg-born-grown-probe-'));
  for(const dir of ['tools','dist','data','tests-js/baselines'])mkdirSync(join(root,dir),{recursive:true});
  writeFileSync(join(root,'tools/born-grown-audit.mjs'),readFileSync(join(process.cwd(),'tools/born-grown-audit.mjs')));
  writeFileSync(join(root,'package-lock.json'),JSON.stringify({name:'synthetic-measurement-fixture',lockfileVersion:3,packages:{}}));
  writeFileSync(join(root,'tools/_harness.mjs'),`
const samples=${JSON.stringify(samples)};
class Crystal {
  constructor(id,mineral,length){Object.assign(this,{crystal_id:id,mineral,c_length_mm:length,a_width_mm:0,total_growth_um:0,zones:[],active:true,dissolved:false});}
  add_zone(zone){this.zones.push(zone);this.total_growth_um+=zone.thickness_um;}
}
class VugSimulator {
  constructor(){this.crystals=[];this.step=0;this.log=[];for(const [name,length] of samples)this.nucleate(name,length);}
  nucleate(name,length){const c=new Crystal(this.crystals.length+1,name,length);this.crystals.push(c);return c;}
  _runEngineForCrystal(engine,crystal){return engine(crystal);}
  _dryRunEngineForCrystal(engine,crystal){return engine(crystal);}
  run_step(){this.step++;for(const c of this.crystals)c.add_zone(this._runEngineForCrystal(()=>({thickness_um:1}),c));}
}
const probe=Object.assign(()=>({conditions:{},events:[],defaultSteps:1}),{_json5_spec:{expects_species:samples.map(([name])=>name)}});
export async function loadSimBundle(){return {Crystal,VugSimulator,SCENARIOS:{probe},setSeed(){},SIM_VERSION:286,MODEL_DIGEST:'synthetic-measurement-fixture-not-science'};}
`);
  const baselinePath=join(root,'tests-js/baselines/seed42_v286.json');
  const baseline:any={probe:Object.fromEntries(samples.map(([name])=>name).sort().map(name=>[name,{active:1,dissolved:0,total:1,max_um:1}]))};
  writeFileSync(baselinePath,JSON.stringify(baseline));
  const targets=join(root,'roles.json');
  writeFileSync(targets,JSON.stringify({schema:'vugg-story-pocket-targets-v1',scenarios:{}}));
  const invoke=(extra:string[]=[],env=process.env)=>execFileSync(process.execPath,
    ['--max-old-space-size=128',...extra,join(root,'tools/born-grown-audit.mjs'),'probe','--story-targets',targets],
    {cwd:root,encoding:'utf8',windowsHide:true,timeout:15_000,env});
  // --fresh is an audit argument, not a Node argument.
  execFileSync(process.execPath,['--max-old-space-size=128',join(root,'tools/born-grown-audit.mjs'),'probe','--fresh','--story-targets',targets],
    {cwd:root,encoding:'utf8',windowsHide:true,timeout:15_000});
  first=report();initialRows=rows();initialText=readFileSync(join(root,'.local-evidence/born-grown-audit/report.md'),'utf8');
  writeFileSync(targets,JSON.stringify({schema:'vugg-story-pocket-targets-v1',scenarios:{probe:{species:{below_micro:{role:'companion'}}}}}));
  invoke();relabelled=report();roleRows=rows();
  baseline.probe.below_micro.total=99;writeFileSync(baselinePath,JSON.stringify(baseline));
  invoke();changedBaseline=report();baselineRows=rows();
  const preload=join(root,'test-reported-runtime.cjs');
  writeFileSync(preload,"// Synthetic label override only; the real engine stays unchanged.\nObject.defineProperty(process,'version',{value:process.env.VUGG_TEST_REPORTED_NODE});\n");
  invoke(['--require',preload],{...process.env,VUGG_TEST_REPORTED_NODE:'v0.0.1-synthetic-fixture'});runtimeOne=report();
  invoke(['--require',preload],{...process.env,VUGG_TEST_REPORTED_NODE:'v0.0.2-synthetic-fixture'});runtimeTwo=report();
},30_000);

afterAll(() => {
  if(!root)return;
  const target=realpathSync(root),base=realpathSync(tmpdir());
  if(dirname(target)!==base||!basename(target).startsWith('vugg-born-grown-probe-'))throw Error('Refusing cleanup outside the owned fixture directory');
  rmSync(target,{recursive:true,force:true});
});

describe('born/grown measurement boundaries', () => {
  it.each([
    ['below_micro','dust','grown, not visible'],['at_micro','>=0.1 mm','grown, under 1 mm'],
    ['below_eye','>=0.1 mm','grown, under 1 mm'],['at_eye','>=1 mm','visible'],['above_eye','>=1 mm','visible'],
  ])('%s uses the raw length for its tier', (mineral,visible,status) => {
    const entry=first.entries.find((e:any)=>e.mineral===mineral);
    expect(entry).toMatchObject({visible,status,max_mm:samples.find(([name])=>name===mineral)![1]});
    expect(first.integrity.capture_errors).toEqual([]);
  });
  it('marks rounded human-readable lengths as approximate', () => {
    expect(initialText).toContain('≈0.100');expect(initialText).toContain('≈1.000');
  });
  it('refreshes external roles without rerunning unchanged physical rows', () => {
    expect(relabelled.inputs).toBe(first.inputs);expect(roleRows).toBe(initialRows);
    expect(relabelled.story_roles.sha256).not.toBe(first.story_roles.sha256);
    expect(relabelled.entries.find((e:any)=>e.mineral==='below_micro').role).toBe('companion');
  });
  it('cannot inherit a green comparison after the reference baseline changes', () => {
    expect(first.integrity.baseline.reproduced).toBe(1);
    expect(changedBaseline.inputs).not.toBe(first.inputs);expect(baselineRows).not.toBe(roleRows);
    expect(changedBaseline.integrity.baseline).toMatchObject({reproduced:0,differs:['probe@42']});
  });
  it('binds cached measurements to the reported runtime formation', () => {
    // Deliberately synthetic labels test cache plumbing, not another real Node engine.
    expect(runtimeOne.inputs).not.toBe(runtimeTwo.inputs);
    expect(runtimeOne.runtime.node).toBe('v0.0.1-synthetic-fixture');
    expect(runtimeTwo.runtime.node).toBe('v0.0.2-synthetic-fixture');
    expect(first.runtime).toMatchObject({node:process.version,v8:process.versions.v8,icu:process.versions.icu,
      platform:process.platform,arch:process.arch,locale:Intl.DateTimeFormat().resolvedOptions().locale});
  });
});
