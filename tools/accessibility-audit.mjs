// Fast, dependency-free accessibility contract for the shipped local build.
// The real-browser workflow covers layout and interaction; this gate keeps
// the critical semantic, zoom, focus, touch, motion, and contrast decisions
// from silently disappearing between browser runs.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const settings = readFileSync(join(root, 'js', '98e-ui-settings.ts'), 'utf8');
const tutorial = readFileSync(join(root, 'js', '70a-tutorial-overlay.ts'), 'utf8');
const scenarios = readFileSync(join(root, 'data', 'scenarios.json5'), 'utf8');
const failures = [];

function requirePattern(source, pattern, label) {
  if (!pattern.test(source)) failures.push(label);
}

function relativeLuminance(hex) {
  const channel = offset => parseInt(hex.slice(offset, offset + 2), 16) / 255;
  const linear = value => value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(channel(1))
    + 0.7152 * linear(channel(3))
    + 0.0722 * linear(channel(5));
}

function contrast(foreground, background) {
  const high = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const low = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (high + 0.05) / (low + 0.05);
}

const contrastPairs = [
  ['primary text', '#d4a843', '#0a0a08'],
  ['muted controls', '#a08e58', '#1a1a14'],
  ['settings text', '#9a8a50', '#14140f'],
  ['settings muted text', '#a08e58', '#14140f'],
  ['tutorial text', '#f0c050', '#1a1a14'],
  ['tutorial secondary controls', '#a08e58', '#1a1a14'],
  ['keyboard focus ring', '#fff2a8', '#0a0a08'],
];
for (const [label, foreground, background] of contrastPairs) {
  const ratio = contrast(foreground, background);
  if (ratio < 4.5) failures.push(`${label} contrast ${ratio.toFixed(2)}:1 is below 4.5:1`);
}

requirePattern(html, /<html\s+lang="en">/i, 'document language is not declared');
requirePattern(html, /name="viewport"[^>]*viewport-fit=cover/i, 'safe-area viewport metadata is missing');
if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(html)) {
  failures.push('browser pinch zoom is disabled');
}
requirePattern(html, /:where\(button, a, input, select, textarea, \[tabindex\]\):focus-visible/, 'global keyboard focus ring is missing');
requirePattern(html, /#settings-btn\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/, 'Settings trigger is below the 44px touch contract');
requirePattern(html, /\.tutorial-callout-btn\s*\{[\s\S]*?min-height:\s*44px;/, 'tutorial Continue control is below the 44px touch contract');
requirePattern(html, /\.tutorial-callout-skip\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/, 'tutorial Skip control is below the 44px touch contract');
requirePattern(html, /id="settings-text-scale"[\s\S]*?<option value="1\.5">150%<\/option>/, '150% text setting is missing');
requirePattern(html, /id="settings-motion"[\s\S]*?<option value="reduced">Reduced<\/option>/, 'explicit reduced-motion setting is missing');
requirePattern(html, /aria-haspopup="dialog"\s+aria-expanded="false"/, 'Settings trigger dialog semantics are missing');
requirePattern(html, /Sound never carries the only scientific information/i, 'audio-equivalent visible-information promise is missing');
requirePattern(settings, /document\.documentElement\.style\.fontSize/, 'text scale is not applied to the document root');
requirePattern(settings, /dataset\.vuggMotion/, 'motion preference is not applied to CSS');
requirePattern(settings, /event\.key !== 'Escape'/, 'Settings Escape close is missing');
requirePattern(tutorial, /aria-live', 'polite'/, 'tutorial guidance is not announced politely');
requirePattern(tutorial, /aria-label', 'Skip tutorial'/, 'tutorial Skip control has no accessible name');
requirePattern(scenarios, /"selector": "#f-sat-bar \.sat-indicator"/, 'Grand Tour does not require a causal mineral diagnosis interaction');

if (failures.length) {
  for (const failure of failures) console.error(`[accessibility-audit] ${failure}`);
  process.exit(1);
}

console.log(`[accessibility-audit] PASS: ${contrastPairs.length} contrast pairs plus zoom, focus, touch, motion, text-scale, tutorial, and audio-equivalence contracts`);
