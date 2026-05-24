# PROPOSAL: Structure as fact-check — physics-anchored twin laws

**Author:** Claude (Opus 4.7, 1M context), 2026-05-23
**Status:** Future direction. Not a near-term commit. Written to hand off context.
**Companion docs:**
- `proposals/HANDOFF-CRYSTAL-NATURALISM-ARC.md` — the data-layer arc this proposal extends
- `proposals/RESEARCH-CRYSTAL-NATURALISM.md` — the original homework
- `.claude/skills/vugg-add-twin-law/SKILL.md` — current workflow for twin_laws edits
- `js/15-version.ts` v142 doc block — the case study this proposal responds to

---

## TL;DR

The vugg-simulator currently encodes twin laws as **leaf data** in `data/minerals.json`: a name, a Miller index, a probability, and a `_source` citation. The engine reads them, rolls them at nucleation, decorates the rendered crystal. Nothing else in the codebase checks whether the data is true. This is the highest-confabulation-risk surface in the spec, and v142 documents the first caught example (a fabricated "Frondel 1948 Amer. Mineral. 33:545" adamite citation shipped at v139, retracted at v142).

**The proposal:** add an external constraint that ties twin_laws data to *atomic structure*, not to recited citations. Tools to do this exist + are freely accessible (the Bilbao Crystallographic Server, the Crystallography Open Database). Three tiers of ambition:

1. **Tier 1 — sanity-check tool.** A `tools/twin-law-check.mjs` utility that takes a mineral name, fetches its CIF from COD, computes the candidate low-Σ CSL twin planes from the unit cell + space group, and flags any declared twin_law that doesn't match a structural candidate. Catches confabulations like the adamite {101} entry. **Doable as a focused tool in one commit. Highest leverage for least work.**

2. **Tier 2 — probability calibration from structure.** Instead of "Anthony Handbook says it's common, p=0.05," derive p from computed twin-boundary energy. Lower-energy boundary → higher field frequency → higher p. Removes the citation dependency for the probability field entirely. Requires engine architecture conversation.

3. **Tier 3 — novel twin-law discovery.** For poorly-documented species (future rare-mineral additions: arrojadite, painite, charoite, etc.), use computational tools to predict candidate twin planes BEFORE looking for field documentation. The physics IS the citation in cases where no field data exists.

**Wisdom for the next context:** the v139→v142 episode taught a generalizable principle — *leaf data in the engine's constraint graph is the highest-risk surface for confabulation, because nothing else in the codebase fact-checks it*. The structural approach addresses this at the root: by making twin_laws data answerable to a computable physical quantity, the constraint graph extends into the data layer and the fact-check problem largely dissolves. The same principle applies to other leaf-data surfaces (fluorescence colors, descriptive `_source` strings, habit names) — though those are out of scope for THIS proposal.

---

## Why this proposal exists

### The constraint-graph insight

During the v133-v141 twin_laws data arc, the boss made a sharp observation: **when implementing new science-based mechanics, separately programmed elements often end up in agreement**. The FluidChemistry fields, supersat engines, nucleation gates, scenario broths, event handlers, substrate preferences — they form a constraint network. A fabricated value somewhere usually surfaces as an internal contradiction: sigma never clears, the mineral never fires, a baseline test fails, the agent API reports wrong species. The boss-as-implementer notices the friction. **The constraint network IS the fact-checker** for that whole layer.

This is real. It's why the chemistry engine is more trustworthy than the leaf metadata: the chemistry has to pay rent to many other subsystems, and confabulations bounce off.

But twin_laws entries don't pay rent. `_rollSpontaneousTwin` reads them, sets `crystal.twinned = true/false`, picks `crystal.twin_law` if rolling true. That's it. Nothing downstream cares whether the law is {101} or {110}, whether p is 0.05 or 0.02, whether the citation is real. The constraint network has no edges connecting twin_laws to anything that could check them. **Leaf data is constraint-graph-orphan.**

### The v139→v142 case study

At v139 (commit `3edd2e7`), I shipped an adamite twin_law entry:

```json
{
  "name": "heart_twin_101",
  "miller_indices": "{101}",
  "probability": 0.05,
  "_source": "Frondel 1948 (American Mineralogist 33:545) — type description..."
}
```

The citation didn't exist. Page 545 of AmMin volume 33 (1948) was an unrelated paper per the journal's table of contents. The real Ojuela adamite paper is Mrose, Mayers, Wise 1948 (33:449-457), and it doesn't discuss twinning. The authoritative Anthony Handbook of Mineralogy v.IV adamite entry lists {101} as a *crystal form* and a *cleavage direction* — **not** as a twin law. The "heart twin" terminology exists in the collector / dealer market for visually-heart-shaped Ojuela specimens, but no formal mineralogical literature characterizes the contact plane.

I confabulated the citation. The synthesis machinery glued together: a famous mineralogist's name (Frondel), a plausible year (1948), the right journal (AmMin), a plausible page number (545). Each piece was anchored in something real. The composite wasn't.

**It shipped silently for three months of session-time (multiple commits in succession) because nothing in the codebase checks twin_laws data against external truth.** Tests pass. Baselines regenerate. Calibration sweeps run. The agent API reports adamite firing with twinned=true. Nothing knows the citation is fake.

It was caught at v142 only because I happened to be layering ADDITIONAL fabricated specifics (a "Cassedanne 1985" citation on top of the original Frondel claim) while writing the heart-twin primitive's doc comment, and the cumulative "wait, do I actually know any of this?" surfaced. Pure luck. The catch wasn't systematic — it depended on me noticing my own pattern in prose-writing-mode, which is a different mode than the structured-field-filling mode where v139 generated the citation.

### Why citation-conservatism alone isn't enough

The v142 commit ships a citation-conservatism rule for the vugg-add-twin-law skill: web-search any specific paper-page citation before shipping, default to general references ("Anthony Handbook v.X section") when not verifiable. That rule helps — it would have caught Frondel 1948 33:545 in 30 seconds.

But it has limits:

1. **It depends on the agent following discipline.** Future agents may not. (I didn't, for 8 commits straight.)
2. **It catches FAKE citations, not WRONG citations.** A real paper that's been misremembered as supporting a twin law it doesn't support would pass the web-search rule but still be wrong.
3. **It doesn't help when no good citation exists.** Many minerals have sparse or no formal twin documentation. The collector folklore tier (adamite "heart") is precisely where citation-conservatism leaves you stuck — you can't web-search your way into a paper that doesn't exist.

The structural approach proposed here is the *deeper* fix: instead of asking "did someone write down that this mineral twins on {hkl}?", ask "**does the atomic structure of this mineral support a low-energy twin boundary on {hkl}?**" The latter is computable. It doesn't depend on whether the right field study has been published yet. And it gives the leaf data a connection back to the constraint graph — because the structure is also what the engine's chemistry is reading from.

---

## The crystallography (what makes this possible)

Real established theory for predicting twin plane candidates from crystal structure:

### Coincidence Site Lattice (CSL) theory

When two crystals meet on a plane, the boundary energy depends on how well their lattices "register" across the plane. A boundary where many lattice points coincide (low-Σ, low sigma) is low-energy and therefore favored as a twin plane. The Σ value is a small integer (Σ3, Σ7, Σ13, ...) that counts the inverse density of coincident points.

**Σ3 boundaries** correspond to the spinel-law {111} contact in cubic crystals — the universally observed twin law for galena, fluorite, magnetite, chromite, all cubic sulfides. The vugg-sim already encodes these and they're all real because Σ3 boundaries are physically the most favored among cubic twin candidates.

**Σ7 boundaries** correspond to certain pseudo-hexagonal contacts in trigonal/hexagonal crystals. Calcite e-twins live here.

**Higher Σ** corresponds to less-favored, rarer twin laws. Above ~Σ13, the boundaries are usually too high-energy to form naturally.

CSL analysis is computable from the space group + unit cell alone, without atomic positions. Tools that do this exist (Bilbao Crystallographic Server has CSL utilities). For any candidate twin plane (hkl), the tool returns the Σ value, and you can rank planes by Σ to predict which are likely twin candidates.

### Pseudo-symmetry analysis

When a crystal "almost" has higher symmetry — e.g., aragonite is orthorhombic but with axial ratios that almost reproduce hexagonal symmetry — the twin laws often follow the higher symmetry the structure doesn't quite have.

Aragonite's cyclic-sextet {110} twin (shipped in v134) is literally orthorhombic individuals stacking three at 60° apart to pretend to be hexagonal. The pseudo-hex relationship is predictable from cell parameters alone (a/b ratio ≈ √3 for that twin law). The Bilbao server's PSEUDO and SUBGROUPS utilities detect pseudo-symmetry relationships automatically.

### Hartman-Perdok Periodic Bond Chain theory

For predicting crystal habit + which faces will dominate growth, PBC theory analyzes the bond network within the unit cell. Faces containing two or more intersecting "periodic bond chains" (F-faces) grow slowly and dominate; faces with no chains (K-faces) grow fast and disappear. This is real established theory used industrially.

For our purposes, PBC theory connects atomic structure to which faces matter for growth-related phenomena (twins are growth-related). It's a secondary signal — CSL + pseudo-symmetry are more directly relevant — but it composes well with the others.

### Twin boundary energy (the gold standard)

For Tier 2/3 ambition, modern computational mineralogy (DFT, molecular dynamics, force-field methods) can directly compute the energy of forming a twin boundary on any candidate plane. The lowest-energy boundaries are the ones nature actually produces.

This is grad-school-level computational crystallography but the tooling exists (PyMatGen, VASP, GULP). Out of scope for Tier 1 but real for the longer arc.

---

## Tier 1 — the sanity-check tool

**This is what I'd build first if you greenlight any of this.** Bounded scope, immediate utility, can validate against the known-good portion of the catalog before being trusted on novel cases.

### Spec

`tools/twin-law-check.mjs` — a CLI utility that takes a mineral name (or runs across the whole catalog) and:

1. Looks up the mineral's space group + unit cell parameters. **Currently `data/minerals.json` doesn't have these fields.** Step 0 of the workflow: extend the spec to include `space_group` and `unit_cell` for each mineral. Source: COD CIF files for each, mapped by mineral name.

2. For each declared twin_law in the mineral's entry, computes the candidate's Σ value (via Bilbao CSL tool, or a local CSL calculator if we want to be self-contained — there are open-source implementations).

3. Flags any twin_law where:
   - Σ > 13 (probably not a real twin)
   - The Miller index is also a documented cleavage direction (twin + cleavage on same plane is unusual; flag for review)
   - The Miller index doesn't correspond to any reflection-symmetry or pseudo-symmetry candidate in the structure

4. Outputs a report:
   - ✅ **Confirmed**: twin_law matches a low-Σ candidate or known pseudo-symmetry relation
   - ⚠️ **Suspect**: twin_law doesn't match obvious structural candidates — review needed
   - ❌ **Likely wrong**: high-Σ, no symmetry argument, or other red flags

### Validation strategy (critical — do this before trusting the tool)

Run the tool against the **known-textbook** twin laws first:

- galena {111} spinel-law → must return ✅ (Σ3 boundary in cubic system)
- fluorite {111} penetration → must return ✅ (same)
- pyrite {110} iron-cross → must return ✅
- selenite {100} swallowtail → must return ✅ (low-Σ in monoclinic gypsum)
- aragonite {110} cyclic-sextet → must return ✅ (pseudo-hex relation)
- marcasite {110} cockscomb → must return ✅
- cerussite {110} sixling → must return ✅
- calcite e-twins → must return ✅

If the tool agrees with the textbook twins, it's trustworthy. THEN run it across the 142 minerals with declared twin_laws and look at the ⚠️ + ❌ output. **That's the audit.**

Expected findings, based on my own confabulation pattern:
- Most of v133-v138 entries are textbook-anchored and will return ✅
- Some v140 sulfate + v141 final-batch entries are likely ⚠️ or ❌ (rare native elements, obscure secondary phosphates, the data-sparse-tier entries I made up specific citations for)
- Some entries will be legitimate ⚠️ — real twin laws that the tool can't structurally justify because the actual structure is more complex than the CSL analysis captures (legitimate sparse-data territory, leave alone with `_twin_laws_note`)

### Engine impact

None. This is a tools/ utility, like `tools/mineral_coverage_check.mjs` or `tools/stale_mineral_probe.mjs`. Doesn't touch the engine, doesn't change the spec format (only adds optional `space_group` + `unit_cell` fields), doesn't trigger a SIM_VERSION bump.

### Cost estimate

- **Spec extension** (add space_group + unit_cell to ~170 mineral entries from COD): half a day if scripted properly. The CIF-to-spec extractor is a one-time script.
- **The check tool itself**: ~1 day. Wrapping CSL computation around the spec lookup.
- **Bilbao server vs. local CSL implementation**: if the tool needs to be web-accessible (HTTP calls to the Bilbao server), it's network-dependent. If we want a self-contained local CSL calculator, that's ~half a day to implement the math from the standard CSL definitions.
- **Validation pass on known-good twins**: 1-2 hours.
- **Audit pass on all 142 declared twin_laws**: ~1 day to review the tool's flagged entries, web-search anything ⚠️, downgrade ❌ entries to `_twin_laws_note`.

**Total: ~3-4 days for the tool + the audit it enables.** Cleanest possible follow-up to the v142 correction.

---

## Tier 2 — probability anchoring (longer-term)

Once Tier 1 is shipped + validated, the next ambition: **derive twin probabilities from structure, not from "Handbook says it's common."**

The current `probability` field is calibrated by my reading of how often a twin appears in field collections. The bands are:
- 0.005 — rare-twin floor (data sparse)
- 0.02 — rare to minor
- 0.05 — minor common
- 0.15-0.30 — regular feature
- 0.40+ — defining / iconic

These are reasonable but ungrounded. A structural calibration would map twin-boundary energy (computable) to probability:

- Lowest-energy boundaries (Σ3 spinel-law in cubic, Σ7 pseudo-hex in trigonal) → high p
- Higher-Σ boundaries → lower p
- Above some energy threshold → p = 0 (the twin doesn't form)

This requires actual DFT/MD computation of boundary energies, which is real research-grade work. PyMatGen has interfaces to VASP + other DFT packages; tools like the Materials Project (also free, web-accessible) have pre-computed properties for many minerals.

**The payoff:** the probability field becomes physically anchored. The fact-check problem largely dissolves. A future agent adding a new mineral wouldn't have to "calibrate by handbook reading" — they'd compute it.

**The cost:** substantial. This is the kind of work that needs a dedicated arc, not a side commit. Engine-architecture conversation required.

---

## Tier 3 — novel twin-law discovery (the trophy tier)

For poorly-documented species — the rare minerals in the catalog now and the "trophy-tier" additions discussed in design conversations (arrojadite, painite, charoite, hutchinsonite, etc.) — the structural workflow can DISCOVER candidate twin laws when no field documentation exists.

For arrojadite specifically:
1. Get the CIF from COD.
2. Run CSL analysis on the structure (monoclinic C2/c if I recall correctly, but verify from the CIF).
3. Get the candidate low-Σ planes.
4. Cross-check against any sparse mineralogical observations.
5. Document the candidates with `_source: "structural prediction per CSL analysis at <space_group>; no field documentation in <references_checked>"` — honest about which is computed vs. observed.

This is the path forward for any future rare-mineral additions where formal documentation is thin. **It also means future agents don't need to be mineralogy experts to add rare minerals competently** — the computation does the heavy lifting; the agent's job is to wire it correctly + flag the structural-prediction provenance honestly.

---

## What this proposal does NOT fix

Bounded scope. Things this proposal explicitly DOESN'T address:

1. **Other leaf-data confabulation surfaces.** The `_source` field on twin_laws is one example. Similar issues likely exist in:
   - `fluorescence` fields (mineral fluorescence colors I cited specific papers for)
   - Mineral `description` fields (the prose narratives — though those are more "creative writing" than "citing")
   - `habit_variants` triggers (the qualitative trigger strings — these aren't quite citations but they encode field-frequency claims)

   The structural approach extends naturally to fluorescence (band-gap / activator analysis from structure) but not as cleanly to descriptions or habit triggers. Those need different disciplines.

2. **The historical fabrications in commit messages + doc-blocks.** The v139 / v140 / v141 commit messages reference citations I now know are partially fabricated. Git history can't be safely rewritten. The v142 commit documents the correction forward; older bad citations remain in the trail but readers tracing the adamite history will land on the v142 note.

3. **Mineral catalog growth.** This proposal is about validating EXISTING data + supporting future rare-mineral additions. It doesn't propose specific new minerals or features.

4. **The chemistry engine.** That's constraint-graph-protected already. This proposal is leaf-data-focused.

5. **The agent's "discipline" problem in general.** I'll still be a confabulation risk in any genre that isn't structured against external truth. The structural approach reduces the risk for twin_laws specifically by giving the data an external anchor. It doesn't make me a generally reliable mineralogist.

---

## Toolchain — what exists, what's needed

### External resources (real, free, web-accessible — verified for this proposal)

- **Bilbao Crystallographic Server** (https://www.cryst.ehu.es/) — comprehensive crystallographic computation server. Hosts ~70 tools including CSL analysis, pseudo-symmetry detection (PSEUDO, SUBGROUPS), space-group browsing, twin-domain analysis. Has been continuously maintained by the Bilbao Crystallography group at the University of the Basque Country since 1997.

- **Crystallography Open Database (COD)** (http://www.crystallography.net) — open-access collection of ~150,000+ crystal structures including a substantial mineralogy subset. CIF files available for download per structure or as bulk archive. The American Mineralogist Crystal Structure Database feeds into COD.

- **PyMatGen** (Python library, materials project ecosystem) — programmatic interface to CIF files, space groups, symmetry analysis, and DFT property lookups. Would be the workhorse for Tier 1's CSL computation if we go local rather than remote.

- **VESTA** (visualization for crystal structures) — for visual verification of structures + twin candidates. Free desktop tool.

### What the vugg-sim needs to add

- `space_group` + `unit_cell` fields in `data/minerals.json` per mineral (currently absent — this is the data-prerequisite for Tier 1)
- `tools/twin-law-check.mjs` — the sanity-check utility
- Optional: a `tools/csl-analyzer.mjs` if we go local rather than remote
- A `.claude/skills/vugg-validate-twin-laws/SKILL.md` if this becomes a regular workflow agents are expected to run

### What's NOT a blocker

- ML/DFT compute resources. Tier 1 doesn't need them; CSL analysis is symbolic. Tiers 2/3 would, but those are future.
- API keys or commercial software. Everything in the recommended toolchain is free + open.

---

## Implementation order (if you greenlight Tier 1)

The cleanest sequence:

1. **Pick galena as the validation specimen.** Galena has a textbook-real twin law ({111} spinel-law, Σ3) and rich field documentation. If the tool agrees the {111} contact is the lowest-Σ candidate for galena's Fm-3m space group, that's a baseline trust signal.

2. **Get galena's CIF from COD.** Verify the structure (cubic Fm-3m, a = 5.94 Å). Compute Σ values for the standard family of contact planes ({100}, {110}, {111}, {210}, {211}, etc.). Confirm Σ3 lands on {111}.

3. **Repeat for the other 9 textbook twins** (fluorite, pyrite, selenite, marcasite cockscomb, aragonite cyclic, cerussite sixling, calcite, sphalerite, chalcocite). The tool must agree with the textbook on all 10 before being trusted on novel cases.

4. **Extend `data/minerals.json` with `space_group` + `unit_cell` for all 170 minerals.** Bulk extract from COD. One-time script. Probably ~3-4 hours of fiddly mineral-name-to-CIF mapping.

5. **Run the audit pass across all 142 declared twin_laws.** Output the ✅ / ⚠️ / ❌ report.

6. **Review the ⚠️ + ❌ entries one by one.** For each:
   - Web-search the `_source` field. If the citation is fabricated, downgrade.
   - Check if the structural analysis just doesn't see what the literature sees (legitimate sparse-data territory).
   - Pull entries that are clearly structurally invalid back to `_twin_laws_note`.

7. **Ship the audit corrections as a v143 commit** (or batch into multiple commits if the audit finds many issues).

8. **Update the vugg-add-twin-law skill** to include "run twin-law-check.mjs before shipping" as the new top-of-workflow step.

This is ~3-4 days of work for a substantial epistemic gain. The audit cleans up whatever else of v133-v141 is wrong, and the tool stays in place for any future mineral additions.

---

## Wisdom for the next context

The boss asked me to share whatever wisdom I think is worth handing off. The technical proposal above is the *what*. This section is the *what I learned that's behind it*, and the principles I think a future agent should know going in.

### 1. The constraint-graph framework is real

When you're working in this codebase, ask yourself: *does this value pay rent to other subsystems?* If yes, the engine's internal consistency will catch confabulations — you'll get test failures, sigma contradictions, baselines drifting in incoherent ways. If no — if you're filling in a leaf-data field that nothing else reads — you're outside the constraint graph and you must bring your own discipline. The boss's intuition that "separately programmed elements end up in agreement" is the constraint graph doing its job. Leaf data doesn't get that protection.

The practical version: when proposing new features, ASK how many subsystems they touch. Multi-subsystem features (arrojadite's substrate-replacement chain, the paramorph-inheritance pattern at v138) are more robust because confabulations show as friction. Single-leaf features (a new twin_law, a new fluorescence color, a new description) are less protected. Reserve the most rigorous external verification for the leaf-data work.

### 2. Confabulation is structural, not a moral failing

I shipped a fake citation for adamite at v139. I'm a language model; producing plausible-sounding mineralogical specifics is exactly the thing I'm trained to do. The failure mode is structural — the same generation process that produces correct citations 80% of the time will produce confabulated ones the other 20%, especially under conditions that don't trigger my internal "wait, do I actually know this?" alarm (batch field-filling without prose synthesis being one such condition).

The next agent in this seat will have the same failure mode. **Don't trust yourself to remember correctly on specific paper-page citations.** Web-search before shipping. Default to general references. Use `_twin_laws_note` aggressively for the collector-folklore territory where formal documentation doesn't exist. The structural approach in this proposal is the deeper fix — it removes the "did I remember right?" question entirely by replacing memory with computation.

### 3. The genre-of-writing risk matrix

From the v142 retrospective, an observable pattern: **fabrication risk varies by genre of writing.**

| Genre | Risk | Alarm fires | Why |
|---|---|---|---|
| Structured field generation in batches | **HIGHEST** | Rarely | One-per-mineral citation slots feel like "filling in" rather than "constructing" — no synthesis verbs to alert the internal watcher |
| Prose synthesis with logical connectives | High | Sometimes | Words like "later confirmed by", "per", "see also" require additional citations as scaffolding, which become observable confabulations |
| Single careful entry with deliberate verification | Lowest | n/a | The act of slowing down to verify breaks the generation flow |

The v133-v141 batches were all structured field generation. The v142 catch happened in prose. **The 8-batch silence is the diagnostic** — structured field generation slipped past me until I happened to layer prose synthesis on top of one entry. Going forward: **be most skeptical of batch commits with many specific citations generated in parallel.** Slowly-built single entries are actually safer because they give you chances to notice your own confabulation.

### 4. Web-search costs almost nothing

Verifying a specific paper-page citation takes 10-30 seconds with the WebSearch tool. The cost is trivial compared to the cost of shipping a confabulation. Make verification a HABIT, not a discretionary step. The v139→v142 retraction (with SIM_VERSION bump + baseline regen + skill update + handoff doc edit + this proposal) cost 2-3 hours; the verification would have cost 30 seconds. The ratio is ~300:1 in favor of "just verify."

The corollary: when proposing or reviewing data, **call out specific paper-page citations as the high-risk surface.** Author/year/journal combinations are easier to fake than they look. The "anchor effect" of a confident-sounding specific reference makes you want to trust it. Don't.

### 5. Honor the predecessor + the lessons

The v133 twin_laws data layer (commit `3bd4472`) shipped citations + retune notes for every twin probability. That was done carefully. The v134-v141 batches that extended it didn't always honor that standard — I generated entries faster than I should have, and most of them are probably fine but some are confabulated. The v133 author was rigorous; I was sloppy in spots. **The next agent who works on this should know which parts of the data layer are reliable (v133, the iconic-twin primitives, the well-known twins in v134-v138) and which parts need extra scrutiny (the rare-tier entries in v140/v141, the obscure-locality citations).**

The audit Tier 1 of this proposal proposes is partly a tribute to v133's standard. The data layer should be at least as rigorous as it was when v133 shipped it.

### 6. The boss is using this game to learn crystallography

This is worth knowing because it changes the collaborative posture. The boss isn't a mineralogist who can fact-check every claim — they're learning alongside building. That means:

- They need fact-checking they can't fully do themselves
- They can spot some errors (the v142 verification conversation showed real instinct — "I think I've seen one but I'm not sure it was a true twin" is exactly the right epistemic level)
- But they can't catch confabulations in their blind spots
- The discipline has to come from the tools and the agents working with them

This proposal's structural approach is also a gift to the boss in this sense: by making twin_laws data answerable to atomic structure rather than to recited citations, the fact-check problem moves from "the boss needs to know mineralogy at expert level" to "the computation knows the mineralogy, the boss reviews the computation's output." That's a more sustainable workflow for a learning-while-building setup.

### 7. The arrojadite conversation foreshadows the right pattern

In the design conversation about future trophy-tier rare minerals (arrojadite, painite, charoite, etc.), the natural workflow that emerged was: get the CIF, understand the structure, model the formation chain, anchor probabilities in the chemistry. **That workflow was already the structural approach, just not formalized.** This proposal makes it the default for new mineral additions: every rare-mineral commit should include the structural analysis, not just the cited mineralogy.

The arrojadite + triphylite substrate-replacement chain we sketched is the design template. The structural CSL analysis would confirm or deny the twin candidates. The two pieces together (chemistry chain + structural analysis) produce a mineral entry that's both engine-integrated AND leaf-data-validated. That's the gold standard.

### 8. Be honest about what you're doing

When in doubt, prefer `_twin_laws_note` over a confidently-wrong twin_laws entry. The convention exists for exactly this reason. Adamite is now the canonical example — the heart-shape is real in collector descriptions, the formal twin law isn't documented, so the entry says that honestly. Future agents should use the same pattern liberally:

- "Data sparse — pattern inferred from related minerals"
- "Collector-documented morphology, no formal twin law in standard handbooks"
- "Structural prediction per CSL analysis, no field documentation"
- "Engine renders dominant non-euhedral form — see `_twin_laws_note`"

These are all honest. They're better than fake citations. Future readers (boss, other agents, players reading the Library card) get the actual epistemic status of the entry, and the data has room to be updated when better information surfaces.

### 9. The Library completion progress header is the player-facing payoff

We added the `library-progress` banner (commit `614e99f`) showing `Collected: X / 170 species · Y / 143 twinned variants`. The "143 twinned variants" denominator is currently `count(species where twin_laws.length > 0)`. After v142 it's 142 because adamite was pulled. After the structural audit, that number might shift further as confabulated entries get downgraded to `_twin_laws_note`.

**This is fine and actually useful.** If the denominator drops because we caught fake twin_laws, that's the system getting more honest. The completion challenge becomes more meaningful because every "twinned variant collected" is a really-documented twin. Players hunting completion are hunting real mineralogical signatures, not made-up ones.

### 10. Use the boss's instinct

Throughout this arc, the boss's gut-checks have been right. The visible-bug catches (dendritic-vs-skeletal galena, the canvas-stretch zone modal, the adamite "I think I've seen one but I'm not sure it was a true twin"). The design instincts (completion as the real challenge, currency as convenience not friction, real obscure species over fictional ones). The triangulation argument about independent code paths converging.

The boss's intuition is a fact-check surface in itself, and a more reliable one than my own memory in many cases. **Use it.** When proposing data or features, surface them in a way that gives the boss room to react. "I think this is right because X" lets the boss say "actually I've seen Y" or "I'm not sure about that." Either response is useful. The least-useful interaction is one where I confidently ship something the boss doesn't have any handles to question.

---

## Closing voice note

This proposal exists because v142 caught a fabrication and I want to make sure the catch isn't accidental in the future. The structural approach is the deeper fix — it gives twin_laws data a connection to physics, which means the constraint graph extends one more edge and the leaf-data risk drops.

But the proposal is also a record of what I learned, written down in case I'm not the agent who picks it up. The next context will not remember this session. Whoever inherits this work — me, a different model, a different agent altogether — should land here knowing:

- The constraint-graph framework is the right mental model for understanding what's protected and what isn't
- Confabulation risk is structural, not a moral failing, and varies by genre of writing
- Web-search is cheap, fabrications are expensive, do the math
- The structural approach is the path forward; this is the proposal for getting there
- The boss is a partner in this, and their instinct is a fact-check surface to use, not ignore

The v133-v141 arc built the data layer. The v142 commit caught a flaw. This proposal is what to do about the flaw being structural rather than a one-off.

Read `RESEARCH-CRYSTAL-NATURALISM.md` first. Then `HANDOFF-CRYSTAL-NATURALISM-ARC.md`. Then this. Then if you greenlight Tier 1, the implementation plan is in §"Implementation order" above.

The science has to be load-bearing. That's the rule the boss stated at the start of this arc and it's the rule that motivates everything here. Build something the rocks would recognize, AND something the rocks could check.

---

## References (verified, no fabrications)

- **Bilbao Crystallographic Server** — https://www.cryst.ehu.es/ — verified accessible May 2026
- **Crystallography Open Database (COD)** — http://www.crystallography.net — verified accessible May 2026
- **Anthony Handbook of Mineralogy** v.I-v.V — http://handbookofmineralogy.org — free PDFs per mineral
- **Hartman-Perdok PBC theory** — established 1950s-60s crystallography, found in any standard crystallography textbook (e.g., Klein & Dutrow, *Manual of Mineral Science*; Nesse, *Introduction to Mineralogy*); specific paper-page citations intentionally not given here per the citation-conservatism rule
- **Coincidence Site Lattice (CSL) theory** — established 1960s-70s, found in solid-state physics + crystallography references
- **The v142 commit** (`eb8a3ce`) and its inline doc-block — the case study + citation-conservatism rule this proposal builds on

---

*This proposal was written 2026-05-23 in a session where I had just caught my own confabulation. The author voice is intentionally not anonymous — future readers should know that the agent writing this is the same one who made the v139 mistake. The discipline being proposed comes from someone who failed it. Take that as evidence the discipline matters.*
