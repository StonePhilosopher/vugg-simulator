# 02: v125 Cascade Analysis — Empirical Findings

**Date:** 2026-05-21
**Analyst:** 🪨✍️
**Source:** v125 commit message, builder's cascade-probe notes

---

## The v125 Experiment Design

The builder probed 6 minerals for stoichiometry addition:
- **P3 Tsumeb suite (4):** dioptase, koettigite, + 2 others
- **P5 secondary (2):** cassiterite, opal, pyrolusite, tigers_eye

Hypothesis going in: "small footprint" minerals (few crystals, small max_um) would have minimal debit impact.

Result: **2 shipped, 4 reverted**. The hypothesis was wrong.

---

## Pass Cases (2/6)

### metacinnabar {Hg: 1, S: 1}
- **Scenarios affected:** sulphur_bank only
- **Why it passed:** cinnabar already debits Hg from the same fluid
- **Mechanism:** New debit tightens an existing budget, doesn't introduce a new one
- **Drift:** Only max_um (metacinnabar 24827→17667). No species add/drop.
- **29 of 30 scenarios byte-identical**

### opal {SiO2: 1}
- **Scenarios affected:** 6 (deccan_zeolite, naica_geothermal, ouro_preto, radioactive_pegmatite, schneeberg, ultramafic_supergene)
- **Why it passed:** SiO2 broths are 200-8000 ppm; opal max_um is 5-36 µm
- **Mechanism:** Per-step debit is <0.01% of SiO2 budget — too small to perturb any σ-gate
- **All 6 scenarios byte-identical**

**Pattern:** Unique-cation minerals (Hg already saturated) or enormous-budget minerals (SiO2 in thousands of ppm) are safe.

---

## Cascade Cases (4/6)

### dioptase {Cu: 1, SiO2: 1}
- **Scenario:** schneeberg only
- **Crystal count:** 1 crystal @ 84.8 µm
- **Debit:** sub-percent Cu+SiO2
- **Cascade:** displaced 12+ mineral nucleation orders
- **Most alarming:** DROPPED pharmacolite (the v124-shipped mineral!)
- **Added:** haidingerite

**Analysis:** Schneeberg has a dense Cu-suite. dioptase's Cu debit, even tiny, shifted σ for edge-of-gate minerals. pharmacolite was near its threshold — the tiny push dropped it below. haidingerite was just below its threshold — the tiny push brought it above.

**This is the edge-of-gate mechanism in action.**

### pyrolusite {Mn: 1}
- **Scenarios:** bisbee + naica + ouro_preto + ultramafic_supergene
- **Initial Mn:** 2-4 ppm in those scenarios
- **Total debit:** ~14-27 ppm (3 crystals × 235-450 µm)
- **Result:** **EXCEEDS initial Mn budget**

**Cascade in bisbee:**
- DROPPED: turquoise
- GAINED: 5 new species (dioptase, hematite, lepidocrocite, opal, tigers_eye)
- 25+ count shifts across 4 scenarios

**Analysis:** Mn is a trace element in these scenarios. Adding a Mn-debiting mineral exhausted the budget. The Mn-gated minerals (turquoise, rhodochrosite) lost σ and dropped out. The Mn-deficient gap allowed other minerals to nucleate.

### tigers_eye {SiO2: 1, Fe: 0.5}
- **Scenarios:** 4
- **Key finding:** SiO2-only is safe (opal proved it)
- **But SiO2 + Fe trace cascades**

**deccan_zeolite cascade:**
- DROPPED: albite, rhodochrosite
- GAINED: 4 new opals

**Analysis:** The Fe coefficient (0.5) is the cascade trigger. Fe is gated in deccan_zeolite (hematite, goethite). Adding even a tiny Fe debit shifted edge-of-gate Fe-minerals. SiO2 is safe because the budget is enormous. Fe is dangerous because the budget is tight.

### cassiterite {Sn: 1}
- **gem_pegmatite:** CLEAN (only cassiterite's own max_um)
- **schneeberg:** CLEAN (schneeberg ACCEPTS cassiterite!)
- **radioactive_pegmatite:** CASCADE

**radioactive_pegmatite cascade:**
- DROPPED: anglesite, goethite
- CHANGED: topaz 4→2, opal 2→3, tigers_eye 3→4
- 6 other count shifts

**Analysis:** 2-of-3 clean. radioactive_pegmatite is the cascade block. Sn is a unique cation — but radioactive_pegmatite has other gate-sensitive minerals (anglesite, goethite, topaz) that shifted when any new mineral was added. The cascade wasn't caused by Sn competition; it was caused by **iterator displacement** when the nucleation order changed.

### koettigite {Zn: 3, As: 2}
- **Scenario:** supergene_oxidation only
- **Cascade:** 19 count breaks

**Key shifts:**
- alunite DROPPED
- raspite NEW
- koettigite itself 4→2
- pharmacolite 7→4 (v124-shipped, displaced AGAIN)

**Analysis:** supergene_oxidation is a dense suite with many Zn and As minerals. Adding ANY new Zn+As debit displaces the entire arsenate suite. The builder's note: "dense multi-mineral scenarios where many engines share cation budgets are structurally cascade-prone."

---

## Mechanism Refinement from v125

### Old framing (v109/v120/v124): "RNG-cascade ripple"
- True but vague
- Suggested randomness was the cause

### New framing (v125): "Edge-of-gate displacement"
- Cascade is triggered by whether new debit shifts σ enough to flip an edge-of-gate mineral
- Not magnitude — **threshold crossing**
- Predicts:
  - Unique cations → safe (metacinnabar, opal)
  - Shared cations in dense suites → cascade (dioptase, koettigite)
  - Trace elements in tight budgets → cascade (pyrolusite, tigers_eye)

### The Competition-for-Solutes Connection

This maps directly to the initiative variable concept:
- In the current sim, competition is **implicit** (debit happens after growth)
- In an initiative system, competition is **explicit** (shared cations reduce initiative)
- The cascade would still happen — but it would be **legible**: we'd see dioptase's initiative drop because of Cu competition, and pharmacolite's initiative drop because it's edge-of-gate

---

## Predictions for Initiative Variable

If initiative existed in v125:

| Mineral | Base Initiative | Competition Penalty | Edge-of-Gate | Final Initiative | Outcome |
|---------|----------------|-------------------|--------------|-----------------|---------|
| dioptase | medium | -1 (Cu competition) | -2 (near threshold) | LOW | Wouldn't nucleate, or would nucleate late |
| pyrolusite | medium | -1 (Mn competition) | -1 (budget exhaustion) | LOW | Wouldn't nucleate |
| opal | medium | 0 (no SiO2 competition) | 0 (robust) | HIGH | Nucleates early, no cascade |
| metacinnabar | medium | 0 (Hg saturated) | 0 | HIGH | Nucleates, no cascade |
| cassiterite | high | 0 (unique Sn) | 0 | HIGH | Nucleates in gem/schneeberg |

**The initiative system would have predicted the cascade before it happened.**

---

## Remaining DEFERRED_TUNE_REQUIRED (14 minerals)

| Mineral | Category | Cascade Risk | Initiative Prediction |
|---------|----------|-----------|---------------------|
| pectolite | P1 holdout | Medium | -1 (Ca, Si competition) |
| caledonite | P2 cascade | High | -2 (Cu, Pb, SO4 competition) |
| plumbogummite | P2 cascade | High | -2 (Pb, P competition) |
| proustite | P2 cascade | High | -1 (Ag, As competition) |
| dioptase | P3 Tsumeb | High | -2 (Cu, Si competition) |
| willemite | P3 Tsumeb | Medium | -1 (Zn, Si competition) |
| conichalcite | P3 Tsumeb | High | -2 (Cu, Ca, As competition) |
| duftite | P3 Tsumeb | High | -2 (Pb, Cu, As competition) |
| koettigite | P3 Tsumeb | High | -2 (Zn, As competition) |
| uranophane | P4 Schneeberg | Medium | -1 (Ca, U, Si competition) |
| cassiterite | P5 secondary | Low | 0 (unique Sn) |
| lepidolite | P5 secondary | Medium | -1 (Li, K, Al competition) |
| pyrolusite | P5 secondary | High | -2 (Mn competition, budget exhaustion) |
| tigers_eye | P5 secondary | Medium | -1 (SiO2 safe, Fe competition) |

---

## Bottom Line

The v125 cascades are not bugs — they're **data**. Each revert teaches us the shape of the competition surface. The initiative variable would make this shape explicit.

The builder's disciplined retreat pattern (ship clean, revert cascade, document why) is building an empirical database of mineral competitiveness. When initiative lands, we'll have 14+ case studies to validate the modifier system.

— 🪨✍️
