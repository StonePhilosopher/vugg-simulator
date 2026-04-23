# Design Proposal — Adding Marquee Gemstones

**Status:** design proposal, awaiting decisions before implementation.

**Scope:** ruby, sapphire, emerald, the rest of the beryl family (aquamarine, morganite, heliodor), and a diamond feasibility analysis.

**Why a design doc first:** the architectural question "one species with color varieties, or split into separate species" is not a research question — it's a UX + modeling choice. Deciding it once shapes how the next ~20 gem minerals get added. Better to agree on the architecture up front than retrofit later.

---

## TL;DR

| Mineral | Feasibility | Work estimate |
|---|---|---|
| **Aquamarine, morganite, heliodor** | Already detected inline in `grow_beryl`; just need Library-visibility decision | 1-3 hrs depending on architecture choice |
| **Emerald** | Same — detected inline today; visibility question | Same |
| **Ruby** | New species; chemistry is simple (Al + Cr, Si-undersaturated) | ~4 hrs (engine + scenario implications) |
| **Sapphire** | New species; shares corundum base with ruby, different trace gate (Fe+Ti or Fe alone) | ~3 hrs on top of ruby |
| **Corundum (colorless)** | Generic Al₂O₃; parent of ruby + sapphire | ~2 hrs as part of ruby/sapphire work |
| **Diamond** | Not a vug mineral — three options laid out below | Ranges 0 hrs (skip) / 2 hrs (xenocryst event) / 15-20 hrs (full C plumbing) |

**Schema impact:** zero new `FluidChemistry` fields needed for anything except diamond (which would need a `C` field if taking the full-plumbing option).

**Scenario impact:**
- Beryls fit `scenario_gem_pegmatite` (Cruzeiro) — already active today
- Emerald fits the same scenario **if** we bump its Cr; or wants a new "schist-hosted hydrothermal emerald" scenario (Colombia Muzo-type, Zambia Kagem)
- Ruby + sapphire need a new **metamorphic/contact-metamorphic** scenario (Mogok marble, Kashmir)
- Diamond would need kimberlite-pipe modeling (option B) or deep-mantle thermodynamics (option C)

---

## Architectural decision — beryl varieties

### Current state

`grow_beryl` (vugg.py line ~5043) already does variety selection inline:

```python
# Variety selection. Cr/V beats Mn beats Fe — the emerald paradox
if f.Cr > 0.5 or f.V > 1:
    variety = "emerald"
    color_note = f"emerald green (Cr³⁺ — the ultramafic-pegmatite paradox met)"
elif f.Mn > 2:
    variety = "morganite"
    color_note = f"morganite pink (Mn²⁺ {f.Mn:.1f} ppm)"
elif f.Fe > 15 and oxidizing:
    variety = "heliodor"
    ...
elif f.Fe > 8:
    variety = "aquamarine"
    ...
```

The `beryl` spec entry documents all 5 variants via `color_rules`:
- `colorless_goshenite` (default)
- `blue_aquamarine` (Fe > 8, no Cr/Mn)
- `pink_morganite` (Mn > 2)
- `green_emerald` (Cr > 0.5 or V > 1)
- `yellow_heliodor` (Fe > 15 with oxidizing)

**But** the `crystal.mineral` attribute stays `"beryl"`. The variety lives in `crystal.habit` and in zone notes. So in the Library UI, in idle-mode legends, and in scenario output logs, everything reads as "Beryl."

### Three architectural options

#### Option A — Split into 5 separate species (best UX, most work)

Each variety gets its own `data/minerals.json` entry, its own `supersaturation_<name>()` method, its own `grow_<name>()` function. The current single `beryl` becomes `goshenite`, and 4 siblings get added: `emerald`, `aquamarine`, `morganite`, `heliodor`.

**Pros:**
- Library shows "Emerald" as its own entry. "I found an emerald!" is the gamer moment.
- Each variety has its own supersaturation gate → can independently tune when each fires (e.g., emerald σ ≥ 1.4, aquamarine σ ≥ 1.0)
- Test suite auto-generates 4 × 8 = 32 new tests (gate + necessity + completeness)
- Each variety can have its own nucleation probability, max_size, max_nucleation_count
- Paragenesis cleaner: emerald nucleates on biotite in schist, aquamarine on albite in pegmatite — separate nucleation blocks
- Future-extensible: red beryl / bixbite becomes a 6th sibling with Mn³⁺ gate; star beryl varieties etc.

**Cons:**
- 4 × full engine implementations (supersat + grow + narrate + nucleation block + MINERAL_SPEC_FALLBACK + IDLE_MINERAL_COLORS in each runtime) = ~8 hrs with the scaffolding tool
- Possible seed-42 shift: if the current `beryl` nucleation was firing in gem_pegmatite, replacing it with 4 different minerals at different σ thresholds will re-shuffle outputs → SIM_VERSION bump + baseline regen
- Inter-variety competition logic — what if Cr AND Fe are both above threshold? Current code has an explicit priority (Cr/V beats Mn beats Fe). Splitting needs each engine to suppress itself when a higher-priority sibling is active, or accept that the pegmatite will produce both emerald and aquamarine.

**Typical real-world behavior:** emerald and aquamarine don't coexist in the same pocket — they form in different Cr availability. So the priority rule in current code is doing the right thing. Splitting means baking that priority into each engine's supersaturation gate (emerald gate: "Cr > 0.5 AND I fire"; aquamarine gate: "Fe > 8 AND Cr < 0.5").

#### Option B — One species, `crystal.mineral` set per variety at grow time (pragmatic, medium work)

Keep `beryl` as the engine, but in `grow_beryl`, **set `crystal.mineral = variety`** so the crystal identifies as "emerald" going forward. Add 4 variety entries to `data/minerals.json` that redirect to the `grow_beryl` dispatcher.

**Pros:**
- Library shows each variety separately
- 4× less engine code than Option A
- Existing chemistry + priority logic unchanged
- No seed-42 shift (same nucleation, same growth — just different `mineral` attribute after grow fires)

**Cons:**
- Slightly unusual pattern — the JSON entries for emerald et al. reference `grow_beryl` not `grow_emerald`, which confuses the drift-checker unless we add a carve-out
- Can't independently tune nucleation probability per variety (all beryl nucleation kicks at once)
- `MINERAL_ENGINES["emerald"] = grow_beryl` — slight naming dissonance

#### Option C — Keep current, richer narrator (minimum work)

Leave everything as-is. Enhance `_narrate_beryl` to describe the variety more prominently. Accept that Library + idle legends show "Beryl" only.

**Pros:** trivial
**Cons:** the user's "big name crystals" goal isn't met — emerald and aquamarine don't show up in the UI as distinct things.

### Recommended

**Option A for emerald specifically** (it's the gem-famous one + the one with the most distinct chemistry), **Option B for aquamarine/morganite/heliodor** (variety detection via current logic, separate Library entries via mineral reassignment). Goshenite stays as "beryl" since that's the generic name.

This gets the UX win for the 4 gem-famous varieties while keeping engine code reasonable.

---

## Corundum family (Al₂O₃) — clean addition

No existing entry. Three new species, shared structure, different trace gates:

### corundum (colorless, generic)
- **Gate:** Al ≥ 15, SiO₂ < 50 (the defining constraint — corundum and quartz are mutually exclusive at normal pressures), T 400-1000°C
- **Habits:** tabular, barrel, hexagonal prism, steep pyramidal
- **Optional trace:** Fe (pale brown/grey), Ti (grey)

### ruby (Al₂O₃ + Cr)
- **Gate:** corundum conditions **+ Cr ≥ 2 ppm** (the Cr substitution into Al site at the 100-1000 ppm mineral level yields the red color)
- **Habits:** flat tabular (Mogok) to barrel (Mozambique/Madagascar); 6-rayed asterism when rutile needles align basal
- **Color rules:** "pigeon's blood" (Cr + trace Fe, Mogok), "cherry" (higher Cr), "pinkish ruby" (lower Cr)
- **Fluorescence:** strong red under LW/SW UV (Cr³⁺ emission — a diagnostic; the reason Burma Mogok rubies look lit-from-within)
- **Localities:** Mogok Burma (marble-hosted, contact metamorphic), Luc Yen Vietnam, Winza Tanzania, Montepuez Mozambique

### sapphire (Al₂O₃ + Fe/Ti)
- **Gate:** corundum conditions **+ (Fe ≥ 5 AND Ti ≥ 0.5)** for blue; or **Fe ≥ 20** alone for yellow; or **V ≥ 2** for violet; or **Cr + Fe both low-moderate** for padparadscha pink-orange
- **Habits:** same as corundum; barrel form most common in basalt-derived
- **Color rules:** "cornflower blue" (Kashmir, Fe+Ti charge transfer), "royal blue" (deeper Fe), "yellow sapphire" (Fe³⁺ alone), "pink sapphire" (light Cr, below ruby threshold), "padparadscha" (Cr + trace Fe), "green sapphire" (Fe alone, specific oxidation)
- **Asterism:** 6-rayed star (rutile inclusions), also 12-rayed rare
- **Localities:** Kashmir India (cornflower, mined out), Sri Lanka (variety range), Madagascar, Montana (alluvial fancy colors), Thailand/Cambodia (basalt-derived)

### Key chemistry constraint — SiO₂ undersaturation

The engine for all three must gate on **SiO₂ < 50** (mid-crustal) or **SiO₂ < 100** (skarn). Without this, corundum is thermodynamically unstable — Al + SiO₂ goes to sillimanite/kyanite/andalusite/feldspar instead.

This is a **real testable gate** that's different from every other mineral in the sim — the sim has never had a "low silica" mineral before. Adding this creates a test pattern for the ~20 other Al-rich, silica-undersaturated minerals (spinel, chrysoberyl, alexandrite, sapphirine, etc.) that could come later.

### Scenario fit for corundum

No existing scenario has Si-undersaturated Al-rich chemistry. Need one of:

**Option CS1 — new scenario `marble_contact_metamorphism` (Mogok-anchored)**
- T: 500-800°C
- SiO₂: very low (<30 ppm) — defining characteristic
- Al: high (50-100 ppm)
- Ca: very high (700-1000 ppm, dolomitic marble host)
- Cr, Fe, Ti trace populations for ruby + sapphire + fancy colors
- Events: contact-metamorphism T pulse, skarn fluid intrusion
- Scientific anchor: Garnier et al. 2008 (Mogok stone tract), Peretti et al. 2018 (marble-hosted ruby)

**Option CS2 — expand existing scenarios to support corundum** (not recommended)
- None of the existing scenarios are Si-poor enough; retrofitting would break their other minerals

I **recommend Option CS1** — new scenario is clean, the chemistry constraint is too different to retrofit.

---

## Emerald — the special case within beryl

Emeralds have a geochemical paradox: they need Be + Al + SiO₂ (beryl chemistry) AND Cr (ultramafic chemistry). These two environments almost never coexist in the same fluid — that's why emerald is rare. Four real paths:

1. **Colombia-type (Muzo, Chivor)**: black-shale-hosted hydrothermal. Be from pegmatite source upstream; Cr from reduction of Cr-bearing organic/bitumen in shale. Totally unique deposit type.
2. **Schist-type (Zambia Kagem, Zimbabwe Sandawana)**: pegmatite intruding Cr-rich chromite schist. Be from pegmatite, Cr from country rock.
3. **Pegmatite-only (Ural Russia, Brazil Nova Era)**: pegmatite cutting Cr-bearing peridotite/amphibolite; Cr leaches from wall rock during pegmatite crystallization.
4. **Skarn-type (some Pakistan, Afghanistan)**: rare pegmatite-carbonate interaction.

For the sim, the pegmatite-only type (path 3) is the most viable fit with current `scenario_gem_pegmatite`. Would need:

- **Chemistry tweak**: bump the wall_Cr_ppm in Cruzeiro's VugWall so the event_wall_leaching (if one exists; or add one) delivers Cr to the pocket fluid
- **OR** an event `ev_peridotite_contact` that delivers Cr from an ultramafic xenolith near the pegmatite
- **OR** a separate new scenario `scenario_emerald_schist` modeling Muzo-type hydrothermal emerald

**Recommendation**: Phase 1 as "pegmatite emerald via Cr bump in Cruzeiro event" — smallest change, uses existing chemistry. Future: add a Muzo-type scenario as its own proposal.

---

## Diamond — three options

Diamond is not a vug-forming mineral. It crystallizes at 150-250 km depth, 1000-1200°C, 4-6 GPa, and gets to the surface as a **xenocryst** carried by rapidly-erupting kimberlite magma. No vug ever produces a diamond.

Three ways to give players a "I got a diamond!" moment:

### Option D1 — Skip it (honest)

Don't add diamond. Document the decision in BACKLOG.md with a geochemistry note. Explain to users in Library mode that diamonds aren't vug minerals — they're xenocrysts.

**Pros:** intellectually honest, zero work
**Cons:** user explicitly asked about diamonds; collectors think of them as a display-case must-have

### Option D2 — Xenocryst event (pragmatic narrative bypass)

Add a new scenario `scenario_kimberlite` with an `ev_diamond_xenocryst` event that **teleports** a pre-formed diamond into the vug. The diamond has fixed size (draws from a log-normal distribution around 1-5 mm), doesn't grow during the scenario, has no supersaturation gate. The narrator explains the xenocryst origin (emphasizes that the diamond crystallized in the deep mantle 100+ Ma ago, got entrained in a rapidly-rising kimberlite melt that punched through crust in <24 hours, and ended up in this "vug" which is really a pipe breccia cavity).

**Pros:**
- 2-4 hours of implementation (mostly the event + narrator)
- Geologically defensible with the right narration
- Players get diamond, mineralogy students get the "diamonds don't form in vugs" lesson explicit
- Opens kimberlite scenario for other lamproite/xenolith minerals (pyrope garnet, chrome diopside, olivine/forsterite, phlogopite)

**Cons:**
- The sim's paradigm is "watch crystals grow from fluid" — diamonds just appearing breaks that
- Needs its own scenario (Ekati NWT or Premier/Cullinan SA as anchors)
- Pressure field on VugConditions would need to read kimberlite-realistic (near-surface, since the "vug" is a breccia pipe chamber after ascent, not the mantle)

### Option D3 — Full carbon plumbing (proper, biggest lift)

- Add `C: float = 0.0` field to `FluidChemistry` (elemental carbon, distinct from CO3 carbonate)
- Add graphite engine — forms in reducing high-T metamorphic fluids, simple hexagonal habit (actually sim could do this cheaply; graphite IS a vug mineral in metamorphic schists)
- Add moissanite engine — SiC, ultra-rare on Earth, usually extraterrestrial/abiotic. Could add for novelty.
- Add diamond engine — gated on **pressure > 30 kbar (3 GPa) AND T > 900°C AND C > 1 ppm**. Requires sim pressure field to actually modulate supersaturation (currently pressure is mostly cosmetic in most engines).
- Add new scenario `scenario_mantle_peridotite` with ambient P = 40 kbar, T = 1100°C, C trace from subducted slab. This scenario fundamentally doesn't fit the "supergene cool vug" paradigm either, but at least it's physically honest.

**Pros:**
- Unlocks graphite (a legitimate vug mineral in regional metamorphism — schists worldwide)
- Unlocks moissanite (tiny, but scientifically interesting)
- Makes pressure a real chemistry driver (forcing function for future high-P minerals: coesite/stishovite silica polymorphs, majoritic garnet, etc.)
- Diamond fires via the normal engine loop

**Cons:**
- 15-20 hours — a full research + implementation round
- Requires retrofitting pressure-sensitivity into many existing engines to make them not mis-fire in mantle conditions (currently T = 1100°C would thermally decompose most minerals; the THERMAL_DECOMPOSITION dict would need pressure-dependent re-entry)
- Still ends with "diamond scenario looks nothing like a vug" narratively

### What D3 (full carbon + pressure plumbing) would unlock beyond diamond

This is the key question that reframes whether D3 is worth the lift. The infrastructure D3 adds isn't just "one mineral" — it opens three classes that are currently unreachable:

**Class 1 — Carbon-bearing minerals (needs C field)**

| Mineral | Setting | Notes |
|---|---|---|
| **graphite** (C) | Metamorphic schist vugs, marbles | A legitimate vug mineral — forms in regional metamorphism. Hexagonal flakes, reducing, T 400-700°C. Dead simple engine; would fire in a new `scenario_graphite_schist` or retrofit to an existing metamorphic context. |
| **moissanite** (SiC) | Meteorite, carbonado inclusions | Rare on Earth; mostly extraterrestrial. Could add for scientific novelty + the "rarer than diamond" collector narrative. |

That's 2-3 minerals opened by C field alone (3 hrs of work).

**Class 2 — Pressure-gated polymorphs (needs pressure-as-chemistry-driver)**

Currently `pressure` on `VugConditions` is mostly cosmetic — only apophyllite (pressure ≤ 0.5) actually gates on it. Making pressure real opens:

| Mineral | Setting | Significance |
|---|---|---|
| **kyanite** (Al₂SiO₅) | High-P metamorphism, blueschist facies | Classic blue-blade metamorphic gem; needs pressure > 5 kbar |
| **andalusite** (Al₂SiO₅) | Low-P contact metamorphism | Low-P polymorph; chiastolite variety has diagnostic cross pattern |
| **sillimanite** (Al₂SiO₅) | High-T metamorphism | High-T polymorph; all three form in the classic Al₂SiO₅ phase diagram |
| **coesite** (SiO₂) | Impact craters, ultra-deep subduction | Meteor impact signature + UHP metamorphism in ophiolites |
| **stishovite** (SiO₂) | Extreme impact | Even higher P than coesite; Meteor Crater Arizona coesite-stishovite layer |
| **jadeite** (NaAlSi₂O₆) | Low-T high-P subduction | Jade; Myanmar + Guatemala |
| **omphacite** (eclogite pyroxene) | Eclogite facies | Deep subduction |
| **lawsonite** (CaAl₂Si₂O₇(OH)₂·H₂O) | Blueschist facies | Low-T high-P metamorphism indicator |
| **glaucophane** (Na₂(Mg,Fe)₃Al₂Si₈O₂₂(OH)₂) | Blueschist | The amphibole that names blueschist |

That's **~9 pressure-gated minerals** unlocked by making pressure a real chemistry driver. Many of these are famous gems (kyanite, andalusite, jadeite) or famous metamorphic indicators (the Al₂SiO₅ triangle is a textbook P-T diagram).

This would also enable proper scenarios:
- `scenario_blueschist_subduction` (lawsonite, glaucophane, jadeite, omphacite)
- `scenario_impact_crater` (coesite, stishovite, shocked quartz)
- `scenario_contact_metamorphism` (Al₂SiO₅ polymorphs — connects naturally to the ruby/sapphire marble scenario)

**Class 3 — Mantle minerals (needs C + pressure + mantle T range)**

| Mineral | Setting | Significance |
|---|---|---|
| **diamond** (C) | 150+ km mantle, kimberlite xenocryst | The one you asked about |
| **olivine / forsterite** (Mg₂SiO₄) | Mantle peridotite, kimberlite xenocryst | The most abundant mineral on Earth by volume (upper mantle is 60%+ olivine); peridot gem variety. Currently absent from sim. |
| **enstatite + diopside** (MgSiO₃ + CaMgSi₂O₆) | Mantle pyroxenes | Foundational mantle minerals. Chrome diopside is a bright-green gem. |
| **pyrope garnet** (Mg₃Al₂Si₃O₁₂) | Mantle garnet, kimberlite xenocryst | Blood-red gem; the Bohemian garnet. Currently absent. |
| **spinel** (MgAl₂O₄) | Mantle + xenoliths + contact metamorphic | Gem (often confused with ruby historically — Black Prince's "Ruby" in British Crown Jewels is a spinel); different habit forms in different regimes. Would use corundum's SiO₂-undersaturated gate. |
| **phlogopite** (KMg₃AlSi₃O₁₀(F,OH)₂) | Mica in kimberlites + mantle | Distinctive bronze-brown mica xenocryst |
| **ilmenite** (FeTiO₃) | Kimberlite indicator | Mn-rich ilmenite ("kimberlitic ilmenite") is a prospecting indicator |
| **chromite** (FeCr₂O₄) | Chromite seam / ophiolite | The Cr source for emerald's paradoxical Cr. Black octahedra. |
| **perovskite** (CaTiO₃) | Mantle, some kimberlites | Mantle-dominant structure; eponymous to the perovskite family |

That's **~9 mantle / kimberlite minerals** unlocked. Several are gems (olivine/peridot, pyrope, chrome diopside, spinel); several are scientifically important (perovskite, chromite); and one (olivine) is literally the most common mineral on Earth by volume — its absence from the sim is a glaring gap.

### D3 total impact

~**20 minerals unlocked** across carbon + pressure-gated + mantle classes. Plus the foundation for the next wave of UHP/metamorphic minerals (there are many more — blueschist + eclogite + impact families each have 5-10 more species).

Current mineral count: 62. After D3 work: ~80-90 depending on how far we push each class.

### Revised diamond recommendation

**If the "scale to 200 minerals" goal is serious**, D3 is the right long-term answer — those 20 minerals aren't reachable any other way, and the foundation (real pressure field, carbon field, mantle regime) generalizes.

**If the immediate goal is "show the boss a diamond"**, D2 still wins — ship the xenocryst event in 2-4 hrs, defer D3 to a future round.

**Hybrid recommendation: D2 now, D3 as Round 7.** Ship D2 to meet the immediate ask + unlock the kimberlite scenario structure. Schedule D3 as a proper multi-commit round after Round 6 halides. D3 then builds on the kimberlite scenario that D2 already added — diamond transitions from xenocryst-event to real mantle-grown mineral, graphite + moissanite get added alongside, pressure-gated polymorphs fill the metamorphic scenario family out.

This phasing means we get diamond visible in the UI within a week, AND we accumulate 20+ minerals over the next couple of rounds. The D3 research doc would be its own major proposal, sized comparable to the sulfates doc.

---

## Scenario implications summary

| Scenario | New chemistry needed | New minerals activated |
|---|---|---|
| `gem_pegmatite` (Cruzeiro) — existing | None (already has Be, Al, Fe, Mn) + maybe Cr bump via event | aquamarine, morganite, heliodor; emerald (if Cr bumped) |
| `marble_contact_metamorphism` — **NEW** | Si-poor Al-rich Ca-rich fluid, Cr + Fe + Ti traces, metamorphic T-pulse events | corundum, ruby, sapphire |
| `kimberlite` — **NEW** (if Option D2) | High Cr, low Al, ambient P high, C trace | diamond xenocrysts; pyrope garnet + chrome diopside later |

---

## Implementation phases (pick your flavor)

### Phase 1 — Beryl family first-class (1-3 hrs)

Recommendation: **hybrid Option A+B**
- `emerald` → Option A (own engine, own tests, own Cr gate, gem UX payoff biggest)
- `aquamarine`, `morganite`, `heliodor` → Option B (redirect to `grow_beryl`, just get separate `crystal.mineral` + Library entry)
- `beryl` stays as goshenite / generic fallback
- Scaffolding tool handles 80% of the file edits
- Cr bump in `scenario_gem_pegmatite` (small retune, SIM_VERSION bump if seed-42 shifts)

### Phase 2 — Corundum family (4-6 hrs)

- Add `corundum`, `ruby`, `sapphire` as three new species (shared Al + SiO₂-low gate via a helper)
- Write `proposals/MINERALS-RESEARCH-CORUNDUM.md` with full research compendium (like the sulfates doc)
- Build `scenario_marble_contact_metamorphism` (Mogok) — 1-1.5 hrs including chemistry, events, narration
- Test: parameterized gate tests for ruby needing Cr, sapphire needing Fe+Ti, corundum needing neither

### Phase 3 — Diamond (pick D1 / D2 / D3)

If D2: `scenario_kimberlite` + `ev_diamond_xenocryst` + narrator explaining xenocryst origin. 2-4 hrs.

---

## Questions for you before I start

1. **Beryl varieties: hybrid A+B as proposed, or pure A (split all 5), or B (all redirect)?**
2. **Corundum: ruby + sapphire as separate species (recommended), or one `corundum` with color_rules (faster)?**
3. **Diamond: which option (D1/D2/D3)?**
4. **Phase order: do we go Phase 1 → 2 → 3 in sequence, or start with Phase 2 (corundum is the bigger win, bigger ship for your boss to show off)?**
5. **Beyond this doc: interested in alexandrite + tanzanite + chrysoberyl + garnet group as a future round? These are the other "big name" gems not yet in proposal.**

I'll write the full research doc + start implementation once these are answered.
