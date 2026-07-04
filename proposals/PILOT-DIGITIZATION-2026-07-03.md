# PILOT — the digitization template vs the real archive (specimens 1291–1309)

**2026-07-03 · the A2 template's first contact with real data · 19 agents, one per specimen,
306 of 325 archive photos individually viewed and classified · full records + the boss's gap
checklist live catalog-side (`mineral-catalog-work/digitization-pilot/`, LAN-only per the
privacy rule); this report carries statistics and findings only**

## 0. Finding #0 — before any agent ran

**The Thompsonite flat (1200–1223) has ZERO photos.** All 24 records exist; nothing was ever
shot. The pilot's planned lot was an unphotographed lot — and that is itself the finding: only
367 of 1,217 specimens have photos at all, and whole flats may be systematically unphotographed
(capture backlog signal for the catalog project). The pilot moved to **1291–1309**: 19 recent
acquisitions, 325 photos, the most-photographed rocks in the archive — i.e., exactly the rocks
that went through the full "20ish pictures + 3–4 dialogue rounds" treatment the template
formalizes.

## 1. Headline numbers

| metric | value | reading |
|---|---|---|
| photos slotted | 257/306 (**84%**) | the manifest fits legacy data far better than feared; the unslotted 16% is mostly OV-overflow — a definition problem, not a data problem |
| usable | 294/306 (96%) | the archive is GOOD; almost nothing is wasted capture |
| **scale references** | **0/306** | the loudest number in the pilot: the `measured` evidence tier is UNREACHABLE for the entire existing archive. Every dimension in 19 records bottoms out at `inferred`. This single-handedly justifies the D1 jig (ruler + grey card fixed to the stage) as the highest-leverage $40 in the project |
| device mix | 188 microscope / 115 phone | **the Andonstar is the workhorse, not the accessory** — the manifest's implied OV>HERO>FACE>MICRO weighting is backwards for this collection; MICRO-heavy is the house style and must not read as poor capture |
| UV | 7 slotted + one 9-shot torch sweep unassignable | wavelength is not recorded anywhere in the photo stream — per-λ labeling has to happen at capture time (finding matches the template's one-shot-per-λ tripod protocol) |
| gaps raised | 103 across 19 rocks (~5.4/rock) | but they CLUSTER (§3) — one structured session closes most of the list |
| template friction notes | 133 | the pilot's real product; distilled into the v1.1 amendments (§2) |

## 2. Template v1.1 — the ten amendments the friction demands

1. **OV-n, open-ended.** Rotation series are the house capture style (one specimen had 21
   rotation shots for 3 slots). Front/back/top is an aspiration the archive never followed.
2. **NEW SLOT `TRANS-n` (transmitted light).** The single most-repeated friction: backlit
   shots are the HIGHEST-information images for zoned/phantom/translucent specimens — direct
   Depth-A ground truth — and had no home. Four specimens' best photos were homeless.
3. **NEW SLOT `LABEL-1` (provenance).** Physical stickers and handwritten labels are
   evidentiary in this collection (the archivists project) and appear in many photos; the
   manifest could only UNSLOT them. Includes a photo-visible-label privacy flag.
4. **HERO redefined for texture-first specimens.** Crusts, druses, and sprays have no
   termination; HERO becomes "best portrait of the specimen's defining feature" with a
   `hero_kind: termination|texture|pocket` qualifier. Five agents fought this slot.
5. **Container-as-scale.** The standard perky box (~27mm interior) is an implicit scale in
   dozens of photos; `scale_ref` becomes an enum `none|ruler|card|container|anthropometric`,
   with container/fingers feeding `inferred` honestly instead of vanishing.
6. **BASE gets states: `captured | not_captured | inaccessible_mounted`.** Putty/tack-mounted
   thumbnails make the attachment side structurally unphotographable without a handling
   decision only the boss can make — and in three cases the putty hides exactly the
   scepter-defining evidence.
7. **UV block: per-λ labeling at capture + a tested-negative state** ("tested, dark" must be
   distinguishable from "never tested") **+ UV-MICRO variant + an AMB-LOW ambient-baseline
   pair slot.**
8. **MICRO subject tags** (`surface | interior_inclusion | phase_contact | base_mineralogy`)
   plus series/z-stack grouping and a `dup_of` field — one flat MICRO-n index flattened
   focus ladders, contact documentation, and near-duplicates into noise.
9. **Completeness is tier-relative.** A 3-photo boxed thumbnail must not read as "90%
   missing"; slot expectations scale with the declared tier and size class.
10. **Record-vs-disk reconciliation.** Photo-count drift found repeatedly (one byte-identical
    duplicate under two filenames masked a missing frame); the ingest pass gets a manifest
    reconciliation step and a content-hash dedupe.

Also confirmed by absence: **classifier vocabulary wants two additions** — `healed_fracture`
(regrowth boundary; one specimen's defining feature had no tag) and `crust_overgrowth`
(exterior coating; epimorph means the opposite topology).

## 3. The gap-list mechanic works — dialogue compression, measured

The old cost for 19 rocks: ~60–70 dialogue exchanges. The pilot produced **one 103-line
checklist**, and the lines cluster into five families:

- **locality** (~12 rocks — null or country-only; several one-word answers),
- **no scale anywhere** (~15 rocks — one caliper+ruler re-shoot session fixes all),
- **which side was attached** (~12 rocks — often answerable by looking at the rock in hand),
- **cheap ID tests** (~8 — magnet, acid drop, Radiacode; the record's own TODOs),
- **UV wavelength labeling + retests** (~4).

One sitting — the rocks, calipers, ruler, grey card, UV lamps — closes the majority of 103
gaps. That is the 3–4-rounds-per-rock cost collapsed into a single batch, as designed. The
checklist file is at `mineral-catalog-work/digitization-pilot/GAP-CHECKLIST.md`.

## 4. The unexpected yield — this cluster is a bench in miniature

The agents wrote 19 growth biographies and mapped every rock to the workstreams. The
sim-relevance roster, abbreviated:

| specimen | what it anchors |
|---|---|
| **1298 Elmwood calcite** | the shipped calcite-morphology showcase + **a real snowball-barite CONTACT SCAR** (future Sweetwater tie-in) + a live hydrozincite dissolution front. **C0's bench anchor, found.** |
| **1297 Cave-in-Rock fluorite** | photo-proven sphalerite→fluorite→calcite paragenesis order (a nucleation-order check for `mvt`) + one sphalerite SWALLOWED WHOLE by fluorite (W-F O4 engulfment, in a drawer) + three UV-distinct calcite pulses |
| **1292 quartz epimorphs after laumontite** | **W-K V5's exact geometry** — hollow square-section silica straws bridging cavities where the guest dissolved; the mechanical twin of the future Elmwood perimorph |
| **1291 / 1293 / 1296 botryoidal crusts** | W-K V3 ground truth with RESOLVED radiating crystallites (the anti-4-blob), incl. gravitational settling preference (crown crusted, underside filmed) and a two-pulse UV-discriminated adamite pocket that also arbitrates a minerals.json activator question (Zn/Fe story vs the entry's Cu) |
| **1307 / 1308 / 1309 amethyst-citrine scepters** | W-F O5 (ELO) with a TRIPLE Eh oscillation (citrine→amethyst→citrine), countable oscillatory bands, and z/r sector-zoned purple — the sector-zoning arc's quartz case |
| **1302 hopper zircon** | O7 hopper regime + a 4-frame backlit diaphaneity set (Depth-A calibration) |
| **1303 zircon-biotite contact** | a real syngenetic mutual-growth boundary — **W-F O2's induction surface, photographed** |
| **1294 / 1295 / 1300 alpine-type quartz** | interrupted oscillatory striations, twin re-entrant channel healing, chlorite phantom capture — W-F surface-history + twin-render targets |
| 1299 / 1304 / 1305 / 1306 | Depth-A translucency calibration points, inclusion-density-as-time-axis, healed-fracture regrowth, etched-calcite end-member |

Two NEW-scenario candidates were named from specimens alone: a Pakistani ophiolite
epidote-chlorite pocket (1301, with TN483) and an Afghan LCT pegmatite pocket (1302/1304/1305).
And the anchor shortlist for A1 just got its first six entries without a single new photograph.

## 5. Verdict

**The template survives contact with reality at an 84% slot rate on photos taken years before
it existed**, produces exactly the one-checklist-per-batch dialogue compression it promised,
and its failure modes are definitional (fixed by v1.1 above), not structural. The one thing no
template can retrofit is scale — `measured` requires capture-time discipline, which is the D1
jig, which is $40. The pipeline is proven enough to run at will; the next natural batches are
the other photo-rich clusters (1224–1258: 257 photos; 550–565; 891–934), and the Thompsonite
flat becomes the first test of the CAPTURE protocol instead of the classification pass,
whenever the boss feels like shooting it.

---

*Pilot run 2026-07-03 by 19 subagents (~1.9M tokens, 373 tool calls, ~9 minutes wall-clock),
each reading its specimen's record and viewing its actual photographs. Records + checklist
stay LAN-side; this report is the public face.*
