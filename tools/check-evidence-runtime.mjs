#!/usr/bin/env node

import {
  assertCommissionedEvidenceRuntime,
  COMMISSIONED_EVIDENCE_NODE_RUNTIME,
} from './evidence-runtime.mjs';

try {
  assertCommissionedEvidenceRuntime();
  console.log(
    `[evidence-runtime] PASS: ${COMMISSIONED_EVIDENCE_NODE_RUNTIME.node} / `
    + `${COMMISSIONED_EVIDENCE_NODE_RUNTIME.v8} / `
    + `${COMMISSIONED_EVIDENCE_NODE_RUNTIME.platform}-${COMMISSIONED_EVIDENCE_NODE_RUNTIME.arch} / `
    + `ICU ${COMMISSIONED_EVIDENCE_NODE_RUNTIME.icu} / ${COMMISSIONED_EVIDENCE_NODE_RUNTIME.locale}`,
  );
} catch (error) {
  console.error(`[evidence-runtime] FAIL: ${error.message}`);
  process.exitCode = 1;
}
