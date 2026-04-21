# TASK-BRIEF: Scenario 8 — Ouro Preto Imperial Topaz Veins (Variant B)

**Priority:** Build Variant B first — simpler scope, proves out topaz before the bigger pegmatite pocket (Variant A).

**Source docs:**
- `proposals/SCENARIO-MINAS-GERAIS.md` — full scenario spec
- `proposals/MINERALS-MINAS-GERAIS.md` — mineral data for all 6 species (you only need topaz for this variant)

---

## What to Build

### 1. Add Topaz to `data/minerals.json`

From `proposals/MINERALS-MINAS-GERAIS.md`, extract the topaz entry. Full JSON is there — copy it verbatim. Key fields:

- **Formula:** Al₂SiO₄(F,OH)₂
- **Class:** silicate
- **class_color:** "#3b3beb" (silicate deep blue from 12-hue wheel)
- **nucleation_sigma:** 1.5 (high — needs time to accumulate Be... wait, that's beryl. Topaz needs F accumulation)
- **5 habit variants:** prismatic_elongated, stout_prismatic, pseudo_octahedral, massive_granular, hydrothermal_cap

Each habit has wall_spread, void_reach, vector, trigger — all defined in the proposal.

Also copy to `docs/data/minerals.json` — **sync both copies.**

### 2. Add Scenario: `ouro_preto`

Add to the scenarios in `data/minerals.json` (or wherever scenarios are defined — check existing pattern in the codebase).

**Scenario parameters from the proposal:**

```
name: "Ouro Preto Imperial Topaz Veins"
description: "Hydrothermal veins in quartzite, Minas Gerais, Brazil. 
              360°C to 50°C. Fluorine-rich fluids deposit imperial topaz 
              in pre-existing fractures. Cr³⁺ traces create the legendary 
              golden-orange to pink imperial color."
temperature: { start: 360, end: 50 }
fluid: {
  SiO₂: high,
  Al₂O₃: moderate,
  F: moderate (KEY — topaz needs fluorine),
  OH: moderate,
  Cr³⁺: trace (imperial color threshold),
  Fe³⁺: trace
}
minerals: [quartz, topaz, hematite, rutile]
// Note: rutile not yet implemented — skip or stub. quartz, hematite already exist.
```

**Thermal regime:** Steady cooling from 360°C → 50°C over the simulation. No heating events. One clean cooling curve — "a single exhalation from the granite cooling below."

**Key mechanic — F threshold:** Topaz cannot nucleate until dissolved fluorine exceeds a threshold. This creates a natural delay — early quartz grows alone, then topaz appears when F accumulates. This is the "incompatible element accumulation" concept simplified to one element.

**Imperial color mechanic:** If Cr³⁺ > trace threshold during topaz growth → golden-orange to pink imperial color. Below threshold → colorless to pale blue (common topaz). This is cosmetic but educationally important — the entire reason Ouro Pretopaz is world-famous.

### 3. Narrative

Second-person present tense, text-adventure voice. Example from the proposal:

> "You are a hydrothermal vein in the quadrilatero ferrifero. Three hundred sixty degrees of fluorine-rich water, squeezed from a granite pluton into fractured quartzite. The quartzite doesn't yield — it channels. You flow through cracks thinner than a hair, carrying silicon and aluminum and fluorine toward the cooling surface. Imperial topaz waits for no one. It nucleates when the chemistry is right — not before, not after. And if the earth's crust has been generous with chromium, the crystals will glow orange-gold, the color that gave an empire its name."

### 4. Duration & Steps

Match existing scenario patterns. 200-400 steps, steady cooling.

---

## What NOT to Do

- Do NOT implement Variant A (pegmatite pocket) — that comes later
- Do NOT add tourmaline, beryl, spodumene, albite — those are Variant A minerals
- Do NOT add rutile yet — it's a bonus mineral. Skip or mention in comments.
- Do NOT break existing scenarios — run all 7 existing scenarios after changes to verify
- Do NOT push to origin. Commit only. I'll review and merge.

---

## Files to Touch

- `data/minerals.json` — add topaz mineral entry + ouro_preto scenario
- `docs/data/minerals.json` — sync copy
- `vugg.py` — if scenarios need Python-side changes
- `web/index.html` — if scenarios need JS-side changes
- `tools/sync-spec.js` — run after to verify no drift

## Verification

1. Run `tools/sync-spec.js` — confirm no drift
2. Load web UI, select "Ouro Preto" scenario
3. Run full simulation — verify topaz nucleates after F threshold, quartz appears first
4. Verify imperial color appears when Cr³⁺ threshold met
5. Run all 7 existing scenarios — confirm nothing broke
6. Check `docs/data/minerals.json` is in sync

---

Commit. Do NOT push — I'll review and merge.
