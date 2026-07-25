# HANDOFF — S2 walks the sulfates; the review protocol has a paper trail (2026-07-25)

For the fresh context that continues the S-split arc. This bridge supersedes
`HANDOFF-S-SPLIT-2026-07-17.md` (historical — S1 landed, both its Elmwood diversions
landed, its celestine tranche landed and was then CORRECTED by the boss's review).
Keystone lineage: `HANDOFF-FOUNDATIONS-2026-07-03.md`, **twenty-fourth hand — "the
recognizer, not the mechanism"** (this stretch's story + its six lessons).

**State: SIM 236, HEAD `96dacab`, cold-CI stamped GREEN, Pages built == HEAD, 2436/2436.**

## The commit trail of this stretch (all pushed, newest first)

- `96dacab` sim: **celestine Ba-gate CORRECTIONS from the boss's review** (byte-identical;
  carbonate-host guard + mechanism claim withdrawn) ← the stamp
- `41c9876` docs: S2-celestine banner + memory sync
- `5712f44` sim: **S2 celestine tranche (SIM 236)** — migration + ÷18 re-anchor +
  elmwood_diagenetic_sr (Sr 10→30, Hanor) + ba-fibrous gate + botryoidal blanket render
- `d6b9ae7` render: **pan camera** — middle-mouse hold-to-pan; hover no longer blocks
  drags; pan was fully INERT in the mesh view (camera never read the offsets) — now a
  camera-space rig translation scaled by zoom
- `8445640` docs: celestine research note (census + literature; the Sr-starvation finding)
- `7deec94` render: **calcite dogtooth fix** — display aspect from the Wulff form's own
  geometry, not the volume ellipsoid (boss: "looking good")
- `aeff2fb` sim: **S1 — barite reads sulfateAvailablePpm (SIM 235)** — ÷20 re-anchor +
  wittichen sulfateInherited carve-out (byte-identical there)

## Read first (in this order)

1. `research/research-celestine-elmwood-2026-07-24.md` — the celestine story INCLUDING
   §7, the correction record (what the boss's review overturned and how it was verified).
2. The boss's review itself: **issue StonePhilosopher/vugg-simulator#1** — the first
   cross-repo research artifact. The protocol: cross-check his research against ours;
   disagreements get FIRST-HAND verification; his issues, our commits.
3. `proposals/BACKLOG.md` top banner — the S2 state + what remains.
4. Commit messages `5712f44` + `96dacab` — the field notes with per-part numbers.

## THE NEXT ACTION — S2 selenite migration (boss pre-approval IN HAND)

S0's census pre-registered selenite@elmwood as a casualty of the migration (bare-wall
sulfate in a reducing broth, unrescuable at any honest wCold). The boss has ALREADY RULED
on that outcome, verbatim: **"selenite disappearing is good, i havent seen any selenite
from elmwood, so that sounds like the science doing its job."** So the elmwood death
lands as a DE-CONFABULATION (tiger's-eye family: absence in the specimen record licenses
absence in the sim), not a regression to rescue.

The commit shape:
- Migrate `supersaturation_selenite` (js/40) to sulfateAvailablePpm; census-first for the
  divisor (the S1/S2 swap-census method — `tools/celestine-tranche-census.mjs` is the
  template; measure per-tenant sulfate fractions, do NOT copy ÷20 or ÷18).
- Selenite has OTHER tenants (naica's giant crystals are its showcase — naica selenite
  must survive; sicily, sabkha, GSP all carry gypsum-family). Census every tenant BEFORE
  choosing; any legit starvation = re-anchor, elmwood alone = let it die.
- **`tests-js/elmwood-snowball.test.ts` ~line 106**: the variety guard iterates
  `['selenite', 'galena', 'siderite']` and requires each present — REMOVE selenite from
  that list IN THE SAME COMMIT, citing the boss's ruling (the same guard already dropped
  aragonite v228 and smithsonite SIM 233; the comment pattern is established there).
- Standard ritual: bump SIM FIRST → rebake → both standing census gates → explicit
  staging → commit -F tempfile → push → stamp.

After selenite: anhydrite, mirabilite/thenardite, chalcanthite, the Cu sulfates,
alunite/jarosite — each census-measured, then S3 (thioarsenite re-coupling to
sulfideAvailablePpm + the +100 ceiling retirements).

## Traps this stretch paid for (don't pay twice)

- **A clean blast is an empirical fact, not a structural guard.** The naked ba_ratio gate
  was censused-clean at seed 42 and still design-wrong (boss's ruling). Guard by context
  (carbonate host), not by today's fleet happening to cooperate.
- **Real citations don't license the claim beside them.** The "Ba²⁺ splits the growth
  front" comment cited real spherulite literature and was still wrong — SP2006, verified
  first-hand, runs TABULAR at the Ba end. When the boss's research disagrees with ours,
  the disagreement points at exactly what to verify first-hand.
- **Verify the consumer, not the setter.** Pan updated its offsets perfectly for months;
  the three camera never read them. Grep for who CONSUMES a state variable before
  trusting any input-chain fix.
- **The display aspect must come from the form's own geometry.** The volume ellipsoid is
  honest for mass and wrong for silhouette (the "two low pyramids" dogtooth).
- **jsdom probes: fresh page per probe.** Carrying sim state across live-tab probes
  corrupts RNG-order comparisons (the S1 lesson, still true).

## Carried forward (don't lose these)

- **BOSS ACTION (self-assigned 2026-07-25): capture the mindat valid-species list for
  the OTHER mine scenarios**, the way it was done for elmwood (screenshot of the
  region's filtered Mineral List → recorded as a MINDAT VALID-SPECIES REFERENCE note in
  the scenario's `notes` array in data/scenarios.json5). The elmwood entry is the
  template — it turns the specimen-record test into a per-scenario instrument: absences
  license de-confabulations (elmwood: no gypsum-family = the selenite ruling;
  siderite NOT listed = new census flag on the variety guard), presences queue
  candidates (elmwood: marcasite/pyrite/quartz/vaterite/bitumen unfired-but-documented).
  Natural next targets: mvt (Tri-State), bisbee, tsumeb-family, naica, searles,
  roughten_gill, tn457's Nentsberry-Haggs, sunnyside, wittichen, schneeberg.
- **Boss eye-checks owed in the deployed game**: the celestine blanket (2.69mm plumose,
  elmwood late stage), the calcite dogtooth (confirmed once — "looking good" — but the
  correction re-render is unseen), the pan camera feel (middle-mouse + deep-zoom), PLUS
  the standing nine-bump debt (SIM 226–234: searles borax, tn457 de-salting, the 4d
  re-deals, deccan stilbite, sunnyside).
- **TN457 witherite ID**: boss crowdsourcing; NO destructive tests (comparables run
  $7–10k); catalog amendment + the witherite engine's first tenant both WAIT on it.
- **The boss's third guard condition** — substrate/paragenesis proximity (near
  barite/sphalerite/calcite) — deferred honestly: grow_ can't see substrate today;
  needs nucleation-side plumbing if ever wanted.
- **Canary**: still Windows-only; boss on Linux needs a cron/systemd installer in
  vugg-canary. Owner action `node src/schedule.mjs --install` still unarmed.
- **Scenario candidates**: perennial brine (chevron band tenant), potash (wakes sylvite),
  BIF (tiger's-eye), Sunnyside boiling → native gold, Sweetwater snowball + Elmwood
  perimorph ([[project_vugg_future_mvt_scenarios]]).
- **MEMORY.md** sits near its soft size target — a consolidation pass is due.

*Twenty-fourth hand's bridge, 2026-07-25. The keystone for this stretch is in
HANDOFF-FOUNDATIONS-2026-07-03.md ("the recognizer, not the mechanism").*
