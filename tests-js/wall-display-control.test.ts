import {describe,expect,it,vi} from 'vitest';

declare const topoToggleWallDisplay: any;

// Exercise the compiled public handler with controlled scene owners. The
// normal harness exports values rather than a setter for its private let state.
function clickWall(state:any,flat:boolean,apply:any,rebuild:any,frame=vi.fn()){
  return new Function('_topoThreeState','_topoExactFlatPresentationActive',
    '_topoApplyWallDisplay','topoRender','_topoRenderFrame','document',
    `return (${topoToggleWallDisplay.toString()})();`)(state,flat,apply,rebuild,frame,document);
}

describe('wall display control with current viewers retained',()=>{
  it('cycles through the shared frame path without recommissioning or restarting at normal',()=>{
    const button=document.createElement('button');button.id='topo-wall-btn';document.body.appendChild(button);
    const scene={},camera={},render=vi.fn(),apply=vi.fn(),frame=vi.fn();
    const state={wallDisplay:0,cavity:{},scene,camera,renderer:{render}};
    const rebuild=vi.fn(()=>{state.wallDisplay=0;});
    try{
      for(const [mode,label] of [[1,'translucent'],[2,'hidden'],[0,'normal']] as const){
        expect(clickWall(state,false,apply,rebuild,frame)).toBe(true);
        expect(state.wallDisplay).toBe(mode);
        expect(button.dataset.wallDisplay).toBe(label);
        expect(button.getAttribute('aria-label')).toBe(`Vug wall display: ${label}`);
      }
      expect(apply).toHaveBeenCalledTimes(3);
      expect(frame.mock.calls).toEqual([[state],[state],[state]]);
      expect(render).not.toHaveBeenCalled(); // Never bypass specimen post-processing.
      expect(rebuild).not.toHaveBeenCalled();
    }finally{button.remove();}
  });

  it('leaves the existing flat presentation and scene state untouched',()=>{
    const render=vi.fn(),apply=vi.fn(),rebuild=vi.fn();
    const state={wallDisplay:2,cavity:{},scene:{},camera:{},renderer:{render}};
    expect(clickWall(state,true,apply,rebuild)).toBe(false);
    expect(state.wallDisplay).toBe(2);
    expect(apply).not.toHaveBeenCalled();expect(render).not.toHaveBeenCalled();expect(rebuild).not.toHaveBeenCalled();
  });

  it('does not mutate a missing, uninitialized, or rejected cavity',()=>{
    const apply=vi.fn(),rebuild=vi.fn(),frame=vi.fn();
    const uninitialized={wallDisplay:0},rejected={wallDisplay:0,cavity:{},threeShaderUnusable:true};
    for(const state of [null,uninitialized,rejected]){
      expect(clickWall(state,false,apply,rebuild,frame)).toBe(false);
      if(state)expect(state.wallDisplay).toBe(0);
    }
    expect(apply).not.toHaveBeenCalled();expect(rebuild).not.toHaveBeenCalled();expect(frame).not.toHaveBeenCalled();
  });
});
