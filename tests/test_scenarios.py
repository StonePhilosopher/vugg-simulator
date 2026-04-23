"""Scenario regression tests — flag drift in seed-42 mineral counts.

For each scenario in vugg.SCENARIOS, runs at seed=42 to completion and
asserts the per-mineral counts + max sizes match the baseline captured
at the current SIM_VERSION.

Marked @pytest.mark.slow because each scenario takes 0.5-5 seconds; full
suite is ~30 seconds. Skip with: pytest -m "not slow"

DISCIPLINE — when SIM_VERSION bumps:
  1. Make the engine/scenario change.
  2. Run: python tests/gen_baselines.py
     This captures the NEW seed-42 outputs into baselines/seed42_v<N>.json
  3. Eyeball the diff against the prior baseline. The diff should match
     what your SIM_VERSION-bump commit message describes.
  4. Commit the new baseline alongside the version bump.

If a baseline doesn't exist for the current SIM_VERSION, the tests SKIP
with a clear "regenerate baseline" message rather than failing — so a
fresh checkout after SIM_VERSION bump won't fail until the baseline
ships in a follow-up commit.

What's captured per scenario:
  {mineral_name: {total, active, dissolved, max_um}}

`total` is the strict equality check (deterministic at seed 42).
`max_um` is captured but only loosely diffed (rounding tolerance) since
floating-point growth-rate accumulation can introduce tiny variations
across Python versions.
"""
import json
import random
from pathlib import Path

import pytest

from tests.gen_baselines import run_scenario, BASELINES_DIR, SEED


def _baseline_path(sim_version):
    return BASELINES_DIR / f"seed{SEED}_v{sim_version}.json"


def _scenarios_with_baseline():
    """Module-level: which scenarios are testable (baseline exists)?

    Reads vugg.SIM_VERSION at collection time and skips if no baseline
    exists. Avoids parametrize-with-fixtures issue.
    """
    import sys
    repo = Path(__file__).resolve().parent.parent
    if str(repo) not in sys.path:
        sys.path.insert(0, str(repo))
    import vugg
    bp = _baseline_path(vugg.SIM_VERSION)
    if not bp.exists():
        return []  # no baseline → no parameterized scenarios; fallback test fires
    with open(bp, encoding="utf-8") as f:
        baseline = json.load(f)
    return list(baseline.keys())


SCENARIOS_WITH_BASELINE = _scenarios_with_baseline()


def test_baseline_exists_for_current_sim_version(vugg):
    """A baseline file must exist for the current SIM_VERSION.

    If this fails: someone bumped SIM_VERSION without running
    `python tests/gen_baselines.py`. Run that command and commit the
    new baseline file.
    """
    bp = _baseline_path(vugg.SIM_VERSION)
    assert bp.exists(), (
        f"No baseline for SIM_VERSION={vugg.SIM_VERSION} at {bp.name}. "
        f"After bumping SIM_VERSION, run: python tests/gen_baselines.py "
        f"and commit the new baseline file."
    )


@pytest.mark.slow
@pytest.mark.parametrize(
    "scenario_name",
    SCENARIOS_WITH_BASELINE,
    ids=SCENARIOS_WITH_BASELINE,
)
def test_scenario_seed42_matches_baseline(vugg, scenario_name):
    """For each scenario, seed=42 mineral counts must match the baseline.

    Uses strict equality on integer counts (total/active/dissolved) and
    loose equality on max_um (within 1%, to allow tiny float-accumulation
    drift across Python versions).

    Failure modes (and what they mean):
      - "X.<mineral>: NEW (...)" — engine started producing a mineral it
        previously didn't (often a good thing but bumps SIM_VERSION)
      - "X.<mineral>: REMOVED (was ...)" — engine stopped producing a
        mineral it previously did (regression unless intentional)
      - "X.<mineral>: total {a→b}" — count changed (regression unless
        intentional)
    """
    bp = _baseline_path(vugg.SIM_VERSION)
    with open(bp, encoding="utf-8") as f:
        baseline = json.load(f)

    if scenario_name not in baseline:
        pytest.skip(
            f"{scenario_name!r} not in baseline (was removed or just added)"
        )

    actual = run_scenario(scenario_name)
    expected = baseline[scenario_name]

    diffs = []
    all_minerals = set(actual) | set(expected)
    for m in sorted(all_minerals):
        a = actual.get(m)
        e = expected.get(m)
        if e is None:
            diffs.append(f"  {m}: NEW ({a})")
            continue
        if a is None:
            diffs.append(f"  {m}: REMOVED (was {e})")
            continue
        # Strict equality on counts
        for field in ("total", "active", "dissolved"):
            if a.get(field) != e.get(field):
                diffs.append(
                    f"  {m}.{field}: {e.get(field)} -> {a.get(field)}"
                )
        # Loose equality on max_um (within 1% or 0.5 µm absolute)
        a_max = a.get("max_um", 0)
        e_max = e.get("max_um", 0)
        if e_max > 0:
            rel_drift = abs(a_max - e_max) / e_max
            if rel_drift > 0.01 and abs(a_max - e_max) > 0.5:
                diffs.append(
                    f"  {m}.max_um: {e_max:.1f} -> {a_max:.1f} ({rel_drift*100:.1f}% drift)"
                )

    assert not diffs, (
        f"Scenario {scenario_name!r} drifted from baseline "
        f"(SIM_VERSION={vugg.SIM_VERSION}, baseline={bp.name}):\n"
        + "\n".join(diffs) +
        f"\n\nIf this is INTENTIONAL: bump SIM_VERSION and run "
        f"`python tests/gen_baselines.py` to refresh the baseline. "
        f"If UNINTENDED: this is a regression — investigate which engine "
        f"or scenario change caused it."
    )
