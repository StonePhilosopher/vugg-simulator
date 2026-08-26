import { beforeEach, describe, expect, it, vi } from 'vitest';

declare function renderCollectedForMineral(name: string): string;
declare function loadCrystals(): any[];
declare function renameCollectedCrystal(id: string): void;
declare function playCollectedInGroove(id: string): void;
declare function groovePopulateCrystals(): void;
declare function grooveZonePlayerProseHTML(zone: any): string;
declare function _saveBuildLocalExport(): any;
declare function _saveLocalExportDigest(payload: any): string;
declare function _saveAssertLocalExport(payload: any): boolean;
declare function _saveApplyLocalExport(payload: any): boolean;
declare function _saveMaximumLocalImportBytes(): number;
declare function importVuggLocalDataFile(input: any): Promise<boolean>;
declare function assertCrystalCollectionRecord(record: any, label?: string): boolean;

const HOSTILE_NAME = `<img id="player-name-pwn" src=x onerror="globalThis.__playerNamePwned=1"> & \"quoted\" 'stone'`;

function specimen(name = HOSTILE_NAME) {
  return {
    id: 'cry-hostile-name',
    collected_at: '2026-08-26T12:00:00.000Z',
    name,
    mineral: 'topaz',
    source: {
      mode: 'Simulation', scenario: 'shigar_pegmatite', seed: 42,
      nucleation_step: 12, nucleation_temp: 410,
    },
    mm: 4.25,
    a_mm: 2.1,
    habit: 'prismatic',
    forms: ['prism'],
    twinned: false,
    zones: [{
      step: 12, temperature: 410, thickness_um: 4.25, growth_rate: 1,
      trace_Fe: 0, trace_Mn: 0, trace_Al: 0, trace_Ti: 0,
      fluid_inclusion: false, note: '', is_phantom: false,
    }],
    zone_count: 1,
    total_growth_um: 4.25,
  };
}

// Exact shape emitted by the first released per-crystal Library
// (87e0647e): `zones` was the retained count, not an array of zone records.
function legacyCountSpecimen(overrides: Record<string, any> = {}) {
  return {
    id: 'cry-legacy-zone-count',
    collected_at: '2026-07-13T12:00:00.000Z',
    name: 'Released legacy quartz',
    mineral: 'quartz',
    source: {
      mode: 'creative', scenario: 'cooling', archetype: null, seed: 42,
      nucleation_step: 1, nucleation_temp: 180,
    },
    mm: 3.25,
    a_mm: 1.5,
    habit: 'prismatic',
    forms: ['prism'],
    twinned: false,
    twin_law: null,
    position: 'wall',
    fluorescence: 'non-fluorescent',
    zones: 7,
    total_growth_um: 3250,
    radiation_damage: 0,
    ...overrides,
  };
}

function installGrooveSurface() {
  document.body.innerHTML = `
    <select id="groove-crystal-select"></select>
    <div id="groove-no-data"></div>
    <canvas id="groove-canvas" width="640" height="640"></canvas>
    <div id="groove-crystal-info"></div>
    <button id="groove-play-btn"></button>
  `;
  const canvas = document.getElementById('groove-canvas') as HTMLCanvasElement;
  const noop = () => {};
  (canvas as any).getContext = () => new Proxy({
    fillRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop,
    arc: noop, fill: noop, save: noop, restore: noop, translate: noop,
    rotate: noop, closePath: noop, fillText: noop, setLineDash: noop,
    measureText: () => ({ width: 0 }),
  }, { get: (target, key) => (target as any)[key] ?? noop });
}

describe('player-owned collection names', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    delete (globalThis as any).__playerNamePwned;
    localStorage.setItem('vugg-crystals-v1', JSON.stringify([specimen()]));
  });

  it('persists the exact name but Library renders it only as text', () => {
    const holder = document.createElement('div');
    holder.innerHTML = renderCollectedForMineral('topaz');
    document.body.appendChild(holder);

    const rendered = holder.querySelector('.collected-name') as HTMLElement;
    expect(loadCrystals()[0].name).toBe(HOSTILE_NAME);
    expect(rendered.textContent).toBe(HOSTILE_NAME);
    expect(rendered.title).toBe(HOSTILE_NAME);
    expect(Array.from(holder.getElementsByTagName('img')).some(img => img.id === 'player-name-pwn')).toBe(false);
    expect((globalThis as any).__playerNamePwned).toBeUndefined();
  });

  it('keeps a hostile Rename exact across reload without creating Library DOM', () => {
    localStorage.setItem('vugg-crystals-v1', JSON.stringify([specimen('Before')]));
    const promptSpy = vi.spyOn(globalThis, 'prompt').mockReturnValue(HOSTILE_NAME);
    renameCollectedCrystal('cry-hostile-name');
    promptSpy.mockRestore();

    const reloaded = JSON.parse(localStorage.getItem('vugg-crystals-v1') || '[]');
    const holder = document.createElement('div');
    holder.innerHTML = renderCollectedForMineral('topaz');
    expect(reloaded[0].name).toBe(HOSTILE_NAME);
    expect(holder.querySelector('.collected-name')?.textContent).toBe(HOSTILE_NAME);
    expect(Array.from(holder.getElementsByTagName('img')).some(img => img.id === 'player-name-pwn')).toBe(false);
  });

  it('renders the persisted name as text in Record Groove', () => {
    installGrooveSurface();
    playCollectedInGroove('cry-hostile-name');
    groovePopulateCrystals();

    const info = document.getElementById('groove-crystal-info')!;
    expect(info.querySelector('.groove-library-name')?.textContent).toBe(`“${HOSTILE_NAME}”`);
    expect(info.getElementsByTagName('img')).toHaveLength(0);
    expect((globalThis as any).__playerNamePwned).toBeUndefined();
  });

  it('keeps every imported specimen prose field inert in Library and Record Groove', () => {
    const imported = specimen('Imported specimen');
    imported.habit = HOSTILE_NAME;
    imported.twinned = true;
    (imported as any).twin_law = HOSTILE_NAME;
    imported.source.scenario = HOSTILE_NAME;
    imported.zones[0].note = HOSTILE_NAME;
    imported.zones[0].fluid_inclusion = true;
    imported.zones[0].inclusion_type = HOSTILE_NAME;
    localStorage.setItem('vugg-crystals-v1', JSON.stringify([imported]));

    const holder = document.createElement('div');
    holder.innerHTML = renderCollectedForMineral('topaz');
    document.body.appendChild(holder);
    expect(holder.querySelector('.collected-row-meta')?.textContent).toContain(HOSTILE_NAME);
    expect(Array.from(holder.getElementsByTagName('img')).some(img => img.id === 'player-name-pwn')).toBe(false);

    installGrooveSurface();
    playCollectedInGroove('cry-hostile-name');
    groovePopulateCrystals();
    const info = document.getElementById('groove-crystal-info')!;
    expect(info.textContent).toContain(HOSTILE_NAME);
    expect(Array.from(info.getElementsByTagName('img')).some(img => img.id === 'player-name-pwn')).toBe(false);
    // Both Groove hover surfaces consume this one shared imported-prose
    // boundary; exercise the exact output independently of canvas geometry.
    const tooltip = document.createElement('div');
    tooltip.innerHTML = grooveZonePlayerProseHTML(imported.zones[0]);
    expect(tooltip.textContent).toContain(HOSTILE_NAME);
    expect(tooltip.querySelector('#player-name-pwn')).toBeNull();
    expect((globalThis as any).__playerNamePwned).toBeUndefined();
  });

  it('rejects a self-rehashed backup whose specimen id could own an inline action', () => {
    const payload = _saveBuildLocalExport();
    payload.storage['vugg-crystals-v1'] = JSON.stringify([{
      ...specimen('Imported specimen'),
      id: 'cry-bad\") ; globalThis.__playerNamePwned=1; //',
    }]);
    payload.backup_sha256 = _saveLocalExportDigest(payload);
    expect(() => _saveAssertLocalExport(payload)).toThrow(/invalid specimen id/);
    expect((globalThis as any).__playerNamePwned).toBeUndefined();
  });

  it('rejects an oversized local backup before allocating its text', async () => {
    const text = vi.fn().mockResolvedValue('{}');
    const input = {
      files: [{ size: _saveMaximumLocalImportBytes() + 1, text }],
      value: 'oversized.json',
    };
    await expect(importVuggLocalDataFile(input)).resolves.toBe(false);
    expect(text).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('keeps released numeric zone-count specimens visible and backup-portable without inventing Groove layers', () => {
    const legacy = legacyCountSpecimen();
    localStorage.setItem('vugg-crystals-v1', JSON.stringify([legacy]));

    expect(loadCrystals()).toEqual([legacy]);
    const holder = document.createElement('div');
    holder.innerHTML = renderCollectedForMineral('quartz');
    expect(holder.querySelector('.collected-row-meta')?.textContent).toContain('7 zones');
    expect(holder.querySelector('.collected-row-actions button')?.hasAttribute('disabled')).toBe(true);

    const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
    playCollectedInGroove(legacy.id);
    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/before zone data was saved/i));
    alertSpy.mockRestore();

    const backup = _saveBuildLocalExport();
    expect(_saveAssertLocalExport(backup)).toBe(true);
    localStorage.setItem('vugg-crystals-v1', '[]');
    expect(_saveApplyLocalExport(backup)).toBe(true);
    expect(loadCrystals()).toEqual([legacy]);
  });

  it('rejects malformed numeric legacy zone counts and inconsistent aliases', () => {
    for (const zones of [-1, 1.5, 10_001, '7', null]) {
      expect(() => assertCrystalCollectionRecord(legacyCountSpecimen({ zones })))
        .toThrow(/invalid growth zones/i);
    }
    expect(() => assertCrystalCollectionRecord(legacyCountSpecimen({ zone_count: 6 })))
      .toThrow(/inconsistent zone count/i);
  });
});
