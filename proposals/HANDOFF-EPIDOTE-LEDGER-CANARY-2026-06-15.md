# HANDOFF — epidote + the proposals ledger + canary hardening (2026-06-15)

A long session that ran four arcs: hardened the **vugg-canary** instrument,
closed the stale **crystal-clip bug**, built the **PROPOSALS-LEDGER** (a
verified delivered-vs-promised reconciliation of the whole proposals corpus),
and shipped **epidote** (v196) + its **Tormiq alpine-cleft** anchor scenario
(v197). The master open-work map is now `proposals/PROPOSALS-LEDGER.md` — read
that first; this handoff is the session narrative + the ranked next-steps.

HEAD at handoff: `5043d57` (SIM 197), Pages built + live.

---

## SHIPPED THIS SESSION

### vugg-simulator (Syntaxswine/vugg-simulator)
- **`c343f71`** docs — BUG-CRYSTALS-CLIP-VUG-WALL flipped `open → RESOLVED`.
  Re-verified 3 ways: the v59 cap → v61 deliberate-removal arc (defer-to-geology)
  + per-cell renderer clip; headless (the original lateral-feldspar burst is gone,
  remaining overshoots are intentional axial needles); browser (the worst-case
  144mm selenite renders as a contained wall-coating rosette). Was falsely "open"
  for ~5.5 weeks.
- **`1d4857f` + `cab1e63`** docs — `PROPOSALS-LEDGER.md` (handoffs via git-diff,
  pre-fork proposals + minerals via code-grep). Headline: the genuinely-forgotten
  debt is SHALLOW — one clean feature orphan (Gibbs-Thompson) + one mineral cohort
  (Round-5/6) + named partials; most "abandoned" work shipped under another name.
- **`a3c1cb5`** feat (SIM 196) — **epidote** Ca₂(Al,Fe³⁺)₃(SiO₄)(Si₂O₇)O(OH).
  The first alpine-cleft Fe³⁺ silicate; closes the ledger's #1 mineral orphan.
  Redox-gated (oxidizing → Fe³⁺, the discriminator vs actinolite/clinozoisite).
  Fires in porphyry (propylitic) + Deccan (greenschist); correctly excluded from
  schneeberg. 9 unit tests, twin-law ✓.
- **`5043d57`** feat (SIM 197) — **tormiq_alpine_cleft** scenario. Tormiq Valley,
  Gilgit-Baltistan, Pakistan — the type-quality epidote locality. Epidote is the
  star (5, most-abundant); byssolite/adularia/albite/quartz/fluorite suite. 8 tests,
  3 menus, additive (zero drift). Two in-commit tunes: killed 12 halite (Na/Cl too
  high) + reined in actinolite (Mg too high) so epidote leads.

### vugg-canary (Syntaxswine/vugg-canary) — hardened, first real data landed
- **`4d5b97a`** fix — the 04:00 task failed file-not-found on first fire (schtasks
  split the `/tr` path on the space in "Local Storage"); literal-quoted it.
- **`a730d19`** fix — the no-change short-circuit was gated on whole-tree dirt, so a
  permanent untracked WIP file made it NEVER fire (full 2.5h sweep nightly forever);
  scoped the gate to engine paths (`js`/`data`/`tools/_harness.mjs`), fail-safe.
- **`29541bd`** fix — `status.mjs` crashed on an in-progress/partial sweep (read
  meta.json unconditionally); now degrades + falls back to last completed day.
- First real 200-seed × 33-scenario sweep landed (self-test PASS all 33).

---

## THE OPEN-WORK MAP (the bugs & holes)

**`PROPOSALS-LEDGER.md` §A is the master actionable list.** Distilled + ranked here:

### Tier 1 — the structural bottleneck (unblocks a whole class)
1. **Per-mineral derived nucleation seeds (THE KEYSTONE)** — nucleation draws from
   one shared RNG stream, so any gate/engine change to a high-traffic mineral
   re-rolls the cascade and can knock out unrelated phases (mottramite 96→47% was
   the demonstrator; epidote's clean schneeberg exclusion this session was *lucky*
   — its gate returns 0 there, so no RNG was consumed — not structural safety).
   Derive each mineral's nucleation RNG per-(mineral,cell). Unblocks #2.
2. **Held sphalerite/wurtzite redox gate** + **Tsumeb V-richness rider** — correct
   physics, waiting on #1 (see [[project_vugg_redox_census]]).

### Tier 2 — the canary's own gaps (it guards the keystone arc; harden it first)
3. **Canary heartbeat** — no self-monitoring; if the 04:00 job silently dies,
   nothing surfaces it. Add a "no meta/NO-CHANGE in >26h ⇒ broken" line to
   `npm run status`.
4. **Canary dirt-scoping is an allowlist** — fail-safe but could miss a determinant
   outside `js`/`data`/`_harness`. Robust version: hash the engine inputs instead of
   trusting a path list. Also: a docs commit changes the SHA so the short-circuit
   still re-sweeps on doc-only changes (minor).

### Tier 3 — calibration / science debt (tracked)
5. **Hot-band Ksp(T) >90°C promotion** — needs SUPCRT hi-T coeffs + calcite/aragonite
   gate recalibration + aragonite metastability hardening.
6. **Thermo ΔH tail** — dolomite ΔH (engine-promoted), siderite ΔH (verify Bénézeth
   2009), witherite ΔGf drift.

### Tier 4 — content build-candidates (greenfield, no blocker)
7. **Quartz morphology arc** — research doc written (`RESEARCH-quartz-morphology-
   2026-06-12.md`), queued 4×, never built (hiatus census → fenster → sceptres).
8. **Weathering-epilogue mechanic** — spatially-partial vadose stage; first client
   wittichen erythrite post-exhumation. Named 3×, no code.
9. **Mineral orphans (5)** — franklinite, staurolite, titanite/sphene, **stilbite +
   heulandite** (Round-5/6 metamorphic+zeolite cohort). Stilbite+heulandite are the
   highest-leverage: they'd fill the **deccan_zeolite Stage-II content gap** (the
   step-70 event narrates "stilbite + heulandite blades" that can't grow — a
   de-confab candidate, cf. mvt silver) AND retire the over-promise in one add.
10. **Gibbs-Thompson crystal-quality mechanic** — the one clean *feature* orphan
    (0 code, full design). Chemical-proximity nucleation bonus is a probable second.

### Tier 5 — UI / partials (several were the user's "UI improvements" interest)
11. **Strip filter-rule engine + record-mode UI** — recording infra shipped, filter
    UI never built (VERIFIED absent).
12. **Per-vertex chip-selector UI** — data layer present, picker UI absent.
13. **Broth-control fortress verbs** (Seep/Flood/Drain/Replenish), **specimen-object
    Phases B–E**, **edge-textures 11/17**, **sonifier musicality** (reverb/looping/
    melody — boss "keep discussing"), **strip-contract campaign** (4 named scenarios
    never pinned: gem_pegmatite/searles/sabkha/marble).

### Tier 6 — epidote follow-ups (this arc's loose ends)
14. **tormiq calcite** is aspirational (tune late CO3 / extend cooling tail).
15. When **clinozoisite / titanite / zoisite / adularia / byssolite** land as real
    minerals, swap the tormiq stand-ins (currently magnetite/feldspar/actinolite).

---

## SESSION LESSONS

- **Labels rot — including an audit's own.** Every canary bug was a stale "shipped"
  claim; the clip bug was a stale "open"; the ledger's fan-out readers over-reported
  orphans **5×** (botryoidal/late_stage/host-rock/volatiles/voxels all shipped under
  other names). A subagent's "X was never built" is a hypothesis — confirm with a
  grep/SHA. ([[feedback_verify_before_asserting_state]])
- **git-history beats code-grep for handoff audits** — commit subjects record what
  *shipped*, sidestepping the vocabulary trap. The mineral sweep was the only
  fully-accurate reader (binary catalog-key ground truth).
- **Concurrent `dist/` writes cause flaky tests** — a pharmacolite failure during the
  epidote rebake was a race (a ritual job rebuilding `dist/` during vitest's pretest),
  not a regression. Run the suite solo; a clean probe confirmed 50/50 seeds.
- **A new mineral's gate can over-permit** — epidote's redox gate correctly excluded
  schneeberg, but watch the cascade-displacement test failures: they're the early
  warning. Two existing scenarios (porphyry/deccan) legitimately gained epidote.

## NEXT-SESSION OPENER (recommended)

The **canary heartbeat (#3)** is cheap and makes the instrument trustworthy before
the big arc. Then the **keystone RNG-derivation (#1)** — with the canary watching,
it's safe to attempt, and it unblocks the held redox gate. If a content detour is
wanted instead, **stilbite + heulandite (#9)** is the highest-leverage mineral add
(fills the deccan gap + retires a narrative over-promise). The user also flagged
interest in **UI improvements** (Tier 5) — #11/#12 are ready-scoped.
