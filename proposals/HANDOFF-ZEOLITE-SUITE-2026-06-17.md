# HANDOFF — the Deccan zeolite suite + research cross-check (2026-06-17)

One session, two arcs. **Arc 1:** built the Deccan basalt-amygdule zeolite
paragenesis end-to-end — six zeolites across SIM 200→203. **Arc 2:** cross-checked
the boss's independent `ZEOLITE_RESEARCH.md` against my six dossiers, web-verified
the disagreements, and de-confabulated a fabricated citation I'd shipped (SIM-
neutral, `74fd595`).

HEAD at handoff: `74fd595`. Latest engine SIM: **203**. CI 1962 green. Pages built.

---

## ARC 1 — the six-zeolite Deccan suite (SIM 200→203)

The `deccan_zeolite` scenario's step-70 event had long narrated *"Stilbite +
heulandite + calcite blades"* that could not grow (PROPOSALS-LEDGER §A #14 / §G).
That gap is now closed and the cavity grows the full paragenesis, correctly
ordered by the silica-activity / Na-Ca evolution of the fluid:

```
thomsonite → scolecite/mesolite → stilbite/heulandite → chabazite
 (Si/Al~1)     (Si/Al~1.5)          (Si/Al~2.7-3.5)       (Si/Al~2, LATE)
 earliest      fibrous               sheets                perching rhombs
```

| SIM | Mineral(s) | Commit | The discriminator |
|-----|-----------|--------|-------------------|
| 200 | stilbite + heulandite | `7668aa6` | dehydration couple: stilbite COOLER (28 H₂O, T-sweet 60-110), heulandite WARMER product (6 H₂O, 120-180); + silica-activity (heulandite SiO₂ gate 400 vs stilbite 250) |
| 201 | scolecite + mesolite | `17690ac` | natrolite-group Na/Ca FORK: scolecite Ca-end (Na/(Na+Ca)≤0.5), mesolite ordered Na-Ca intermediate (needs BOTH, 0.2-0.8, geometric-mean σ) |
| 202 | thomsonite | `fbdb56f` | most-aluminous (Si/Al~1): SOFT low-silica preference (si_f saturates at the floor; siAlPref attenuates when flooded), NOT a hard ceiling |
| 203 | chabazite | `022efe7` | cation-FLEXIBLE (Ca>Na>K, K not required); joint (Ca+Na+K) charge; late/cool slot + trigonal rhombs distinguish it |

All six fire **20/20 seeds** in deccan and are in `expects_species`. Coverage
Live 137→143 (+6). Each ship was a clean **1/34 baseline-diff** (deccan only,
zero fleet losses) — the alkaline + Ca/Na + Al + silica + low-T window is
specific enough that the zeolites never tripped another scenario.

### The reusable zeolite-engine pattern (for natrolite/analcime/mordenite later)
Every zeolite followed the same shape — the `vugg-add-mineral` skill plus these
zeolite-specific moves:
1. **Silicate class, no redox gate.** Framework silicates have no redox-active
   ion — gate on cations + Al + silica floor + alkaline pH + T only (like prehnite).
2. **Silica floor, not ceiling.** The "low-Si favored" geology is real, but the
   sim's `fluid.SiO2` is *dissolved silica, not framework Si/Al* — and Deccan/Lake
   Superior are silica-rich yet zeolite-bearing. So a low FLOOR (thomsonite 120,
   natrolite-group 150, chabazite 200, sheets 250-400) + a SOFT preference, never
   a hard low-Si ceiling that would prevent firing in the type locality. (This
   caveat recurred for the clinoptilolite boundary, thomsonite, and the whole group.)
3. **Discriminate on the right axis.** stilbite/heulandite = T (dehydration
   couple); scolecite/mesolite/natrolite = Na/Ca fork; thomsonite = silica
   (most-aluminous); chabazite = cation-flexible + late/cool. Do NOT force a
   Na/Ca fork where it doesn't apply (the dossier explicitly warned thomsonite vs
   mesolite is NOT cleanly Na/Ca-separable — silica is the clean axis there).
4. **Substrate priority = paragenetic order.** thomsonite nucleates FIRST (on
   wall/calcite/silica); the natrolite group overgrows thomsonite; the sheets
   drape the fibrous sprays; chabazite (LATE) perches on everything. Wired in
   iterator order, and the later minerals list the earlier ones as substrates.
5. **stoichiometry in js/19** (per-formula-unit) every time — keeps the
   DEFERRED_TUNE_REQUIRED list empty (the v203 stoich-coverage test enforces this).
6. **structural.json + twin-law-check** every time. Five PASSed; mesolite {010}
   ⚠ FLAGged (expected — the Fdd2 giant-b cell defeats the simple-cell heuristic;
   real Handbook citation, shipped annotated per the citation-conservatism rule).

### Two calibration judgment calls worth remembering
- **Deccan Na 40→80 (v201).** mesolite needs BOTH Na and Ca; at Na=40 the fluid
  sat at Na/(Na+Ca)~0.15 (pure-scolecite regime) and mesolite never cleared its
  mixed gate. The bump opened the window (Na-Ca amygdule fluid is geologically
  correct) and legitimately unlocked pectolite too. The trajectory PROBE
  (`_decprobe`, deleted after) was what revealed Na was flat at 40 all run —
  probe before tuning.
- **Thomsonite spherulite re-nucleation (v202).** First pass fired 20/20 but only
  1-2 "eyes" — it kept hitting the standard σ>2.0 re-nucleation gate. The eyes are
  *spherulitic* (many close centers, Wise & Tschernich 1978), so a LOWER
  re-nucleation threshold (1.4) is science-grounded, not sentiment — took it to
  5-11 nodules. A foundational cavity zeolite shouldn't read as an also-ran.

### Process trap caught (v200, the stilbite arc)
Running `gen-js-baseline` while SIM was still the OLD version OVERWRITES the
old baseline file with the new assemblage, making the next `baseline-diff` read
"0 moved." Fix: bump SIM_VERSION *first*, or `git checkout HEAD -- <old baseline>`
before diffing. (The strip-archive tool refuses to overwrite an existing version
folder, which is the same guardrail one level up.)

---

## ARC 2 — research cross-check + citation de-confabulation (`74fd595`, SIM-neutral)

The boss left an independent `ZEOLITE_RESEARCH.md` on the canonical
(StonePhilosopher) fork and asked me to compare it against my six dossiers, with
the directive: **"if the two researches disagree, that's your sign to research it
and verify which is right — we have had times where both versions were right."**
Three genuine disagreements, three different outcomes:

| Disagreement | Verdict | Action |
|--------------|---------|--------|
| **Mesolite** formula `Na₂Ca₃Al₈` + "monoclinic" (boss) vs `Na₂Ca₂Al₆` + orthorhombic Fdd2 (mine) | **My engine right; the compilation erred** — Ca₃Al₈ is charge-impossible; "monoclinic" is scolecite's symmetry bleeding over | none (engine already correct); flagged to boss |
| **Thomsonite** "hot/Ca-rich/early" (boss) vs "cool" (mine) | **BOTH right, reconciled** — it's early/wall-lining (boss) AND the coolest zeolite zone ~50-70°C (mine); "hot" conflated *temporal* with *thermal* | none; cool T-window stands |
| **Stilbite vs heulandite** relative T | **My design right (heulandite hotter)** — confirmed by calorimetry + Cho/Liou grid — **BUT verifying it exposed a confabulated citation in MY v200 ship** | fixed (below) |

### The confabulation (the real find)
v200 attributed the stilbite/heulandite dehydration calorimetry to
**"Fridriksson, Bish & Navrotsky 2001, Am. Mineral. 86:448."** That is fabricated:
Am. Mineral. 86(4):448 is **Kiseleva, Navrotsky, Belitsky & Fursenko (2001)**
(web-confirmed, DOI 10.2138/am-2001-0408). My v200 research subagent welded a
real researcher's name onto a real paper's journal+volume, and I shipped it
across v200-202.

- **The science was 100% correct** (heulandite IS the higher-T dehydration
  product) — only the attribution was wrong. "The claim is true" did not excuse it.
- **Invisible to the existing guards:** `twin-law-check` validates Miller indices,
  not bibliography; the post-v142 citation-conservatism rule is about not
  synthesizing page numbers, not a subagent mis-attributing a real paper. Only the
  cross-check against an *independent* second source surfaced it.
- **Fixed SIM-neutral:** replaced everywhere (engine comments, `_sources`,
  minerals.json descriptions, the deccan narrator, history blocks, docs, test).
  seed-42 baseline verified BYTE-IDENTICAL (citations don't touch output → no SIM
  bump, no rebake), strip archive unaffected, CI green, Pages built.

---

## LESSONS (the durable ones)

1. **Cross-checking two independent research passes is a distinct verification
   layer.** It catches a class the structural/citation tooling can't: bibliographic
   confabulation by a research subagent. Disagreements are signal — web-verify them.
   Outcomes: one-wrong / both-right-reconciled / my-own-research-confabulated. All
   three happened this session. ([[feedback_cross_check_research_disagreements]])
2. **Research subagents fabricate citations, not just facts** — and a true claim
   with a false attribution is still a bug. De-confabulate it (the mvt-silver /
   adamite discipline applies to bibliography too).
3. **Fluid SiO₂ ppm ≠ framework Si/Al.** The recurring zeolite trap. Model "low-Si
   favored" as a soft preference over a floor, never a hard ceiling, or the mineral
   won't fire in its own type locality.
4. **Probe the trajectory before tuning the broth.** The Na-flat-at-40 finding (and
   the thomsonite 1-2-eyes finding) both came from cheap probes that paid for
   themselves immediately.
5. **Separate the axes.** The thomsonite "hot vs cool" dispute dissolved once
   "early/temporal" and "hot/thermal" were pulled apart — the same move that
   reconciles most "both were right" cases.

---

## CURRENT STATE & NEXT CANDIDATES

- **Deccan zeolite suite: COMPLETE** — six zeolites (thomsonite, scolecite,
  mesolite, stilbite, heulandite, chabazite), all firing 20/20, all in expects.
- **Remaining amygdule-zeolite candidates** (all in the boss's research, none
  shipped): **natrolite** (the Na endmember — completes the natrolite trio; the
  Na/Ca fork is already shaped for it, BUT deccan is Ca-dominant so it'd need a
  Na-rich window or be wired-but-not-firing), **mordenite** (early high-Si fibrous
  "wool rock"), analcime, gmelinite, levyne.
- **Two enrichment/calibration follow-ups surfaced by the cross-check** (boss's
  call, not yet done):
  1. **Fluorescence enrichment** — the boss's research has a full SW/MW/LW +
     activator table (mostly uranyl-ion). My zeolite `fluorescence` fields are
     mostly bare; the sim renders fluorescence (196 refs incl. js/12-mineral-art).
     Low-risk, high visual payoff, data ready.
  2. **Stilbite/heulandite overlap band** — the verification recommended a
     deliberate ~110-150°C overlap (my windows separate them more than nature
     does). Minor; direction is correct; optional.
- The two compiled-research errors (mesolite formula + system) are in the boss's
  canonical `ZEOLITE_RESEARCH.md`, left for the boss to fix (read-only here).

Master open-work map remains `proposals/PROPOSALS-LEDGER.md`; the §G zeolite gap
is now closed end-to-end.
