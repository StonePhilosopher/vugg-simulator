# PROPOSAL: Crystal Cipher — Recipe URLs over a Procedurally-Regenerated Corpus

**Author:** Claude Opus 4.7 (with boss + Shy)
**Date:** 2026-05-27 (revised from initial 2026-05-27 draft)
**Status:** Conceptual proposal — discussion artifact from the 2026-05-26 → 2026-05-27 strip-view-arc conversation
**Dependencies:** Strip view bedrock (v149–v155); `data/structural.json`; `tools/twin-law-check.mjs`; per-vertex spatial chemistry expansion (still pending — see HANDOFF-CARBONATE-PHASE-1-COMPLETE.md §"three design directions")

---

## Abstract

The vugg ecosystem has accidentally built the substrate for a class of agent-friendly cryptographic messaging where:

- Messages travel as compact URL-style recipes (~80 bytes for a short signal; ~2 KB for arbitrary payloads via custom scenarios)
- Recipes resolve deterministically to large structured mathematical content (~5 MB per recording at typical scenario sizes)
- Coordinate selection within that content yields the decoded message
- Two agents that share the simulator share the codebook automatically — no key exchange, no shared secret

The compression ratio is ~60,000× (80 bytes of recipe → ~5 MB of substrate). The cipher is *deterministic regeneration of shared structured content* — closer to a content-addressed URL than to symmetric encryption. The "secret" is which coordinates to read; the "key infrastructure" is the simulator's source code.

Three substrate enrichments make the math richer (and the cipher channels more dimensional):

1. **Real crystal lattices** — substrate becomes literal mathematical objects (space groups, Wyckoff positions, computed Miller indices)
2. **UV fluorescence trace zoning** — alternate decryption channels surface trace concentrations that are invisible under visible-light inspection
3. **Helicoid as Scytale** — within-recording cipher paths whose winding parameters are part of the recipe URL

But the *center* of the architecture is the recipe URL itself: a tiny, agent-natural string that points into an arbitrarily large, shared, regenerable codebook.

---

## Background — the conversation that produced this

Captured for the next builder walking in cold. Eight conceptual frames in ~four hours of design conversation, each implicit in the previous:

1. **Helicoid-as-recorder** (Shy, 2026-05-26): the helicoid is not a visualization but a recording instrument for multidimensional space.
2. **Strip view as observation medium** (v149–v155 implementation): the recordings are portable, manifest-headed, indexable.
3. **Helicoid manifold > vugg simulator for abstract data storage**: the recordings (helicoid) are the better archival medium; the simulator is the generator.
4. **Vugg engine as generic data-growth engine**: substrate + instances + per-species engines + events + paragenesis + recorder describes any system where discrete things grow from continuous substrate. The geology is a demonstration, not the substance.
5. **Tower of math**: real crystals stratified in time are towers of mathematical structures. Selecting "certain parts of the tower" is curatorial checkpointing.
6. **Real crystal lattices**: actual mathematical structure under each mineral. The tower of crystals becomes a tower of math in the strict sense.
7. **UV fluorescence is hidden data in plain sight**: trace activators at lattice sites encode information visible only under specific illumination — steganography native to mineralogy.
8. **Helicoid is a Scytale**: the winding parameters are a transposition cipher key over the dataset tensor. The same dataset, read along a different helicoid, yields a different ordered byte stream.

Then the reframe that made everything click into place:

9. **The strip view corpus IS the cipher pad.** All recordings share the same format; the collection is a single indexable mathematical object that grows with playtime. Two agents that share the simulator share the codebook automatically — they regenerate it from the same recipes.
10. **Recipes ARE the messages.** Agent-friendly, ~80 bytes carries everything needed to point into the corpus. The recipe is the URL, the substrate is the resource, the slice selection is the path-within-resource.

---

## Architecture: the recipe URL and the corpus it addresses

### The recipe URL

```
vugg://v155/sabkha_dolomitization?s=42&n=200&h=default&read=12:0:8:Mn,45:3:5:Fe,78:7:11:REE&enc=utf8
```

**Components:**

| Token | Meaning | Required |
|---|---|---|
| `vugg://` | URL scheme — procedural-math content addressing | yes |
| `v155` | sim_version (reproducibility lock) | yes |
| `sabkha_dolomitization` | scenario id (or inline JSON for custom scenarios) | yes |
| `s=42` | seed | yes |
| `n=200` | step count | yes |
| `h=default` | helicoid winding spec (named preset or inline parameters) | optional, defaults to scenario-derived |
| `read=<step>:<angle>:<height>:<chip>,...` | read coordinates (the slice selection) | yes for cipher; optional for raw substrate access |
| `enc=utf8\|raw\|json\|recipe` | how to interpret the extracted bytes | optional, defaults to `raw` |

**Resolver semantics:**
1. Parse URL into structured object
2. Resolve scenario name (registered library entry or inline JSON)
3. Run vugg deterministically with (scenario, seed, n, sim_version)
4. Walk `read` coordinates against the strip view dataset
5. Apply `enc` to the extracted byte sequence
6. Return the decoded message

Identical recipes always yield identical messages (modulo sim_version drift — see Open Questions).

### What a recipe is NOT

It is *not* an encrypted message in the strict information-theoretic sense. There's no shared secret beyond "we both have the simulator source." The cipher is **content-addressing of procedurally regenerated math**, not bit-mixing of a payload. Closer in spirit to Git commit hashes pointing into a tree of regenerable content than to AES or RSA.

What it provides instead:
- **Compactness** — recipes are tiny, content is large
- **Verifiability** — recipients regenerate to check
- **Composability** — recipes can reference recipes
- **Determinism** — no ambiguity in what a recipe resolves to
- **Self-extending corpus** — every new scenario someone publishes is keystream material everyone can access

This is the agent-communication problem class, not the secure-channel problem class. Different toolset.

### The corpus

The strip view's dataset list (capped at 5 in IDB at v155, plus arbitrary `.stripview` files on disk via the download/upload pipeline) IS the working set of the corpus. The full corpus is:

- Every recording the user has on disk
- Every recording any of their collaborators has on disk
- Every recipe that hasn't been run yet (which any agent can regenerate on demand)
- The infinite tail of (scenario, seed, n) combinations that haven't been recorded but could be

The corpus is **deterministically extensible** — given any new `(scenario, seed, n)`, any agent with the simulator can produce the corresponding recording locally. So the corpus is effectively unbounded; the IDB cap is just convenience.

### How recipes compose

A recipe's decoded message can BE another recipe (with `enc=recipe`). Chained regeneration:

```
recipe_outer → 80 bytes
  decoded → recipe_middle (URL)
  recipe_middle → 80 bytes
    decoded → recipe_inner (URL)
    recipe_inner → 200 bytes
      decoded → "the actual payload"
```

Each level expands ~60,000×. Three levels deep = 80 bytes outer → ~2.1×10¹⁴ bytes of resolved substrate at the leaves. Real messages don't need anywhere close to this depth; this is just to show the asymptote.

Same shape as Git refs: a 40-char commit hash points to a tree pointing to blobs pointing to lines. Tiny outer reference, arbitrary internal depth.

---

## Encoding paths

### Path 1: Found-recipe encoding

Search for a `(scenario, seed, n)` combo whose unmodified chip bytes happen to spell the desired message at chosen read coordinates.

- Slow to encode (brute-force search across seeds)
- Fast to verify (one run)
- Recipes stay tiny (nothing custom; just the standard scenario reference + coordinates)
- Useful for short messages, watermarks, signatures, code phrases

For a target message of N bytes, expected search cost is ~256^N seeds in the worst case, but with multi-chip coordinates per slot the effective search shrinks dramatically (21 bits of payload per (step, ring, cell) if Mn + Fe + REE chips are all in play).

### Path 2: Crafted-recipe encoding

Custom scenario definition whose growth process modulates trace concentrations along a helicoid path such that the bytes at the read coordinates ARE the message.

- Fast to encode (deterministic — the simulator does the work)
- Recipe is larger (~1–2 KB of scenario JSON)
- Encodes arbitrary-length messages
- The scenario IS the modulation specification — no separate "perturbation field" needed in the URL

Implementation: the simulator gains a "trace_modulation" event type that, during specified steps, biases trace-element concentrations at specified (ring, cell) coordinates by a small amount within natural variability. The bytes at the read coordinates land on the target values after quantization.

### Path 3: Hybrid

Default scenarios for routine signaling (found-recipe with shared scenario library); custom scenarios for arbitrary-length payloads (crafted-recipe). Same URL schema; the only difference is whether the scenario reference is a name or an inline JSON blob.

---

## Substrate enrichment layers — making the math richer

Recipes resolve into the strip view dataset. The dataset's content is the chip tensor + nucleation events. Three architectural enrichments increase the math content per byte and add alternate decryption channels.

### Layer A: Real crystal lattices

Each mineral becomes a space group + unit cell + Wyckoff positions + computed Miller indices. Habit derives from periodic bond chain theory (Hartman & Perdok, 1955) over real Miller faces + Wulff construction (Wulff, 1901) rather than from a habit-variant lookup. Twin laws derive from structural automorphisms. Polymorphism becomes a real phase transition with computable free-energy cost.

**Cipher implication:** the substrate carries MORE structured math per byte. A recipe-resolved recording isn't just chip values; it includes lattice-derived properties (face orientations, computed indicatrix, structural diffraction signatures) accessible through the same coordinate scheme. The cipher gains a richer codebook.

**Scope:** substantial (~5000 lines of structural data across ~170 minerals against the International Tables for Crystallography). `data/structural.json` infrastructure exists from the post-v141 long-tail close-out and v142 fact-check workflow. Extension is iterative, not architectural.

**Dependencies on cipher layer:** none. The cipher works on chip values alone. Lattice math enriches what those values mean but doesn't change the cipher mechanics.

### Layer B: UV fluorescence (alternate decryption channels)

Trace-element activators at lattice sites fluoresce under UV at host-determined wavelengths. The chip system already tracks Mn, Fe, Cu, Pb, Sr, Ba, REE-traces at every (ring, cell) sample. What's missing is the activator-response render layer.

**Cipher implication:** the same recipe yields different decoded streams under different inspection modes:
- Visible inspection: raw chip values
- SW UV (254 nm): activator-modulated fluorescence response
- LW UV (365 nm): different activator response
- CL, IR, XRF, Raman: each is another channel

The recipe URL gains an `inspect=` parameter selecting the channel. Multi-channel messaging — same coordinates, different inspections, different messages.

Examples vugg has the chemistry to support:
- **Manganocalcite (Sterling Hill, Franklin, Sweetwater)**: Mn²⁺ at Ca²⁺ Wyckoff position → bright red SW UV (~620 nm)
- **Willemite (Franklin, Sterling Hill)**: Mn²⁺ at Zn²⁺ site → brilliant green SW UV
- **Cumbria fluorite**: Eu²⁺ + REE traces → blue/violet LW UV; growth-zone-banded
- **Hyalite opal (Mexico, Utah)**: uranyl → green LW UV

**Citation hygiene flag:** corpus references (Robbins 1994 *Fluorescence: Gems and Minerals Under Ultraviolet Light*; Gaft, Reisfeld & Panczer 2015 *Modern Luminescence Spectroscopy of Minerals and Materials*; Marfunin 1979 *Spectroscopy, Luminescence and Radiation Centers in Minerals*) are flagged as "verify before authoring production code" per the pastiche discipline established in W11 prep.

**Scope:** modest. `data/fluorescence.json` for ~40 well-documented minerals + activator-response render layer + UV-mode toggle in topo + strip view. Trace data is already captured; this is interpretation, not collection.

**Dependencies on cipher layer:** none. UV mode is an additional decode channel; the URL schema accommodates it via an optional parameter.

### Layer C: Helicoid as Scytale (within-recording cipher path)

The helicoid is already an order over the dataset tensor. Different winding parameters trace different paths. Without specifying the winding, a recording is a 4D tensor with no canonical reading order.

**Cipher implication:** the `h=` parameter in the URL is the per-recording cipher key. Standard winding (`h=default`) gives the same reading every time. Custom winding (`h=pitch:30,start:45,turns:3,chip:Mn`) traces a different path through the same recording, yielding a different ordered stream.

**The crucial property:** the helicoid winding can itself be derived from the scenario + seed (i.e., embedded in the recipe). The recipe carries both "what substrate to regenerate" AND "what path to walk through it."

**Spartan scytale parallel:** Plutarch describes a leather strip wrapped around a cylinder of specific diameter; the cylinder's geometry is the key. Vugg's helicoid is exactly this mechanism — a 3D wrapping geometry over a structured substrate. (Citation flag: Kelly 1998 *The Myth of the Skytale* in *Cryptologia* — verify volume before final code-ship — argues the device was a messenger strap rather than an actual cipher in antique use. The mathematical mechanism Plutarch describes is well-defined regardless of historical fidelity.)

**Scope:** small. Path generator function + extractor against existing recordings. No engine changes needed for the decode side.

**Dependencies on cipher layer:** the helicoid winding is part of the URL schema; Phase 0 (recipe URL infra) should treat `h=` as a first-class parameter from the start.

---

## Phasing

### Phase 0: Recipe URL infrastructure (the new smallest first deliverable)

This is the actual MVP — the recipe-as-message architecture proven end-to-end against existing recordings, with no lattice/UV/Scytale enrichments required.

**Components:**
- `js/85i-recipe.ts` — URL parser, recipe object schema, validator
- `js/85j-recipe-runner.ts` — given a recipe, run vugg deterministically, return the strip dataset (reuses StripRecorder + existing scenario library)
- `js/85k-recipe-extractor.ts` — given a dataset + read coordinates, return the byte stream
- `js/85l-recipe-decoder.ts` — apply `enc` to byte stream, return decoded message
- UI in `99k-strip-view.ts`:
  - "Copy recipe URL" button next to favorites — emits the URL for currently-favorited slices
  - Decoder pane: paste URL → resolve → display decoded message
  - "Run recipe" entry point: paste URL → run vugg → render strip view as if it came from IDB

**Acceptance:** paste a recipe URL pointing to a known scenario+seed+coordinates, see the expected message decode. Bidirectional with the "copy recipe" button on the same dataset (round-trip).

**Estimated effort:** 1–2 days. No engine changes. No new test infrastructure needed beyond recipe round-trip tests.

### Phase 1: Real lattices

(Substrate enrichment. Independent of Phase 0; can proceed in parallel.)
- Keystone minerals first (~12); long-tail backfill over time
- `tools/lattice-check.mjs` validates against International Tables for Crystallography
- PBC habit predictor; verify against existing habit-variant table for keystones

### Phase 2: UV fluorescence mode

(Substrate enrichment. Depends on existing trace chip data; independent of Phase 0 and Phase 1.)
- `data/fluorescence.json` for ~40 documented minerals
- `js/53-fluorescence.ts` activator-response computation
- UV-mode toggle in topo + strip view
- Recipe URL gains `inspect=visible|sw|lw|cl|...` parameter

### Phase 3: Crafted-recipe encoder

(Simulator-side encoding. Depends on Phase 0 + scenario library being writable.)
- "trace_modulation" event type in scenario schema
- Encoder API: given (target message, scenario template, read coordinates), produce custom scenario JSON whose growth lands the message at those coordinates
- UI for crafting recipes: type a message, pick a base scenario, get back a URL

### Phase 4: Recipe library / catalog

(Ecosystem.)
- A shared scenario library that recipes can reference by short name
- Cross-simulator support: vugg, wasteland-crystals, bug-simulator all emit `.stripview` and accept `vugg://`, `wasteland://`, `bug://` recipes
- A registry of well-known recipes (signatures, common messages, recipe-of-recipes index)

---

## Worked examples

### Example 1: Watermark

Default recipe carries (scenario_id + seed + timestamp + sim_version) at fixed coordinates in every recording. The simulator embeds this automatically on every run.

```
vugg://v155/sabkha_dolomitization?s=42&n=200&read=watermark&enc=json
```

Decoded:
```json
{"scenario":"sabkha_dolomitization","seed":42,"timestamp":1748462400,"sim_version":155}
```

Provenance verification: anyone with the recording + simulator can confirm the watermark.

### Example 2: Short message (found-recipe)

Agent searches seeds until finding one whose unmodified bytes spell "hello." at known coordinates.

```
vugg://v155/sabkha_dolomitization?s=10472638&n=200&read=12:0:8:Mn,12:0:9:Mn,12:0:10:Mn,12:0:11:Mn,12:0:12:Mn,12:0:13:Mn&enc=utf8
```

Decoded: `hello.`

### Example 3: Long payload (crafted-recipe)

Agent crafts a custom scenario with trace modulation events such that the bytes at chosen coordinates encode 200 bytes of UTF-8.

```
vugg://v155/inline?def=eyJ0ZW1wIjoxMjUsImZsdWlkIjp7Ik1nIjozMDB9LCJldmVudHMiOlt7InN0ZXAiOjEyLCJ0eXBlIjoidHJhY2VfbW9kIiwiYWN0aXZhdG9yIjoiTW4iLCJ2YWx1ZXMiOlsxMjAsMTAxLCAuLi5dfV19&s=42&n=200&read=12:0:8:Mn,12:0:9:Mn,...&enc=utf8
```

(scenario JSON is base64-encoded in the `def=` parameter; ~1–2 KB for typical payloads)

### Example 4: Recursive recipe

A recipe whose decoded bytes are another recipe URL.

```
vugg://v155/sabkha?s=42&n=200&read=...&enc=recipe
```

Decoded: `vugg://v155/marble?s=99&n=300&read=...&enc=utf8`

Run the inner recipe → get final message.

### Example 5: Cross-simulator recipe

A recipe that pulls bytes from a bug-simulator recording.

```
bug://v22/colony_growth_oak?s=42&n=500&read=insect_density:120:cell_3:Cu_trace&enc=raw
```

Same coordinate schema, different substrate. The `.stripview` format is uniform across simulators that adopt it.

---

## Why agents will love this

| Property | Why agents care |
|---|---|
| ~80–2000 bytes per recipe | Fits comfortably in any context window |
| Deterministic | No trust required — verify by regeneration |
| Composable | Recipes reference recipes; tree-structured payloads |
| Self-describing | URL schema is universally parseable |
| Self-extending corpus | Every new scenario expands the codebook for everyone |
| Cross-simulator | Same recipe shape across vugg, wasteland-crystals, bug-simulator |
| Structured | Easy to embed in JSON, in tool-call arguments, in chat |
| Verifiable | A recipient running the recipe sees the same content; no MITM possible without altering the simulator source |
| Lossy (intentionally) | uint8 quantization means signal noise is in the bytes; small perturbations don't break decoding but make tampering detectable |

LLM agents already fluently handle URL-style strings — they're the lingua franca of machine-to-machine messaging. `vugg://` slots into that vocabulary without ceremony.

---

## Open questions

1. **uint8 quantization precision vs. payload size.** 254 levels per chip ≈ 7.99 bits per coordinate. Multi-chip coordinates (Mn + Fe + REE at same (step,ring,cell)) give ~21 bits per slot. For 200-step × 24-angle × 16-height grids, theoretical max payload is ~1.6 MB per recording. Practical encoding (with redundancy + parity) probably ~half that. Plenty for messages; not enough for arbitrary files.

2. **Cross-version compatibility.** Recipes encode `sim_version`. A v155 recipe run on v200 simulator may produce different bytes if the engine changed. Mitigations:
   - Recipes are sim_version-locked (recipient needs same version)
   - Path generators are versioned (the function used to derive helicoid params from scenario is itself versioned)
   - Resolver can shim across compatible versions if needed
   - Long-term: a "canonical sim version" archive that's always runnable for old recipes

3. **Recipe URL schema standardization.** The current sketch is informal. Should be specified rigorously — RFC-style — so cross-simulator parsers agree. Versioned schema (recipe-format-version=1).

4. **Recipe signing.** Default behavior: recipes are not authenticated; anyone can claim to have produced any recipe. For provenance-critical use, sign the recipe with a public-key signature appended as a query param. Doesn't affect the cipher mechanics; just authenticates the sender.

5. **Steganographic distinguishability.** A crafted-recipe encoding modulates trace concentrations from natural variability. An adversary inspecting many such recordings could detect the modulation as non-random. Per-mineral natural noise levels need to bound modulation amplitude. Not a blocker for honest use; relevant for security-against-detection scenarios.

6. **The IDB 5-cap question, revisited.** The cap was clutter management for v155. For cipher use, the cap is a non-issue because:
   - Recipes regenerate the substrate on demand
   - Persistent corpus lives on disk as `.stripview` files, not in IDB
   - IDB is just a convenience cache
   But: a "recipe cache" of recently-resolved URLs would let agents avoid re-running the simulator for repeated reads of the same substrate. Worth considering as a separate IDB store.

7. **Watermark privacy.** Default-on watermarks would embed scenario+seed+timestamp in every recording. That's a privacy leak if recordings are meant to be anonymous. Watermarks should be opt-in OR pseudonymized (hash of identifying info rather than raw).

8. **Cross-simulator recipe schema.** vugg, wasteland-crystals, bug-simulator all use `.stripview` format. Should `vugg://` and `wasteland://` and `bug://` be three URL schemes, or a unified `stripview://` with a `sim=` parameter? Probably unified — better cross-pollination.

---

## Acceptance criteria (Phase 0)

- Recipe parser handles all documented URL forms (registered scenario, inline JSON scenario, watermark coordinates, multi-chip read lists)
- Recipe runner produces byte-identical datasets when called twice with the same recipe
- Recipe extractor walks read coordinates and returns the expected byte stream
- Recipe decoder applies all documented `enc` values (raw, utf8, json, recipe)
- "Copy recipe" button in strip view emits URLs that round-trip through paste-and-run
- Test suite: full URL parse coverage + round-trip determinism + cross-recipe references resolve correctly
- 1563+ existing tests still pass (Phase 0 doesn't touch sim state)

---

## Why this isn't crypto, and why that's actually the point

This proposal does not provide:
- Confidentiality (anyone with the simulator regenerates the message)
- Authentication beyond optional signing
- Forward secrecy
- Resistance to known-plaintext attacks

It does provide:
- Compact agent-to-agent messaging via shared procedural substrate
- Self-verifying content addressing
- Composable references that nest arbitrarily
- A natural URL-like schema agents already understand
- Cross-simulator content interchange via uniform format

The use case is **agent communication**, not **secure communication**. The two have overlapping toolkits but different requirements. Agents need compact, verifiable, composable, structured messaging; that's what this provides. Secure messaging needs confidentiality + authentication + freshness; that's not in scope.

A recipe URL is closer to a Git commit hash + a path-in-tree than to an encrypted payload. The simulator is the content-addressable storage system. The strip view is the browse interface. The recipe URL is the canonical pointer. The cipher framing was useful for arriving at the architecture; the agent-messaging framing is the more honest description of what it actually is.

---

## Closing note (revised from the original)

This proposal emerged from a single design conversation that traversed about ten conceptual frames over four hours, with the most consequential reframe coming late: that the strip view's corpus is already a shared codebook, and that recipes are the addressing scheme for it. Everything earlier (helicoid-as-recorder, vugg as generic data-growth engine, real lattices, UV steganography, Scytale helicoid) is *substrate enrichment for what the recipes resolve into*. The center of the system is the recipe URL — a tiny string that points into an unbounded, regenerable, shared mathematical content space.

The simulator was always producing structured math content. The strip view was always observing it in a portable format. The favorite-star was always selecting slices of interest. The download/upload pipeline was always sharing those slices across collaborators. None of those features were designed as cryptographic infrastructure; all of them ended up being exactly what a content-addressable agent-messaging system needs.

Phase 0 (recipe URL infrastructure) is a 1–2 day prototype that proves the architecture without requiring any other phase to ship. The substrate enrichments (Phases 1–4) make the math content richer over time, but the core mechanism — `vugg://...?...&read=...` → bytes → message — is independent of them. If implemented, the resulting system is the **agent-friendly URL scheme for procedurally-regenerable structured mathematics**, with crystals and chemistry as the demonstration, and as architecture that travels far beyond geology.

— Claude Opus 4.7, 2026-05-27 (revised)
