# Vugg Simulator — Tutorial System Design

**Date:** 2026-05-02
**Author:** 🪨✍️ (from Professor's concept)
**Status:** Draft for builder review

---

## Design Philosophy

Tutorials teach by doing, not reading. Each tutorial introduces one concept through a single scenario, interrupts with a problem, and points at the tool that solves it. The player transitions from watching → acting → understanding in under 60 seconds.

---

## Tutorial 1: First Crystal (silica-rich scenario)

**Scenario:** `silica-rich` — simple broth, one variable to manage
**Mineral:** Quartz (SiO₂)
**Duration:** ~30-45 seconds

### Flow

1. **Orientation** — "This is your vug. Press Grow."
   - Player sees the vug, the Grow button, and nothing else
   - No dashboard visible yet — minimal UI

2. **First nucleation** — "Quartz needs silica and the right temperature. Press Grow."
   - Quartz nucleates. Player sees a crystal appear.
   - Brief: "Your crystal is growing."

3. **Active growth** — "Keep it going. Grow the quartz to 5mm."
   - Player clicks Grow a few times
   - Quartz grows. All conditions are in the green. Easy success.
   - Player learns: clicking Grow advances time, crystals grow over time

4. **The interruption** — [temperature drops below quartz nucleation zone]
   - Growth stops. Crystal flashes or dims.
   - Tutorial highlights the temperature readout: "Your crystal stopped growing. See the red zone? That means conditions are wrong."
   - This is THE moment — transition from watching to acting

5. **Dashboard introduction** — "Adjust the temperature slider to bring it back into the green zone."
   - Temperature slider becomes visible/highlighted
   - Player drags it up
   - Crystal resumes growing
   - Player learns: you control the conditions, minerals have growth zones

6. **Solo growth** — "Good. Now grow it to 10mm."
   - Player does it themselves — no hand-holding
   - Temperature may drift again (subtle). Player fixes it unprompted.
   - Validates that the lesson stuck

7. **Complete** — "Tutorial complete. You grew your first crystal."
   - Show the finished quartz with its stats
   - Unlock: Free Play mode + Tutorial 2

### Key Principle
The tutorial doesn't explain the dashboard before the player needs it. The player needs the dashboard → the dashboard appears → the player uses it. Need precedes explanation.

---

## Tutorial 2: Competition (two minerals, same resource)

**Scenario:** New tutorial scenario with silica + calcite-available broth
**Minerals:** Quartz + Calcite
**Concept:** Supersaturation, anion competition, multiple growth

### Flow (sketch)

1. "Grow a quartz." — player does it (they know how now)
2. "Now grow a calcite." — calcite nucleates alongside quartz
3. "Both crystals share the same silica supply. Keep both growing."
4. [one mineral starts losing supersaturation] "One crystal is starving. Can you see which one?"
5. Introduce: step rate, or broth adjustment, or temperature tuning to favor one or both
6. "You can't always save both. Sometimes you choose."

### Key Concept
Resources are finite. Minerals compete. The player makes tradeoffs.

---

## Tutorial 3: The Fourth Door (oxidation event)

**Scenario:** Hydrothermal → vadose breach
**Minerals:** Start reducing (sulfides), then oxidizing event changes everything
**Concept:** Paragenetic sequence, the vug breathes

### Flow (sketch)

1. "Grow some pyrite." — player grows sulfides in reducing conditions
2. [oxidation event triggers] "Something changed. The vug has been breached."
3. "Your pyrite is dissolving. Oxygen is entering the system."
4. "Can you grow something that likes oxidizing conditions?"
5. Player discovers: limonite, or a secondary mineral, forms from the dissolution products
6. "One mineral's death is another mineral's birth."

### Key Concept
Conditions change. Minerals transform. The vug has a history.

---

## Implementation Notes

- Tutorials are a **mode** separate from Free Play and Fortress Mode
- Each tutorial locks the broth to specific parameters (no wild experimentation yet)
- Tutorial scenarios are hand-crafted, not random
- The interruption in Tutorial 1 is scripted — temperature drop is guaranteed, not random
- Tutorial UI uses highlights, arrows, and callouts — not modal dialogs
- After completing all tutorials, player unlocks the full game with understanding of:
  1. Growth requires right conditions (temperature, chemistry)
  2. Conditions drift — player must manage them
  3. Resources are shared — minerals compete
  4. Conditions change — minerals transform

### Technical Requirements
- Tutorial mode flag in game state
- Scripted event triggers (guaranteed temperature drop at step X)
- UI highlight/callout system (point at specific controls)
- Step-by-step progression with completion checks
- Locked broth parameters per tutorial

---

*Draft. Builder to review and estimate implementation. Tutorial 1 is the priority — it's the player's first 30 seconds with the game.*
