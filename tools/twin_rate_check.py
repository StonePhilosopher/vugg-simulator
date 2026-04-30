#!/usr/bin/env python3
"""Statistical check: each mineral's nucleation-time twin rate should match
the sum of its declared spontaneous twin_law probabilities in
data/minerals.json.

The bug this catches:
  Pre-fix (Round 9 closeout 2026-04-30), each grow_*() function rolled
  `random.random() < probability` per growth step, so a crystal with 30
  zones at p=0.1 had ~92% twinning rate — dramatically higher than the
  declared per-roll probability.

  Post-fix, the roll happens once at nucleation per twin_law (see
  VugSimulator._roll_spontaneous_twin in vugg.py). Rate should equal
  the sum of declared spontaneous probabilities.

Triggers containing 'thermal_shock' or 'tectonic' are excluded from
the spontaneous set — those remain in their grow_*() functions as
event-conditional logic (currently only quartz Dauphiné).

Usage:
    python tools/twin_rate_check.py             # default n=2000 per mineral
    python tools/twin_rate_check.py --n 5000    # more samples (tighter)
    python tools/twin_rate_check.py --verbose   # print per-mineral expected/measured

Exit code 0 if all rates within tolerance, 1 otherwise. Tolerance is
±2σ of the binomial standard deviation, computed from n and p.
"""

import argparse
import math
import random
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

from vugg import (
    Crystal, FluidChemistry, VugConditions, VugWall, VugSimulator,
    MINERAL_SPEC,
)


def is_spontaneous(law):
    """A twin law is 'spontaneous' (rolled at nucleation) if it has a
    numeric positive probability and its trigger doesn't reference an
    event-driven mechanism (thermal_shock, tectonic)."""
    if not isinstance(law, dict):
        return False
    p = law.get("probability")
    if not isinstance(p, (int, float)) or p <= 0:
        return False
    trigger = (law.get("trigger") or "").lower()
    if "thermal_shock" in trigger or "tectonic" in trigger:
        return False
    return True


def expected_rate(twin_laws):
    """Expected twin rate at nucleation: sum of spontaneous twin_law
    probabilities. (For independent rolls with small probabilities,
    the union is approximately the sum; exact union for n laws with
    p_i is 1 - prod(1-p_i).)"""
    p_none = 1.0
    for law in twin_laws:
        if is_spontaneous(law):
            p_none *= (1 - law["probability"])
    return 1 - p_none


def measure_rate(mineral, n_samples):
    """Direct nucleation-only measurement: build a fresh Crystal +
    VugSimulator per sample, call sim.nucleate(mineral), check
    crystal.twinned. Bypasses growth entirely so the only mechanism
    that can set twinned is the nucleation-time roll."""
    spec = MINERAL_SPEC.get(mineral)
    if not spec:
        return None

    # Build a fluid that satisfies required_ingredients × generous
    # multiplier — every nucleate() call should succeed.
    fluid_kwargs = {
        k: max(v * 5, 5) for k, v in (spec.get("required_ingredients") or {}).items()
    }
    fluid_kwargs.setdefault("pH", 6.5)
    fluid_kwargs.setdefault("O2", 1.5)
    fluid_kwargs.setdefault("CO3", 50)

    twinned_count = 0
    for _ in range(n_samples):
        cond = VugConditions(
            temperature=25, pressure=0.1,
            fluid=FluidChemistry(**fluid_kwargs),
            wall=VugWall(),
        )
        sim = VugSimulator(conditions=cond)
        crystal = sim.nucleate(mineral, position="test", sigma=2.0)
        if crystal.twinned:
            twinned_count += 1
    return twinned_count / n_samples


def tolerance(n, p):
    """±2σ binomial confidence band for n samples at expected rate p."""
    if n <= 0:
        return 1.0
    sigma = math.sqrt(p * (1 - p) / n)
    # Floor at 0.01 to allow noise on near-zero rates and avoid spurious
    # failures when p is tiny.
    return max(0.01, 2 * sigma)


def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--n", type=int, default=2000)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    random.seed(args.seed)

    print(f"Twin-rate check (n={args.n} nucleations per mineral, seed={args.seed})")
    print("Compares measured nucleation-time twin rate to declared spontaneous")
    print("twin_law probabilities in data/minerals.json. ±2σ binomial tolerance.")
    print()

    minerals_to_test = sorted(
        name for name, m in MINERAL_SPEC.items()
        if any(is_spontaneous(law) for law in (m.get("twin_laws") or []))
    )

    print(f"{'mineral':<25} {'expected':>9} {'measured':>9} {'delta':>7} {'tol':>5}  status")
    print("-" * 72)

    failures = []
    skips = []
    for mineral in minerals_to_test:
        spec = MINERAL_SPEC[mineral]
        twin_laws = spec.get("twin_laws") or []
        expected = expected_rate(twin_laws)
        measured = measure_rate(mineral, n_samples=args.n)
        if measured is None:
            skips.append(mineral)
            continue
        delta = measured - expected
        tol = tolerance(args.n, expected)
        ok = abs(delta) <= tol
        status = "OK" if ok else "FAIL"
        print(f"{mineral:<25} {expected:>9.3f} {measured:>9.3f} {delta:>+7.3f} {tol:>5.3f}  {status}")
        if not ok:
            failures.append((mineral, expected, measured, delta, tol))

    print()
    if failures:
        print(f"FAIL: {len(failures)} mineral(s) outside tolerance.")
        for name, exp, meas, d, tol in failures:
            print(f"  {name}: expected {exp:.3f}, got {meas:.3f} (delta {d:+.3f}, tol ±{tol:.3f})")
        return 1
    if skips:
        print(f"(Skipped {len(skips)}: {', '.join(skips)})")
    print(f"All {len(minerals_to_test) - len(skips)} measured twin rates match expected within ±2σ tolerance.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
