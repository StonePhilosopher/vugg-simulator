# External release gates and evidence protocol

These gates are intentionally open. Local automation prepares the protocol; it
cannot invent physical-device, player, scientific, art, legal, or store
certification.

## Physical device and assistive technology

Test at minimum one currently supported iOS phone, iOS tablet, Android phone,
and Android tablet, plus desktop Chromium, Firefox, and Safari where available.
For each device record OS/browser/build, viewport and safe-area values, GPU/WebGL
capability receipt, battery start/end, 20-minute thermal behavior, peak memory,
load/step/replay latency, audio routing/interruption, rotation, background/
resume, local backup round-trip, and cleanup after failure.

Repeat the title→scenario→run→pause→save→reload→authenticated replay workflow
with keyboard-only navigation, platform screen reader, 150% text, reduced
motion, high contrast/forced colors where supported, and touch. A pass requires
visible authenticated geometry or the truthful field-derived fallback, no
clipped causal controls, and no audio-only scientific information.

## Representative-player causality study

Recruit participants who were not involved in implementation. Ask them to:

1. predict whether one mineral can nucleate;
2. use the formation diagnosis to identify the limiting reagent or gate;
3. change one Creative lever and explain the observed result;
4. distinguish eligibility from guaranteed survival;
5. save, reload, and export their run.

Retain consented task outcomes, completion/error counts, quoted confusion themes
without personal identifiers, accessibility needs, and the exact build receipt.
Do not claim success from developer walkthroughs.

## Scientific review

A real mineralogist/geochemist receives the model digest, science provenance
manifest, locality claim cards, exact evidence receipt, Creative diagnosis,
known validity envelopes, and unresolved Tier-C proxies. Record signed findings,
required corrections, reviewer identity/affiliation, conflicts, date, and exact
commit. The AI hostile-review role is supporting evidence only.

## Art, rights, privacy, legal, and deployment

Human reviewers must reconcile every asset-manifest rights status, approve final
art and audio masters, verify third-party notices, review the telemetry-free
privacy statement and local-data behavior, complete store metadata/ratings, and
authorize the deployed artifact. Deployment approval applies only to the exact
browser/content/asset/evidence hashes reviewed.

## Evidence pack

Create one directory per candidate under `release-evidence/external/<candidate>`
using `docs/external-gate-evidence-template.json`. Attach device screenshots,
performance exports, assistive-technology notes, usability summary, scientific
sign-off, asset/rights table, and deployment decision. Checksums must be filled
from the candidate itself. Missing evidence stays `pending`; never write
`passed` as a placeholder.
