import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

declare function displayGetSettings(): { fontScale: number, motion: 'system' | 'reduced' };
declare function displaySetFontScale(value: number): void;
declare function displaySetMotion(value: string): void;
declare function musicSetVolume(value: number): void;
declare function initSettingsUI(): void;
declare function showCallout(options: any): void;
declare function hideCallout(): void;
declare function importVuggLocalDataFile(input: HTMLInputElement): Promise<boolean>;

describe('presentation accessibility settings', () => {
  beforeEach(() => {
    localStorage.removeItem('vugg-settings-v1');
    displaySetFontScale(1);
    displaySetMotion('system');
  });

  it('persists only commissioned text scales beside music and applies them to the root', () => {
    musicSetVolume(0.3);
    displaySetFontScale(1.5);
    expect(displayGetSettings()).toMatchObject({ fontScale: 1.5 });
    expect(document.documentElement.style.fontSize).toBe('150%');
    const stored = JSON.parse(localStorage.getItem('vugg-settings-v1')!);
    expect(stored.music.volume).toBe(0.3);
    expect(stored.display.fontScale).toBe(1.5);

    displaySetFontScale(1.2);
    expect(displayGetSettings().fontScale).toBe(1);
    expect(document.documentElement.style.fontSize).toBe('100%');
  });

  it('supports an explicit reduced-motion preference without touching scientific state', () => {
    displaySetMotion('reduced');
    expect(displayGetSettings().motion).toBe('reduced');
    expect(document.documentElement.dataset.vuggMotion).toBe('reduced');
    displaySetMotion('anything-else');
    expect(displayGetSettings().motion).toBe('system');
    expect(document.documentElement.dataset.vuggMotion).toBe('system');
  });

  it('opens as an identified dialog, focuses Close, and restores Settings focus on Escape', () => {
    document.body.insertAdjacentHTML('beforeend', `
      <button id="settings-btn" aria-expanded="false">Settings</button>
      <div id="settings-panel" style="display:none" role="dialog" aria-hidden="true">
        <button id="settings-close">Close</button>
        <input id="settings-music-enabled" type="checkbox">
        <input id="settings-music-volume" type="range">
        <span id="settings-music-volume-pct"></span>
        <select id="settings-text-scale"><option value="1">100%</option><option value="1.5">150%</option></select>
        <select id="settings-motion"><option value="system">System</option><option value="reduced">Reduced</option></select>
      </div>
    `);
    initSettingsUI();
    const button = document.getElementById('settings-btn') as HTMLButtonElement;
    const panel = document.getElementById('settings-panel')!;
    const close = document.getElementById('settings-close') as HTMLButtonElement;
    button.click();
    expect(panel.style.display).toBe('block');
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-hidden')).toBe('false');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(close);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.style.display).toBe('none');
    expect(panel.getAttribute('aria-hidden')).toBe('true');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
    panel.remove();
    button.remove();
  });
});

describe('tutorial callout accessibility', () => {
  it('announces guidance and exposes 44px labeled controls', () => {
    const onContinue = vi.fn();
    const onSkip = vi.fn();
    showCallout({
      anchor: document.body,
      text: 'Read the formation diagnosis.',
      progress: '1 / 2',
      button: 'Continue',
      onButton: onContinue,
      onSkip,
    });
    const callout = document.body.querySelector('.tutorial-callout')!;
    const next = callout.querySelector('.tutorial-callout-btn') as HTMLButtonElement;
    const skip = callout.querySelector('.tutorial-callout-skip') as HTMLButtonElement;
    expect(callout.getAttribute('role')).toBe('region');
    expect(callout.getAttribute('aria-live')).toBe('polite');
    expect(callout.getAttribute('aria-label')).toBe('Tutorial guidance');
    expect(skip.getAttribute('aria-label')).toBe('Skip tutorial');
    const source = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    expect(source).toMatch(/\.tutorial-callout-btn\s*\{[\s\S]*?min-height:\s*44px/);
    expect(source).toMatch(/\.tutorial-callout-skip\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px/);
    next.click();
    skip.click();
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onSkip).toHaveBeenCalledOnce();
    hideCallout();
  });
});

describe('local backup keyboard control', () => {
  it('keeps the clipped file picker out of tab order and restores visible-button focus', async () => {
    document.body.insertAdjacentHTML('beforeend', `
      <button id="saves-import-btn">Import local backup</button>
      <input id="saves-import-file" type="file" tabindex="-1" aria-label="Choose local Vugg backup file">
    `);
    const button = document.getElementById('saves-import-btn') as HTMLButtonElement;
    const input = document.getElementById('saves-import-file') as HTMLInputElement;
    input.focus();
    expect(input.tabIndex).toBe(-1);
    expect(input.getAttribute('aria-label')).toBe('Choose local Vugg backup file');
    expect(await importVuggLocalDataFile(input)).toBe(false);
    expect(document.activeElement).toBe(button);
    input.remove();
    button.remove();
  });
});
