// tests-js/music.test.ts — background music engine (js/08-music.ts) +
// settings persistence. jsdom is deaf (no real playback), so these pin
// the LOGIC: the boss's room→song map, the settings round-trip, and the
// clamps. Actual audibility needs a human ear on a live deploy (the
// 9th-catch rule: a probe verifies the code, not the channel).

import './setup';
import { describe, it, expect, beforeEach } from 'vitest';

declare const musicTrackForContext: (ctx: string) => string | null;
declare const musicGetSettings: () => { enabled: boolean, volume: number };
declare const musicSetEnabled: (on: boolean) => void;
declare const musicSetVolume: (v: number) => void;
declare const musicSetContext: (ctx: string) => void;

describe('music — the room→song map (boss directive 2026-06-09)', () => {
  it('title-family screens hear "Vugg Simulator.mp3"', () => {
    expect(musicTrackForContext('title')).toBe('Vugg Simulator.mp3');
  });

  it('building rooms (wall preview / library / record mode) hear "salt-circuit.mp3"', () => {
    expect(musicTrackForContext('building')).toBe('salt-circuit.mp3');
  });

  it('strip view is SILENT — the sonifier owns that room', () => {
    expect(musicTrackForContext('silent')).toBeNull();
  });

  it('unknown contexts fail silent, not loud', () => {
    expect(musicTrackForContext('nonsense')).toBeNull();
    expect(musicTrackForContext('')).toBeNull();
  });
});

describe('music — settings persistence (vugg-settings-v1)', () => {
  beforeEach(() => {
    localStorage.removeItem('vugg-settings-v1');
  });

  it('defaults: enabled, volume 0.5', () => {
    const s = musicGetSettings();
    expect(s.enabled).toBe(true);
    expect(s.volume).toBe(0.5);
  });

  it('disable round-trips through localStorage', () => {
    musicSetEnabled(false);
    expect(musicGetSettings().enabled).toBe(false);
    const raw = JSON.parse(localStorage.getItem('vugg-settings-v1')!);
    expect(raw.music.enabled).toBe(false);
    musicSetEnabled(true);
    expect(musicGetSettings().enabled).toBe(true);
  });

  it('volume round-trips and clamps to [0, 1]', () => {
    musicSetVolume(0.8);
    expect(musicGetSettings().volume).toBe(0.8);
    musicSetVolume(3.5);
    expect(musicGetSettings().volume).toBe(1);
    musicSetVolume(-2);
    expect(musicGetSettings().volume).toBe(0);
  });

  it('settings key is a shared ROOT — music sits beside future groups', () => {
    // Another settings group must survive a music write untouched.
    localStorage.setItem('vugg-settings-v1', JSON.stringify({ display: { fontScale: 1.2 } }));
    musicSetVolume(0.3);
    const raw = JSON.parse(localStorage.getItem('vugg-settings-v1')!);
    expect(raw.display.fontScale).toBe(1.2);
    expect(raw.music.volume).toBe(0.3);
  });

  it('corrupt settings fall back to defaults instead of throwing', () => {
    localStorage.setItem('vugg-settings-v1', '{not json');
    const s = musicGetSettings();
    expect(s.enabled).toBe(true);
    expect(s.volume).toBe(0.5);
  });
});

describe('music — context switching is jsdom-safe', () => {
  it('setting every context (incl. mid-game swaps) never throws without real audio', () => {
    expect(() => {
      musicSetContext('title');
      musicSetContext('building');
      musicSetContext('building');  // re-entry: must not restart/throw
      musicSetContext('silent');
      musicSetContext('title');
    }).not.toThrow();
  });
});
