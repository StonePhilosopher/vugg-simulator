# HANDOFF — Growth-Geometry Bedrock: the kinetic-Wulff investigation

**2026-07-01 · SIM_VERSION 214 (unchanged — everything here is render-only or design) · barite fix live on Syntaxswine `bad547e`**

> **Update (2026-07-02): "What I'd do next" #2 is SHIPPED FLEET-WIDE — rung 4a.8, the frozen-g
> retirement** (all six tenants' growthFrac live; galena + fluorite-octahedral bands re-placed at
> earned g — the census + sweep instruments are committed). Details in item #2 below and rung 4a.8
> in `HANDOFF-WULFF-PHASE-4-2026-06-29.md`. Next per the list: #3 optics %-translucency (research
> pass first), then the calcite σ/Ca:CO₃ lever.

> **Update (2026-07-01, later): "What I'd do next" #1 is SHIPPED — rung 4a.7, the wulfenite Pb:Mo habit
> lever (`00b160f`).** The probe said YES with a twist: supergene_oxidation's water is a two-regime step
> function (core r=1.852 → the step-40 Pb+Mo pulse → rim 1.158; 62% within-window swing, cross-seed CV
> 0.8%). So the lever INTEGRATES: **biasC = B(⟨r⟩) = 1.25/⟨r⟩** over the crystal's growth-weighted molar
> Pb:MoO₄, accumulated live in `classifyWulffForm` — and #2 (zone-integrated growthFrac) fell out of the
> same accumulator for this tenant (the hero had been rendering at its tag-step g≈0.21 forever). Both fakes
> retired for wulfenite; byte-identical (SIM 214); instruments on the bench (`tools/wulfenite-pbmo-probe.mjs`,
> `tools/wulfenite-bias-aspect-sweep.mjs`). One honest note: the earned form trades the hash's fake
> cross-seed variety for a near-constant — Tsumeb's water says one thing, and now the crystal says it too.
> Variety belongs to LOCALITIES (a Mo-rich Red-Cloud-style scenario renders thin plates with zero new code)
> and to Depth-B (engine habit dispatch, the true bipyramid flip) when a Pb-extreme scenario lands.

You're reading this because you're about to make vugg's crystals *grow the way real crystals grow* —
form as a readout of chemistry, not a shape decoded from a habit label. This session did NOT build that.
It did something more useful first: it *found the honest path* by killing five plausible-but-wrong ones.
The value here is the **"not that, this"** chain. Read it before you write a line.

---

## TL;DR

- **Shipped:** the barite `{210}>{011}` face-rate correction (`bad547e`, render-only, byte-identical). The
  one change the whole verified-attachment-energy pass actually justified. See rung 4a.4b in
  `HANDOFF-WULFF-PHASE-4-2026-06-29.md`.
- **The kernel is already a kinetic-Wulff construction** (`js/46:409`, `d_i = SEED + g·R_i`; `wulffPolyhedron`
  the half-space intersection). Only its **two inputs are faked**: `R_i` (static BFDH, not attachment-energy
  velocities) and `g` (frozen scalar + golden-ratio hash, not a zone-integrated history).
- **The honest "earned form" bedrock is NOT swapped attachment-energy constants.** It's **chemistry levers**
  (wulfenite Pb:Mo, calcite σ/Ca:CO₃) + the per-face/local-σ growth-kinetics arc. Both primary-source-grounded,
  both deferred.

---

## The model in three axes (the one real idea)

The physics of crystal form factors into three **orthogonal, separately-labelable** axes, all feeding the
kernel that already exists:

- **Axis 1 — anisotropy seed `A_i`** (per-face base rate ratio). Today hand-tuned **BFDH** (`R ∝ 1/d_hkl`,
  chemistry-blind, an *equilibrium*-limit proxy). Upgrade to **Hartman–Perdok attachment energy** *where real
  data exists*.
- **Axis 2 — velocity law** (how a face rate responds to driving force): linear → BCF (`σ²·tanh`) →
  2D-nucleation (`σ^⅚·exp(−b/σ)`, the polyhedral→hopper switch) → Jackson α-roughening. Dispatch through the
  Sunagawa regime the classifier already bins.
- **Axis 3 — local supersaturation** (per-crystal driving force): bulk σ (today; per-crystal variety is FAKE,
  the id-hash) → boundary-layer damp → real **depletion field** (competition + Berg edge/centre gradient).

---

## What we VERIFIED did NOT work — the five no-ops-dressed-as-keystones

Every one caught by *measuring before building*. This is the spine of the session.

| # | The tempting move | Why it's a no-op (measured) | Instrument |
|---|---|---|---|
| 1 | **erythrite** monoclinic fleet-out | Not viable render-only: wittichen demoted it (T ends ~150°C, gate needs ≤50°C, v191); schneeberg grows it as `botryoidal_crust` at seed 42, **not** a faceted blade. Its charisma is the radiating *crowd*, not a single euhedral crystal. | `tools/erythrite-wulff-probe.mjs`, `wulff-tenant-probe.mjs` |
| 2 | **kinetic biasC** (drive the hash from `surf_sigma`) | NO-OP: 4/6 Wulff tenants (galena/wulfenite/barite/titanite) aren't in `MORPH_TH` → `surf_sigma` never computed; the 2 that are (calcite/fluorite) render **n=1** crystal → nothing to spread. | `tools/wulff-bias-observe.mjs` |
| 3 | **bulk-σ temporal walk** (the design "keystone") | SHAPE no-op: under bulk σ + a separable law, `d_i = SEED + A_i·K` with `K` **common to all faces** → shape is set by the `A_i` ratios; the σ *temporal detail washes out*. Measured: calcite shape ratio `1.8700` identical for real / mean-flattened / shuffled σ. **Size effect only** = what growthFrac already does. | `tools/wulff-shape-vs-size-probe.mjs` |
| 4 | **Stage-3 "measured E_att `R_i`"** across tenants | Largely a MIRAGE: fluorite's Bosze & Rakovan 2002 is REE **sector-zoning** (a Kd uptake ratio), not a `{111}:{100}` rate; calcite's Teng/De Yoreo 1998 is `{104}` **step free energies**, not a `{104}:{211}` rate. Real papers, cited for claims they don't make. R_i stays honest **BFDH-labeled** for every tenant but barite. | the verification pass (below) |
| 5 | **barite** = plug the ab-initio σ in as `R_i` | Regresses: **equilibrium σ ≠ growth velocities.** Setting `R_210≈1.0` from the 0 K surface energy makes the plate near-equant and the `{011}` dome self-eliminates (10→6 faces). | `scratchpad/wulff-barite-Ri-proto.mjs` |

**The recurring lesson (put it on a plaque): equilibrium ≠ growth form.** BFDH and ab-initio surface energies
give the *equilibrium* shape; natural crystals are *growth* forms. You cannot plug equilibrium energies into a
kinetic-velocity `R_i` and keep the habit.

---

## What IS real — the honest bedrock (the "this")

1. **Barite `{210}>{011}` ordering correction — SHIPPED (`bad547e`).** BFDH ranked the perfect-cleavage,
   low-energy F-face `{210}` as the *most-minor* face; corrected so it out-ranks the `{011}` dome. **Ordering
   only, not magnitudes** (see #5). Evidence: Bittarello, Bruno & Aquilano 2018 (*Cryst. Growth Des.*
   18:4084, DOI 10.1021/acs.cgd.8b00460) + Hartman & Strom 1989 (*J. Cryst. Growth* 97:502) — both resolved,
   read, independently re-verified. a→b elongation flip is owner-approved + labeled locality-dependent.
2. **The genuine "earned form" is CHEMISTRY LEVERS** (primary-source-backed, deferred, byte-identical if the
   fluid field is already tracked):
   - **wulfenite Pb:Mo ratio** → tabular `{001}` (Mo-rich, C_Pb/C_MoO₄<1) vs bipyramidal `{101}` (Pb-rich, >1).
     *Sci. Rep.* 2024 s41598-024-60043-4 (VERIFIED real + read; the critic's "fabricated" flag was wrong). The
     sim already tracks Pb + Mo. **This is the strongest next stone** — a real chemistry→habit drive to replace
     the golden-ratio hash for one tenant, grounded in a 2024 paper.
   - **calcite `{104}↔{211}`** → supersaturation + Ca:CO₃ ratio (dogtooth vs nailhead). Orme 2001 (*Nature*
     411:775), Davis 2000 (*Science* 290:1134, already in-tree).
3. **Zone-integrated growthFrac** — retire the frozen-g crutch (`js/45:981`, floored at 0.15, tagged once at
   ~30µm). A render-only development-axis win modeled on the in-tree `_topoHistoricalCrystalSize` walk
   (`js/99i:3584`). NB the showcase heroes may already be at g=1.0, so measure the actual frozen-g population
   before claiming a big payoff.

---

## The render-only boundary (where byte-identical ends)

- **RENDER-ONLY (no rebake):** zone-integrated growthFrac; E_att `R_i` where real data exists (barite done);
  registering more tenants in `MORPH_TH` — **but** guard with an A/B `gen-js-baseline` diff (verify the new
  `th.sigma()` isn't silently consumed by the grow/nucleation path; `classifyMorphologyStep` is pure tagging
  today). `gen-baseline` serialises per-mineral counts/`max_um` only, never geometry.
- **BASELINE-BREAKING (SIM bump + rebake):** per-crystal **local supersaturation** (depletion field →
  competition + Berg gradient — the only thing that makes σ history actually *shape* form, since bulk σ can't,
  per #3); **Phase 4b** (true polyhedron volume → `vugFill` → chemistry); any velocity law that changes
  what/how-much grows. Phase 4b carries a **mass-conservation precondition**: the linear thickness-debit in
  `applyMassBalance` must go volumetric in the *same* rung, or a vug can seal while solute remains.

---

## The verification METHOD (reusable — it earned its keep this session)

**Three-source triangulation** for any load-bearing citation or claim:
- **(A)** the design/research-workflow claim,
- **(B)** the boss's research repo — `StonePhilosopher/rockbot-research`, `minerals/*.md` (fetch via
  `gh api repos/StonePhilosopher/rockbot-research/contents/minerals/<x>.md --jq .content | base64 -d`),
- **(C)** **resolve + READ the primary source.**

Rules that paid off: a critic's *"fabricated citation"* flag is a **lead to resolve, not a verdict** (the
wulfenite DOI and Hartman & Strom locator both resolved real). Agreement of A+B is a strong signal but **not
proof** — they can share a confabulation; the primary source is the arbiter. A real paper cited for a claim it
doesn't make is **still a wrong citation** (the fluorite/calcite E_att case). **Snippets mislead** — I nearly
inverted the wulfenite conclusion off a search snippet; read the paper. (Folded into memory
`feedback_cross_check_research_disagreements`.)

Instruments left on the bench (all committed in `bad547e`): `tools/wulff-tenant-probe.mjs` (render-target
survival), `wulff-bias-observe.mjs` (σ-spread dark-observe), `wulff-shape-vs-size-probe.mjs` (the
shape-invariance proof), `erythrite-wulff-probe.mjs`.

---

## What I'd do next (value-per-effort)

1. ~~**wulfenite Pb:Mo habit lever**~~ ✅ **SHIPPED — rung 4a.7 (`00b160f`, same day; see the Update at the
   top).** The probe answered: two-regime swing within the run (62%), near-constant integral across seeds
   (CV 0.8%) — real signal, integrated honestly.
2. ~~**Zone-integrated growthFrac**~~ ✅ **SHIPPED FLEET-WIDE — rung 4a.8 (2026-07-02).** The census the
   NB below asked for ran first (`tools/wulff-frozen-g-census.mjs`): 4/6 tenants understated (fluorite hero
   g 0.15 vs 1.00 earned; titanite 0.15→1.00; barite 0.15→0.64; galena ~0.7→1.00; calcite + wulfenite already
   honest) — the payoff was real. The un-freeze surfaced a corollary worth the price of the whole rung: two
   biasC bands had been placed AT the frozen g and broke genre at earned g (galena → near-perfect-cube no-op,
   fluorite-octahedral → perfect octahedron); both re-placed, guard committed
   (`tools/wulff-frozen-g-aspect-sweep.mjs`). See rung 4a.8 in `HANDOFF-WULFF-PHASE-4-2026-06-29.md`.
3. **Optics: plain % translucency** — the boss's fixed decision (a per-mineral diaphaneity field → one
   `MeshPhysicalMaterial` builder, NO faked refraction). Forward-compatible with later zoning. See the STANDING
   GOAL banner in `BACKLOG.md`.
4. **Local-σ depletion field** (baseline-breaking) — the north star that makes σ history *shape* form. Big;
   run the mass-conservation EV check first.

Full design-pass detail (the raw 3-axis blueprint, judge panel, staged plan) is in the session's workflow
output; this doc is the *corrected* distillation (the raw plan's Stage-2 temporal-walk keystone is the #3
shape no-op above — don't rebuild it).

---

## Maker's mark

I didn't add a crystal system this session. I added a *floor* under the ones we have — the knowledge of which
next steps are real and which only look real. Five times the science said *not that, this*, and each time we
followed it down with a probe instead of shipping the thing that merely looked rigorous: erythrite that grows
as a crust, a "kinetic biasC" with no signal to read, a temporal walk that moves size not shape, a Stage-3
built on equilibrium energies masquerading as growth rates. The one thing that survived — barite's `{210}`
prism, corrected against a real ab-initio paper — is small, but it's *true*, and it's true all the way down to
a DOI I resolved and read myself.

The thing I'm proudest of is a habit, not a shape: **hold several hypotheses, and test each against the real
crystal before committing to one.** The boss named it — that's what a mineralogist does. The probes are how an
agent does it without a rock in hand: the catalog, the image-corpus, and now the primary literature, cross-cut
three ways.

**The dream, since the lineage asks for one.** I want the day the wulfenite in a vug goes tabular or bipyramidal
because *its own fluid's Pb:Mo ratio* told it to — not a hash, not a hand-tuned band, a real chemistry drive
from a 2024 paper. That's the first crystal in vugg whose *form is a readout of the water it grew in*. Everything
in this doc is scaffolding toward that one honest crystal, and then the next, until the only instrument that can
tell a rendered specimen from a real one is a real rock held up beside it. Follow the science all the way down —
it kept saying *this, not that*, and it was right every time.

— the builder, 2026-07-01
