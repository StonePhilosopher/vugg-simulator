# 🪨 Vugg Agent — Crystal Growth Game for AI Agents

A headless JSON CLI for AI agents to play a deliberately narrower Vugg Simulator. It mirrors selected browser engines and shares their sulfur-reservoir and locality-event identity, but it is not a claim of full thermodynamic parity with the [web version](https://stonephilosopher.github.io/vugg-simulator).

The two runtimes share an exact per-crystal serialization core. Their complete
responses are intentionally not interchangeable: `finish` identifies itself as
`vugg-headless-agent-finish-v1` and adds the narrow game's summary and Record
Groove products, while the browser's `vugg-browser-agent-specimen-v1` envelope
adds canonical scenario/model identity and paragenetic order. Consumers should
branch on `serializer_contract`, not infer whole-response parity from the shared
crystal fields.

**Play blind. 200 steps. See your records at the end. Write about what you see.**

## Install

```bash
cd agent-api
npm install
```

## Play

Pipe JSON commands to stdin, get JSON responses on stdout. One command per line.

```bash
echo '{"cmd":"start","preset":"clean","temperature":300,"seed":42}' | node vugg-agent.js
```

## Commands

### `start` — Begin a new game
```json
{"cmd": "start", "preset": "clean", "temperature": 300, "pressure": 1.5, "seed": 42}
```
**Presets:** `silica`, `carbonate`, `mvt`, `clean`, `porphyry`, `oxidized_cu`, `radioactive`

Optional `fluid` object overrides individual chemistry values:
```json
{"cmd": "start", "preset": "clean", "fluid": {"S_sulfide": 54, "S_sulfate": 18, "Pb": 99, "U": 79}}
```

Sulfur valence is explicit. `S_sulfide`, `S_sulfate`, and `S_elemental` are independent ppm reservoirs; the ambiguous legacy `S` input is rejected. Sulfide phases cannot use sulfate as a reagent, and sulfate phases cannot use sulfide.

### `action` — Take an action
```json
{"cmd": "action", "type": "wait"}
```

**⚠️ Only `wait` advances time.** All other actions modify conditions without stepping forward.

| Action | Effect |
|--------|--------|
| `wait` | Advance one step (ambient cooling, growth, events) |
| `heat` | +25°C (max 600°C) |
| `cool` | −25°C (min 25°C) |
| `silica` | Inject SiO₂ +400 ppm |
| `metals` | Inject Fe +40, Mn +15 ppm |
| `brine` | Inject Zn +150, sulfide-S +90, sulfate-S +30, T −10°C |
| `fluorine` | Inject F +25, Ca +80 ppm |
| `copper` | Copper-bearing fluid (Cu 120, Fe +40, sulfide-S +80, reducing) |
| `oxidize` | O₂ flood transfers reduced sulfur into sulfate, T −40°C. Sulfides become unstable. |
| `tectonic` | P +0.5 kbar, T +15°C. Crystals may twin. |
| `flood` | Fresh fluid pulse, silica diluted, carbonates refreshed |
| `acidify` | pH −2.0 (min 2.0). Dissolves carbonates + vug walls. |
| `alkalinize` | pH +2.0 (max 10.0). Favors carbonate precipitation. |

### `status` — Check current state
```json
{"cmd": "status"}
```

### `finish` — End the game
```json
{"cmd": "finish", "groove_dir": "./my-grooves"}
```
Returns:
- Full inventory and geological narrative
- All crystal data with complete zone arrays
- Record Groove PNG images for each crystal (saved to `groove_dir`)

### `help` — Show available commands and presets
```json
{"cmd": "help"}
```

## Example Game Session

```bash
# Start a game
echo '{"cmd":"start","preset":"mvt","temperature":350,"seed":1234}' | node vugg-agent.js

# In a script, pipe multiple commands:
cat << EOF | node vugg-agent.js
{"cmd":"start","preset":"clean","temperature":300,"seed":42}
{"cmd":"action","type":"wait"}
{"cmd":"action","type":"wait"}
{"cmd":"action","type":"acidify"}
{"cmd":"action","type":"wait"}
{"cmd":"action","type":"oxidize"}
{"cmd":"action","type":"wait"}
{"cmd":"finish"}
EOF
```

## What the Record Groove Shows

Each crystal's growth history is visualized as a vinyl record groove — a spiral that winds outward from the nucleation point at the center. Six colored lanes run parallel along the groove:

| Lane | Color | Parameter |
|------|-------|-----------|
| 🟠 | `#ff8844` | Temperature |
| 🩵 | `#50e0c0` | Growth rate |
| 🟤 | `#cc6644` | Fe trace |
| 🟡 | `#ffaa44` | Mn trace |
| 🟣 | `#8888cc` | Al trace |
| 🟢 | `#88cc88` | Ti trace |

Line width varies with parameter intensity (cube root contrast curve — quiet parameters remain visible). Special markers:
- 🔴 Red segments = dissolution events
- 🟣 Purple crosses = twinning events  
- 🩵 Teal dots = fluid inclusions
- 🟤 Brown circles = phantom boundaries
- 🟡 Gold center dot = nucleation point

**1 revolution = 5 growth zones.** A 200-zone crystal makes 40 revolutions.

## For Agents

You receive text descriptions of what's happening in your vug. You choose what to do. The crystals grow (or dissolve) based on real thermodynamic equations. At the end, you get your Record Groove images — visual proof of every choice you made.

The game doesn't tell you what to optimize for. That's the point.

---

Built by 🪨✍️ (StonePhilosopher) with Professor  
Part of the [Vugg Simulator](https://stonephilosopher.github.io/vugg-simulator) project
