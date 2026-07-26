# research/ — layout rule (2026-07-25, boss directive: research is scenario-specific)

- **scenarios/<scenario_key>/** — research anchored to ONE scenario/locality: eye-check
  investigations, locality paragenesis studies, mindat-sweep follow-ups, specimen-anchored
  work (e.g. `scenarios/elmwood/research-celestine-elmwood-2026-07-24.md`,
  `scenarios/deccan_zeolite/research-apophyllite-tn498.md` — TN498 is Nashik material).
  NEW SCENARIO RESEARCH LANDS HERE — create the folder with the scenario's
  scenarios.json5 key when its first doc arrives.
- **minerals/** — the per-SPECIES research library (`research-<mineral>.md`). These stay
  out of scenario folders on purpose: a mineral serves many scenarios and its tenancy
  shifts over time (witherite is dead fleet-wide today; TN457 may seat it tomorrow).
- **arcs/** — cross-cutting engine/arc research: the fluid.S split, the broth-ratio
  series, meta-minerals, the initiative variable, fleet audits/matrices.
- **notebook/** — the curiosity journal + scholarly curios (threads, demonology).

Cross-references: proposals/, data/, and js/ comments cite research paths — when moving
a file, `grep -rn "research/<name>"` across proposals/ data/ js/ tools/ and rewrite in
the same commit (js comment changes require an `npm run build` rebundle).
