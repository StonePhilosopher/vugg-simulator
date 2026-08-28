#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCommissionedEvidenceRuntime } from './evidence-runtime.mjs';
import {
  readGuidedTutorialBrowserReceipt,
  verifyGuidedTutorialBrowserReceipt,
} from './guided-tutorial-browser-receipt.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

try {
  assertCommissionedEvidenceRuntime();
  const versionSource = fs.readFileSync(path.join(ROOT, 'js', '15-version.ts'), 'utf8');
  const match = /const SIM_VERSION = (\d+);/.exec(versionSource);
  if (!match) throw new Error('could not read SIM_VERSION from js/15-version.ts');
  const simVersion = Number(match[1]);
  const receipt = readGuidedTutorialBrowserReceipt(ROOT, simVersion);
  verifyGuidedTutorialBrowserReceipt(ROOT, receipt, simVersion);
  console.log(`[guided-browser-receipt] PASS: exact SIM ${simVersion} owned-browser testimony is current`);
} catch (error) {
  console.error(
    `[guided-browser-receipt] FAIL: ${error.message}; `
    + 'run npm run gen:browser-receipt before the serialized science rebake',
  );
  process.exitCode = 1;
}
