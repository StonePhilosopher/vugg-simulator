import { describe, expect, it, vi } from 'vitest';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const setSeed: any;
declare const CavityWaterAppearance: any;
declare const CavityEvolutionLedger: any;
declare const _topoCavityFieldCrossSectionReceipt: any;
declare const _topoRenderCavityFieldCrossSection: any;
declare const _topoCavityFieldFlatRequested: any;
declare const _topoInitThree: any;
declare const _topoPanMouseDown: any;
declare const _topoWheelFromEvent: any;
declare const _topoSyncFlatPresentationControls: any;
declare const _topoSyncThreeButtonState: any;
declare const _topoThreeRendererEffective: any;
declare const fortressBeginFromScenario: any;
declare const fortressReset: any;
declare const helixOverlayEnabled: any;
declare const topoCycleSlice: any;
declare const helixSetOverlayEnabled: any;
declare const topoRecenter: any;
declare const topoRender: any;
declare const topoSetDragMode: any;
declare const topoSetThreeRendererEnabled: any;
declare const topoToggleWallDisplay: any;
declare const topoZoom: any;
declare const showTitleScreen: any;
declare const switchMode: any;

function activeFixture() {
  setSeed(42);
  const { conditions, events } = SCENARIOS.amethyst_geode();
  const sim = new VugSimulator(conditions, events);
  sim.wall_state.activateCavitySurfaceAnchorProvider({ resolution: 20 });
  const active = sim.wall_state.activeCavitySurfaceAnchorProvider();
  const appearance = CavityWaterAppearance.create(
    sim.wall_state, sim.conditions, { sim, activeProvider: active },
  ).receipt;
  return { sim, active, appearance };
}

function mountTopoChrome() {
  const root = document.createElement('div');
  root.dataset.tutorialTest = 'cavity-field-controls';
  root.innerHTML = `
    <div class="topo-zoom-ctrls"><button id="topo-zoom-in">+</button></div>
    <div class="topo-slice-ctrls"><button id="topo-slice-next">next</button></div>
    <div class="topo-camera-ctrls">
      <button id="topo-rotate-btn">rotate</button>
      <button id="topo-pan-btn">pan</button>
      <button id="topo-recenter-btn">center</button>
      <button id="topo-wall-btn">wall</button>
      <button id="topo-three-btn">three</button>
      <button id="helix-overlay-btn">helix</button>
    </div>
    <canvas id="topo-canvas"></canvas>
    <canvas id="topo-canvas-three"></canvas>
    <div id="topo-panel"></div>
    <div id="helix-legend"></div>`;
  document.body.appendChild(root);
  const flat = root.querySelector('#topo-canvas') as HTMLCanvasElement;
  Object.defineProperty(flat, 'clientWidth', { configurable: true, value: 420 });
  Object.defineProperty(flat, 'clientHeight', { configurable: true, value: 300 });
  return {
    root,
    button: root.querySelector('#topo-three-btn') as HTMLButtonElement,
    flat,
    mesh: root.querySelector('#topo-canvas-three') as HTMLCanvasElement,
    slices: root.querySelector('.topo-slice-ctrls') as HTMLElement,
    zoom: root.querySelector('.topo-zoom-ctrls') as HTMLElement,
    camera: root.querySelector('.topo-camera-ctrls') as HTMLElement,
    panel: root.querySelector('#topo-panel') as HTMLElement,
    helix: root.querySelector('#helix-overlay-btn') as HTMLButtonElement,
    legend: root.querySelector('#helix-legend') as HTMLElement,
  };
}

function canvasContext(canvas: HTMLCanvasElement): any {
  return {
    canvas,
    setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(),
    strokeRect: vi.fn(), fillText: vi.fn(), save: vi.fn(), restore: vi.fn(),
    measureText: vi.fn((text: string) => ({
      width: text.length * 6,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
    })),
    fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '',
    textBaseline: '',
  };
}

describe('capability-independent Cartesian cavity cross-section', () => {
  it('honors the visible renderer toggle and selects the exact flat product', () => {
    const { active } = activeFixture();
    const { root, button, flat, mesh } = mountTopoChrome();

    try {
      topoSetThreeRendererEnabled(true, false);
      expect(_topoThreeRendererEffective({ cavityAuthorityActive: true })).toBe(true);
      expect(_topoCavityFieldFlatRequested(active)).toBe(false);
      expect(button.title).toMatch(/flat cavity cross-section/i);

      topoSetThreeRendererEnabled(false, false);
      expect(_topoThreeRendererEffective({ cavityAuthorityActive: true })).toBe(false);
      expect(_topoCavityFieldFlatRequested(active)).toBe(true);
      expect(mesh.style.display).toBe('none');
      expect(flat.style.visibility).toBe('');
      expect(button.getAttribute('aria-pressed')).toBe('false');
      expect(button.title).toMatch(/3D cavity mesh/i);
      expect(document.body.classList.contains('topo-view-3d')).toBe(false);

      const savedThree = (globalThis as any).THREE;
      try {
        delete (globalThis as any).THREE;
        expect(_topoThreeRendererEffective({ cavityAuthorityActive: true })).toBe(false);
      } finally {
        (globalThis as any).THREE = savedThree;
      }
    } finally {
      topoSetThreeRendererEnabled(true, false);
      root.remove();
    }
  });

  it('fails visibly to the flat route when WebGL construction throws', () => {
    const canvas = document.createElement('canvas');
    const { root, button } = mountTopoChrome();
    const savedThree = (globalThis as any).THREE;
    (globalThis as any).THREE = {
      ...savedThree,
      WebGLRenderer: class {
        constructor() { throw new Error('hostile WebGL initialization failure'); }
      },
    };
    try {
      expect(_topoInitThree(canvas)).toBeNull();
      expect(_topoThreeRendererEffective({ cavityAuthorityActive: true })).toBe(false);
      _topoSyncThreeButtonState();
      expect(button.getAttribute('aria-pressed')).toBe('false');
      expect(button.disabled).toBe(false);
      expect(button.title).toMatch(/Show 3D cavity mesh/i);
    } finally {
      (globalThis as any).THREE = savedThree;
      // An explicit retry clears the failed attempt; the production renderer
      // will then re-probe the restored implementation on its next render.
      topoSetThreeRendererEnabled(true, false);
      root.remove();
    }
  });

  it('refuses dead camera, zoom, ring, wall, and pointer controls only in exact flat mode', () => {
    const { root, slices, zoom, camera } = mountTopoChrome();
    const originals = new Map([...camera.querySelectorAll('button')].map(button => [
      button, { disabled: button.disabled, title: button.title },
    ]));
    try {
      _topoSyncFlatPresentationControls(true);
      expect(slices.style.display).toBe('none');
      expect(zoom.style.display).toBe('none');
      const inactive = [...camera.querySelectorAll('button')]
        .filter(button => button.id !== 'topo-three-btn') as HTMLButtonElement[];
      expect(inactive.every(button => button.disabled)).toBe(true);
      expect((camera.querySelector('#topo-three-btn') as HTMLButtonElement).disabled)
        .toBe(false);
      expect(topoZoom(1)).toBe(false);
      expect(topoCycleSlice(1)).toBe(false);
      expect(topoSetDragMode('rotate')).toBe(false);
      expect(topoRecenter()).toBe(false);
      expect(topoToggleWallDisplay()).toBe(false);
      expect(helixSetOverlayEnabled(true, false)).toBe(false);
      const pointer = { button: 0, preventDefault: vi.fn() };
      _topoPanMouseDown(pointer);
      expect(pointer.preventDefault).not.toHaveBeenCalled();

      _topoSyncFlatPresentationControls(false);
      expect(slices.style.display).toBe('');
      expect(zoom.style.display).toBe('');
      expect(inactive.every(button => button.disabled === originals.get(button)?.disabled))
        .toBe(true);
      expect(inactive.every(button => button.title === originals.get(button)?.title)).toBe(true);
    } finally {
      _topoSyncFlatPresentationControls(false);
      root.remove();
    }
  });

  it('tears down the exact flat product on Home and corrupt replay exits', () => {
    const { root, flat, panel, slices, zoom, camera } = mountTopoChrome();
    vi.spyOn(flat, 'getContext').mockReturnValue(canvasContext(flat));
    try {
      _topoSyncFlatPresentationControls(true);
      (flat as any)._cavityFieldCrossSectionReceipt = { stale: 'home' };
      (flat as any)._cavityFieldCrossSectionLayout = { stale: 'home' };
      panel.style.display = 'none';
      topoRender();
      expect(slices.style.display).toBe('');
      expect(zoom.style.display).toBe('');
      expect([...camera.querySelectorAll('button')]
        .every((button: HTMLButtonElement) => !button.disabled)).toBe(true);
      expect((flat as any)._cavityFieldCrossSectionReceipt).toBeUndefined();
      expect((flat as any)._cavityFieldCrossSectionLayout).toBeUndefined();

      _topoSyncFlatPresentationControls(true);
      (flat as any)._cavityFieldCrossSectionReceipt = { stale: 'replay' };
      (flat as any)._cavityFieldCrossSectionLayout = { stale: 'replay' };
      panel.style.display = 'block';
      fortressReset();
      showTitleScreen();
      panel.style.display = 'block';
      topoRender({ step: 1, rings: [] });
      expect(slices.style.display).toBe('');
      expect(zoom.style.display).toBe('');
      expect((flat as any)._cavityFieldCrossSectionReceipt).toBeUndefined();
      expect((flat as any)._cavityFieldCrossSectionLayout).toBeUndefined();
    } finally {
      _topoSyncFlatPresentationControls(false);
      root.remove();
    }
  });

  it('cancels an in-flight 3D drag and leaves the page wheel untouched in flat mode', () => {
    const { root, flat } = mountTopoChrome();
    try {
      _topoSyncFlatPresentationControls(false);
      _topoPanMouseDown({
        button: 0, clientX: 10, clientY: 10, preventDefault: vi.fn(),
      });
      _topoSyncFlatPresentationControls(true);
      const move = new Event('pointermove') as any;
      Object.defineProperties(move, {
        clientX: { value: 80 }, clientY: { value: 80 },
      });
      document.dispatchEvent(move);
      expect(flat.style.cursor).toBe('');

      const wheel = { deltaY: -1, preventDefault: vi.fn() };
      expect(_topoWheelFromEvent(wheel)).toBe(false);
      expect(wheel.preventDefault).not.toHaveBeenCalled();
    } finally {
      _topoSyncFlatPresentationControls(false);
      root.remove();
    }
  });

  it('forces an active Helicoid off before accepting a WebGL-failure CPU slice', () => {
    const { root, flat, panel, helix, legend } = mountTopoChrome();
    vi.spyOn(flat, 'getContext').mockReturnValue(canvasContext(flat));
    const savedThree = (globalThis as any).THREE;
    try {
      switchMode('fortress');
      panel.style.display = 'none';
      const launch = fortressBeginFromScenario('amethyst_geode', 28501);
      launch.sim.wall_state.activateCavitySurfaceAnchorProvider({ resolution: 20 });
      topoSetThreeRendererEnabled(true, false);
      expect(helixSetOverlayEnabled(true, false)).toBe(true);
      expect(helixOverlayEnabled()).toBe(true);

      (globalThis as any).THREE = {
        ...savedThree,
        WebGLRenderer: class {
          constructor() { throw new Error('hostile fallback failure'); }
        },
      };
      panel.style.display = 'block';
      topoRender();
      expect((flat as any)._cavityFieldCrossSectionReceipt?.schema)
        .toBe('cavity-field-cross-section-v1');
      expect(helixOverlayEnabled()).toBe(false);
      expect(helix.getAttribute('aria-pressed')).toBe('false');
      expect(legend.style.display).toBe('none');
    } finally {
      (globalThis as any).THREE = savedThree;
      fortressReset();
      _topoSyncFlatPresentationControls(false);
      topoSetThreeRendererEnabled(true, false);
      root.remove();
    }
  });

  it('binds the CPU fallback to the exact field, surface, evolution, and water receipt', () => {
    const { sim, active, appearance } = activeFixture();
    const receipt = _topoCavityFieldCrossSectionReceipt(
      active, appearance, sim.wall_state, sim.conditions, sim,
    );
    expect(receipt.schema).toBe('cavity-field-cross-section-v1');
    expect(receipt.presentation).toContain('cpu-sampled-cross-section');
    expect(receipt.field_signature).toBe(active.field.sig);
    expect(receipt.field_snapshot_digest).toBe(active.field.snapshotDigest);
    expect(receipt.surface_signature).toBe(active.surface.sig);
    expect(receipt.surface_buffer_digest).toBe(active.surface.buffer_digest);
    expect(receipt.appearance_digest).toBe(appearance.appearance_digest);
    expect(receipt.appearance_source_geometry_digest)
      .toBe(active.receipt.surface_buffer_digest);
    expect(receipt.water_plane_y_mm).toBeNull();
    expect(receipt.crystal_policy).toMatch(/withheld/);
    const payload = CavityEvolutionLedger._clone(receipt);
    const digest = payload.receipt_digest;
    delete payload.receipt_digest;
    expect(digest).toBe(CavityEvolutionLedger.digest(payload));
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(() => _topoCavityFieldCrossSectionReceipt({
      ...active,
      receipt: { ...active.receipt, field_snapshot_digest: 'forged' },
    }, appearance, sim.wall_state, sim.conditions, sim))
      .toThrow(/exact current active provider/i);

    const other = activeFixture();
    expect(() => _topoCavityFieldCrossSectionReceipt(
      other.active, other.appearance, sim.wall_state, sim.conditions, sim,
    )).toThrow(/exact current active provider/i);

    const alteredReceipt = Object.freeze({
      ...active.receipt,
      cavity_evolution_signature: 'forged-evolution',
      production_contract_digest: 'forged-production-contract',
    });
    const alteredProvider = Object.freeze({
      field: active.field, surface: active.surface, receipt: alteredReceipt,
    });
    const alteredAppearance = CavityWaterAppearance.create(
      sim.wall_state, sim.conditions,
      { sim, activeProvider: alteredProvider, providerReceipt: alteredReceipt,
        surface: active.surface },
    ).receipt;
    expect(() => _topoCavityFieldCrossSectionReceipt(
      alteredProvider, alteredAppearance, sim.wall_state, sim.conditions, sim,
    )).toThrow(/exact current active provider/i);

    const nonfinitePlane = CavityEvolutionLedger._clone(appearance);
    nonfinitePlane.water_plane_y_mm = Number.POSITIVE_INFINITY;
    expect(() => _topoCavityFieldCrossSectionReceipt(
      active, nonfinitePlane, sim.wall_state, sim.conditions, sim,
    )).toThrow(/digest mismatch|non-finite/i);

    const forgedPlane = CavityEvolutionLedger._clone(appearance);
    forgedPlane.water_plane_y_mm = 1e12;
    delete forgedPlane.appearance_digest;
    forgedPlane.appearance_digest = CavityEvolutionLedger.digest(forgedPlane);
    expect(() => _topoCavityFieldCrossSectionReceipt(
      active, forgedPlane, sim.wall_state, sim.conditions, sim,
    )).toThrow(/appearance differs/i);

    const staleAppearance = appearance;
    sim.conditions.fluid_surface_height_mm = 5;
    expect(() => _topoCavityFieldCrossSectionReceipt(
      active, staleAppearance, sim.wall_state, sim.conditions, sim,
    )).toThrow(/appearance differs/i);

  });

  it('draws sampled field voxels and labels withheld crystals without WebGL', () => {
    const { sim, active, appearance } = activeFixture();
    const fillRect = vi.fn();
    const fillText = vi.fn();
    const canvas: any = {};
    const ctx: any = {
      canvas,
      fillRect,
      fillText,
      strokeRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '',
    };
    expect(_topoRenderCavityFieldCrossSection(
      ctx, 420, 300, active, appearance,
      sim.wall_state, sim.conditions, sim,
    )).toBe(true);
    expect(fillRect.mock.calls.length).toBeGreaterThan(
      active.field.sizeX * active.field.sizeY,
    );
    expect(fillText.mock.calls.some((call: any[]) => /Authenticated z=/.test(call[0])))
      .toBe(true);
    expect(fillText.mock.calls.some((call: any[]) => /crystals withheld/i.test(call[0])))
      .toBe(true);
    expect(canvas._cavityFieldCrossSectionReceipt.field_snapshot_digest)
      .toBe(active.field.snapshotDigest);
    expect(canvas._cavityFieldCrossSectionLayout).toMatchObject({
      schema: 'cavity-field-cross-section-layout-v1',
      canvas_dimensions_px: [420, 300],
      visible_bounds_px: [105, 75, 315, 225],
      plot_inside_visible_bounds: true,
      labels_inside_visible_bounds: true,
    });
    const [visibleLeft, visibleTop, visibleRight, visibleBottom] =
      canvas._cavityFieldCrossSectionLayout.visible_bounds_px;
    expect(canvas._cavityFieldCrossSectionLayout.label_bounds_px.every(
      ([x0, y0, x1, y1]: number[]) => x0 >= visibleLeft && y0 >= visibleTop
        && x1 <= visibleRight && y1 <= visibleBottom,
    )).toBe(true);
  });

  it('wraps both disclosures inside a narrow visible cross-section', () => {
    const { sim, active, appearance } = activeFixture();
    const canvas: any = {};
    const ctx: any = {
      canvas,
      fillRect: vi.fn(), fillText: vi.fn(), strokeRect: vi.fn(),
      save: vi.fn(), restore: vi.fn(),
      measureText: vi.fn((text: string) => ({
        width: text.length * 6,
        actualBoundingBoxAscent: 8,
        actualBoundingBoxDescent: 2,
      })),
      fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '',
      textBaseline: '',
    };
    expect(_topoRenderCavityFieldCrossSection(
      ctx, 240, 260, active, appearance,
      sim.wall_state, sim.conditions, sim,
    )).toBe(true);
    const layout = canvas._cavityFieldCrossSectionLayout;
    expect(layout.label_bounds_px.length).toBeGreaterThan(2);
    expect(layout.labels_inside_visible_bounds).toBe(true);
    expect(layout.plot_inside_visible_bounds).toBe(true);
  });
});
