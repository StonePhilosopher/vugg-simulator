# PROPOSAL: Agent-Friendly Interface — Query Params, Keyboard Shortcuts, and Headless Mode

**Author:** Rock Bot + Professor
**Date:** 2026-05-20
**Status:** Proposal for builder
**Motivation:** The Vugg Simulator's current UI requires mouse-based browser automation (clicking dropdowns, buttons) which is fragile and inconsistent across Playwright/browser control implementations. An agent-friendly interface would allow autonomous agents to play the simulator reliably without visual rendering.

---

## Problem Statement

Browser automation (via Playwright) fails inconsistently on the simulator:
- `act:click` and `act:type` return "request required" errors
- Select dropdowns are hard to manipulate programmatically
- The only reliable action is `snapshot` (DOM reading)
- Agents can observe but cannot interact

This prevents autonomous testing, research, and "dogfooding" of the simulator.

---

## Proposed Solutions (in order of implementation effort)

### 1. URL Query Parameter API (fastest — minimal JS changes)

Extend the existing `?scenario=` param to support full game setup:

| Parameter | Type | Description |
|-----------|------|-------------|
| `scenario` | string | Scenario ID (already partially supported) |
| `seed` | integer | Growth seed |
| `shape_seed` | integer | Shape seed |
| `steps` | integer | Time steps |
| `cavity` | string | `vug`, `pocket`, `cave` |
| `autogrow` | boolean | If `1`, start growth immediately on page load |
| `speed` | string | `instant`, `fast`, `normal`, `slow` — animation speed |
| `export` | string | `json`, `csv`, `png` — return format instead of rendering |
| `mode` | string | `play` (default), `idle` (background simulation), `headless` |

**Example URLs:**
```
https://stonephilosopher.github.io/vugg-simulator/?scenario=roughten_gill&seed=42&steps=200&autogrow=1
https://stonephilosopher.github.io/vugg-simulator/?scenario=jeffrey_mine&seed=123&export=json&mode=headless
```

**Implementation:**
- In `index.html` or the JS init sequence, read `URLSearchParams`
- Apply params to game state before first render
- If `autogrow=1`, trigger the grow function after initialization
- If `export=json`, run simulation silently and `console.log()` JSON results

---

### 2. Keyboard Shortcuts (low effort — high agent value)

Agents can send `key` events reliably even when `click` fails.

| Key | Action |
|-----|--------|
| `1`–`9`, `0` | Select scenario N from the dropdown |
| `G` | Grow (start simulation) |
| `R` | Random (random scenario + seed) |
| `S` | Step forward one timestep |
| `Space` | Pause / resume playback |
| `P` | Play/pause toggle |
| `E` | Export current specimen data |
| `C` | Copy seed to clipboard |
| `L` | Toggle library view |
| `N` | New game (reset) |
| `↑` / `↓` | Previous / next scenario |
| `←` / `→` | Step backward / forward in playback |

**Implementation:**
- Add `keydown` event listener to `document`
- Map keys to existing game functions
- Provide `event.preventDefault()` for mapped keys

---

### 3. Console Output for Agents (medium effort)

Agents can read `console.log()` output even when they can't click:

**Structured event format:**
```javascript
console.log('VUGG_EVENT', JSON.stringify({
  event: 'nucleation',
  step: 25,
  mineral: 'barite',
  position: [12.5, 8.3, 4.1],
  size_mm: 0.3,
  substrate: 'sphalerite',
  saturation: 2.4
}));
```

**Event types:**
- `nucleation` — new crystal forms
- `growth` — existing crystal grows
- `dissolution` — crystal partially/fully dissolves
- `transition` — mineral phase change
- `event_fire` — scheduled event triggers
- `step_complete` — timestep finished
- `simulation_complete` — all steps done
- `specimen_ready` — specimen data available

**Implementation:**
- Add `logEvent(type, data)` helper to core simulation loop
- Wrap existing game events with structured logging
- Use `console.log('VUGG_EVENT', ...)` for easy filtering

---

### 4. REST API / Headless Mode (highest effort — most powerful)

For fully autonomous, non-browser execution:

**Endpoint:** `POST /api/simulate` (or same-origin fetch)

**Request body:**
```json
{
  "scenario": "roughten_gill",
  "seed": 42,
  "steps": 200,
  "cavity": "pocket",
  "return_format": "json"
}
```

**Response:**
```json
{
  "specimen": {
    "id": "roughten_gill_42_200",
    "scenario": "roughten_gill",
    "seed": 42,
    "steps": 200,
    "crystals": [
      {
        "mineral": "galena",
        "step_nucleated": 15,
        "step_dissolved": null,
        "position": [10.2, 5.1, 3.8],
        "size_mm": 2.4,
        "habit": "cubic",
        "fluorescence": null
      },
      {
        "mineral": "linarite",
        "step_nucleated": 85,
        "position": [12.0, 6.2, 4.5],
        "size_mm": 0.8,
        "habit": "prismatic",
        "color": "azure_blue"
      }
    ],
    "chemistry_timeline": [
      {"step": 0, "temp_c": 180, "pH": 6.5, "Pb_ppm": 450, "Cu_ppm": 120},
      {"step": 70, "temp_c": 45, "pH": 3.2, "Pb_ppm": 890, "Cu_ppm": 340}
    ],
    "paragenetic_sequence": ["galena", "chalcopyrite", "pyrite", "linarite", "caledonite", "leadhillite"]
  }
}
```

**Implementation:**
- Extract simulation core into a pure JS module (no DOM dependency)
- Create thin wrapper: `headless.js` accepts JSON → runs simulation → returns JSON
- Web endpoint can call the same core
- Node.js compatible for server-side testing

---

## Validation & Testing

Add automated tests for agent compatibility:

```typescript
// tests-js/agent-interface.test.ts
describe('Agent-friendly interface', () => {
  test('URL params set scenario and seed', () => {
    const game = initFromURL('?scenario=roughten_gill&seed=42&steps=200');
    expect(game.scenario.id).toBe('roughten_gill');
    expect(game.seed).toBe(42);
    expect(game.steps).toBe(200);
  });

  test('autogrow completes simulation', () => {
    const game = initFromURL('?scenario=jeffrey_mine&seed=7&autogrow=1');
    expect(game.state).toBe('complete');
    expect(game.crystals.length).toBeGreaterThan(0);
  });

  test('keyboard shortcut G triggers grow', () => {
    const game = initFromURL('?scenario=cooling');
    simulateKeypress('G');
    expect(game.state).toBe('running');
  });

  test('console output includes VUGG_EVENT', () => {
    const events = captureConsoleEvents();
    runSimulation({ scenario: 'mvt', seed: 1, steps: 10 });
    expect(events.some(e => e.startsWith('VUGG_EVENT'))).toBe(true);
  });
});
```

---

## Benefits

1. **Agents can play autonomously** — no brittle browser automation needed
2. **Deterministic testing** — `?seed=42&scenario=X` always produces the same result
3. **Batch research** — agents can run hundreds of simulations, compare outcomes
4. **Headless CI/CD** — tests run without browser rendering
5. **Human convenience** — keyboard shortcuts speed up manual play

---

## Priorities

1. **URL query params** — minimal effort, immediate value
2. **Keyboard shortcuts** — enables agent interaction today
3. **Console output** — agents can observe even if they can't click
4. **REST API / headless mode** — long-term, enables full automation

---

## Related Work

- The builder's `tests-js/` suite already runs headless simulations with deterministic seeds
- The `seed42_vXXX.json` baselines prove the simulation core is deterministic
- This proposal just exposes that capability through the web interface

---

*"If a crystal grows in a vug and no agent is there to log it, did it really nucleate?"*
*"Yes. But we'd like to know about it."*
