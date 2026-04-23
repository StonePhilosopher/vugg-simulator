"""Regenerate scenario regression baselines.

Run this script ONLY when SIM_VERSION bumps and you've intentionally
shifted scenario seed-42 outputs. Captures mineral counts and max sizes
per scenario at seed=42 into tests/baselines/seed42_v<SIM_VERSION>.json.

Usage:
  python tests/gen_baselines.py        # captures current state
  python tests/gen_baselines.py --check    # diff against existing baseline,
                                            # don't write

The baseline file name embeds SIM_VERSION so old baselines stay archived
when version bumps. Tests in test_scenarios.py read the baseline matching
the CURRENT vugg.SIM_VERSION; if no baseline exists for the current
version, scenarios are skipped (with a clear message).

Discipline: when SIM_VERSION bumps, the bumping commit should also run
this script and commit the new baseline. The drift documentation in the
SIM_VERSION bump comment should match the diff against the prior baseline.
"""
import argparse
import json
import random
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

import vugg

SEED = 42
BASELINES_DIR = Path(__file__).resolve().parent / "baselines"


def run_scenario(name):
    """Run a scenario at seed 42, return mineral count + size stats.

    Returns:
        dict[str, dict] keyed by mineral name with:
          - total: total crystals nucleated (active + dissolved)
          - active: crystals still active at end
          - dissolved: crystals marked dissolved at end
          - max_um: largest total_growth_um across crystals
    """
    if name not in vugg.SCENARIOS:
        raise KeyError(f"Unknown scenario: {name}")
    random.seed(SEED)
    cond, events, steps = vugg.SCENARIOS[name]()
    sim = vugg.VugSimulator(cond, events)
    for _ in range(steps):
        sim.run_step()

    by_mineral = {}
    for c in sim.crystals:
        m = c.mineral
        if m not in by_mineral:
            by_mineral[m] = {"total": 0, "active": 0, "dissolved": 0, "max_um": 0.0}
        by_mineral[m]["total"] += 1
        if c.active:
            by_mineral[m]["active"] += 1
        if c.dissolved:
            by_mineral[m]["dissolved"] += 1
        by_mineral[m]["max_um"] = round(
            max(by_mineral[m]["max_um"], c.total_growth_um), 1
        )
    return dict(sorted(by_mineral.items()))


def capture_all():
    """Run every scenario in SCENARIOS (except 'random') at seed 42."""
    out = {}
    scenarios = sorted(n for n in vugg.SCENARIOS if n != "random")
    for name in scenarios:
        print(f"  capturing {name}...", end=" ", flush=True)
        try:
            out[name] = run_scenario(name)
            n_minerals = len(out[name])
            print(f"{n_minerals} mineral species")
        except Exception as e:
            print(f"ERROR: {e}")
            raise
    return out


def diff_baselines(current, baseline):
    """Return list of human-readable diff strings between two baseline dicts."""
    diffs = []
    for scenario in sorted(set(current) | set(baseline)):
        if scenario not in baseline:
            diffs.append(f"+ {scenario}: NEW (not in baseline)")
            continue
        if scenario not in current:
            diffs.append(f"- {scenario}: REMOVED (was in baseline)")
            continue
        cur_minerals = current[scenario]
        base_minerals = baseline[scenario]
        for mineral in sorted(set(cur_minerals) | set(base_minerals)):
            cur = cur_minerals.get(mineral)
            base = base_minerals.get(mineral)
            if cur is None:
                diffs.append(f"  {scenario}.{mineral}: REMOVED (was {base})")
            elif base is None:
                diffs.append(f"  {scenario}.{mineral}: NEW ({cur})")
            elif cur != base:
                diffs.append(
                    f"  {scenario}.{mineral}: {base} -> {cur}"
                )
    return diffs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Diff against existing baseline; don't overwrite",
    )
    args = parser.parse_args()

    BASELINES_DIR.mkdir(exist_ok=True)
    baseline_path = BASELINES_DIR / f"seed{SEED}_v{vugg.SIM_VERSION}.json"

    print(f"SIM_VERSION={vugg.SIM_VERSION}")
    print(f"Baseline file: {baseline_path.name}")
    print(f"Capturing {len([n for n in vugg.SCENARIOS if n != 'random'])} scenarios at seed={SEED}...")
    print()

    current = capture_all()

    if args.check:
        if not baseline_path.exists():
            print(f"\nNo baseline at {baseline_path} — nothing to check against.")
            sys.exit(2)
        with open(baseline_path, encoding="utf-8") as f:
            baseline = json.load(f)
        diffs = diff_baselines(current, baseline)
        if not diffs:
            print(f"\nOK: no drift from baseline ({baseline_path.name})")
            sys.exit(0)
        print(f"\nFAIL: drift from baseline ({len(diffs)} differences):")
        for d in diffs[:30]:
            print(d)
        if len(diffs) > 30:
            print(f"  ... +{len(diffs) - 30} more")
        sys.exit(1)

    # Write mode
    with open(baseline_path, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2, ensure_ascii=False, sort_keys=True)
    print(f"\nWrote baseline: {baseline_path}")
    print(f"Total scenarios: {len(current)}")
    total_species = sum(len(s) for s in current.values())
    print(f"Total mineral-realizations across all scenarios: {total_species}")


if __name__ == "__main__":
    main()
