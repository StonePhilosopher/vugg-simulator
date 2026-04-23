"""Auto-generated gate tests for every mineral.

For each mineral in data/minerals.json, verifies:
  - supersaturation_<name>() method exists on VugConditions
  - With required_ingredients all zero, sigma == 0 (engine gate fires)
  - With required_ingredients at 3× threshold + favorable T/pH/Eh,
    sigma > 0 (engine doesn't have a hidden additional gate)
  - Each declared required ingredient is individually necessary
    (zeroing any ONE blocks sigma to 0)

These are STRUCTURAL gate tests — they don't validate exact sigma values
(scenario regression in test_scenarios.py covers behavioral baselines).
They ensure each mineral's "must have X to nucleate" claims in the spec
actually hold in the engine.

Pattern: drives all 62 (and growing) minerals from data/minerals.json
metadata. Adding a new mineral with a complete spec entry automatically
gets these tests. No new test code needed per mineral.
"""
from dataclasses import replace

import pytest

from tests.conftest import all_mineral_pairs

# Module-level data for parametrize (collection-time, before fixtures resolve)
MINERAL_PAIRS = all_mineral_pairs()
MINERAL_IDS = [name for name, _ in MINERAL_PAIRS]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ingredient_kwargs(spec, multiplier=5.0):
    """Build {ingredient: 5× threshold} dict from required_ingredients,
    plus zero out the FluidChemistry baseline non-required fields.

    Why zero the baselines: FluidChemistry has scenario-realistic defaults
    (SiO2=500, Ca=200, CO3=150, Fe=5, Mn=2, Al=3, Ti=0.5). Several engines
    have inter-mineral competition rules — e.g., chrysocolla loses sigma
    when default CO3=150 > test-set SiO2. Gate tests should isolate the
    declared required_ingredients, not implicit baseline coupling. So we
    start from all-zero, then set only what the spec declares.
    """
    required = spec.get("required_ingredients", {})
    # Baseline-zero override (these fields have non-zero defaults in
    # FluidChemistry that can interfere with engine gates via competition
    # rules):
    kwargs = {"SiO2": 0, "Ca": 0, "CO3": 0, "F": 0, "Fe": 0, "Mn": 0, "Al": 0, "Ti": 0}
    for elem, threshold in required.items():
        kwargs[elem] = max(float(threshold) * multiplier, 1.0)
    return kwargs


def _T_candidates(spec):
    """Generate sensible test temperatures from T_optimum / T_range."""
    T_opt = spec.get("T_optimum_C")
    if T_opt and len(T_opt) == 2:
        return [(T_opt[0] + T_opt[1]) / 2, T_opt[0] + 5, T_opt[1] - 5]
    T_range = spec.get("T_range_C")
    if T_range and len(T_range) == 2:
        return [(T_range[0] + T_range[1]) / 2, T_range[0] + 10, T_range[1] - 10]
    return [25.0, 100.0, 200.0]  # broad defaults


def _pH_candidates(spec):
    """Generate sensible test pH values from dissolution gates."""
    pH_below = spec.get("pH_dissolution_below")
    pH_above = spec.get("pH_dissolution_above")
    if pH_below is not None and pH_above is not None:
        # Stability window between two dissolution edges
        return [(pH_below + pH_above) / 2, pH_below + 0.5, pH_above - 0.5]
    if pH_below is not None:
        # Forms ABOVE pH_below; try a range up to alkaline
        return [pH_below + 0.5, pH_below + 2.0, pH_below + 4.0, 7.5]
    if pH_above is not None:
        # Forms BELOW pH_above; try a range down to acidic
        return [pH_above - 0.5, pH_above - 2.0, pH_above - 4.0, 3.0]
    return [5.5, 6.5, 7.5, 4.0]  # broad neutral-default sweep


def _O2_candidates(spec):
    """Generate sensible test O2 values from redox_requirement.

    The repo uses several redox vocab strings — keep this in sync. If a
    new redox value appears, add a mapping here rather than letting it
    fall through to the broad sweep (which will succeed but mask spec
    typos).
    """
    redox = spec.get("redox_requirement", "tolerant_both")
    if redox == "strongly_reducing":
        return [0.05, 0.15, 0.3]
    if redox == "reducing":
        return [0.2, 0.4, 0.6]
    if redox == "mildly_reducing":
        return [0.3, 0.5, 0.7]
    if redox == "oxidizing":
        return [1.0, 1.5, 2.0]
    if redox == "strongly_oxidizing":
        return [1.8, 2.0, 2.2]
    # "any" / "tolerant_both" / unknown — sweep the whole range
    return [0.1, 0.3, 0.6, 1.0, 1.5, 2.0]


def _pressure_candidates(spec):
    """Generate pressure candidates. Most engines don't gate on pressure,
    but vesicle-filling minerals (apophyllite, zeolites) need low pressure
    and deep-formation minerals (topaz, beryl) tolerate or want high.

    Sweep low + high so both classes have a chance. Search will pick
    whichever the engine likes.
    """
    return [0.1, 1.0, 3.0]


def _try_to_fire(vugg, name, spec):
    """Search over (T, pH, O2, pressure) candidates for a config that fires.

    Returns: (best_sigma, (T, pH, O2, pressure)) — if best_sigma > 0, the
    engine fires; if 0, no candidate config worked (real spec ↔ engine
    drift OR engine has constraints not captured in spec metadata).

    Important O2 nuance: when "O2" appears in required_ingredients, that's
    a MINIMUM (engine gates "O2 < threshold → 0"). It's NOT the optimum —
    e.g., cuprite's required O2 is 0.3 but engine ALSO gates "O2 > 1.2 → 0".
    So the search sweeps O2 candidates above the required minimum rather
    than just multiplying threshold by 5×.
    """
    base_kwargs = _ingredient_kwargs(spec, multiplier=5.0)
    required = spec.get("required_ingredients", {})
    required_O2_min = float(required.get("O2", 0))
    # Don't put O2 in base_kwargs; let the sweep set it (respecting the min).
    base_kwargs.pop("O2", None)

    method_name = f"supersaturation_{name}"
    best_sigma = 0
    best_config = None
    for T in _T_candidates(spec):
        for pH in _pH_candidates(spec):
            for O2 in _O2_candidates(spec):
                if O2 < required_O2_min:
                    continue  # below required minimum
                for pressure in _pressure_candidates(spec):
                    kwargs = dict(base_kwargs)
                    kwargs["O2"] = O2
                    kwargs["pH"] = pH
                    fluid = vugg.FluidChemistry(**kwargs)
                    cond = vugg.VugConditions(
                        temperature=T, pressure=pressure, fluid=fluid,
                    )
                    sigma = getattr(cond, method_name)()
                    if sigma > best_sigma:
                        best_sigma = sigma
                        best_config = (T, pH, O2, pressure)
    return best_sigma, best_config


def _favorable_fluid_for_necessity_test(vugg, name, spec):
    """Build the SINGLE best favorable fluid (used for necessity test).

    Necessity test needs a known-firing baseline so it can check that
    zeroing each ingredient blocks. Uses the search to find the optimal
    config, then returns it as a concrete fluid + T + pressure.

    Returns: (FluidChemistry, T, pressure) or (None, None, None) on miss.
    """
    best_sigma, best_config = _try_to_fire(vugg, name, spec)
    if best_sigma == 0 or best_config is None:
        return None, None, None
    T, pH, O2, pressure = best_config
    kwargs = _ingredient_kwargs(spec, multiplier=5.0)
    kwargs["O2"] = O2  # the search-found O2 (respects required minimum)
    kwargs["pH"] = pH
    return vugg.FluidChemistry(**kwargs), T, pressure


# Minerals where the favorable-fluid heuristic doesn't capture engine
# behavior — usually because the engine has rich coupling (e.g., multi-
# ingredient sigma products that need very high concentrations, or
# narrow T windows the spec doesn't fully describe). These are SKIPPED
# for the "fires above gate" test only — they still get the "blocks
# below" and "method exists" checks. Each entry MUST cite the reason.
HEURISTIC_SKIPS = {
    # Add entries here as failing minerals are triaged.
    # Format: "mineral_name": "reason heuristic doesn't apply"
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("name,spec", MINERAL_PAIRS, ids=MINERAL_IDS)
def test_supersaturation_method_exists(vugg, name, spec):
    """Every mineral must have a supersaturation_<name> method on VugConditions.

    Spec entries without a corresponding engine method are dead spec —
    they pass sync-spec.js if the dispatch table happens to point at a
    function with the right name, but they fail here if the function
    doesn't exist on VugConditions. Pre-engine spec drift catcher.
    """
    method_name = f"supersaturation_{name}"
    assert hasattr(vugg.VugConditions, method_name), (
        f"{name!r} is in data/minerals.json but VugConditions has no "
        f"{method_name}() method. Add the method or remove the spec entry."
    )
    method = getattr(vugg.VugConditions, method_name)
    assert callable(method), (
        f"{name}.{method_name} exists on VugConditions but is not callable"
    )


@pytest.mark.parametrize("name,spec", MINERAL_PAIRS, ids=MINERAL_IDS)
def test_blocks_when_all_ingredients_zero(vugg, name, spec):
    """With all required_ingredients zeroed, sigma should be 0.

    Catches the bug where the spec declares "Ba: 5" required but the
    engine forgot to gate on Ba — the mineral would nucleate from any
    fluid, regardless of its required chemistry. Worst class of drift.
    """
    if not spec.get("required_ingredients"):
        pytest.skip(f"{name} has no required_ingredients to test")
    # All-default FluidChemistry — most fields default to 0.0 except
    # SiO2/Ca/CO3/Fe/Mn/Al/Ti which have geological-baseline defaults.
    # Override those to 0 too so we genuinely test the gate.
    fluid = vugg.FluidChemistry(
        SiO2=0, Ca=0, CO3=0, F=0, Fe=0, Mn=0, Al=0, Ti=0,
    )
    cond = vugg.VugConditions(temperature=25, fluid=fluid)
    sigma = getattr(cond, f"supersaturation_{name}")()
    assert sigma == 0, (
        f"{name}: expected sigma=0 with all-zero fluid, got {sigma:.3f}. "
        f"Either required_ingredients in the spec is wrong, or the "
        f"engine's gate is missing/incomplete. Required ingredients: "
        f"{spec.get('required_ingredients')}"
    )


@pytest.mark.parametrize("name,spec", MINERAL_PAIRS, ids=MINERAL_IDS)
def test_fires_with_favorable_fluid(vugg, name, spec):
    """Some combination of (T, pH, O2) within the spec's declared ranges
    should fire the engine when ingredients are at 5× threshold.

    Search-based: tries multiple T/pH/O2 candidates from the spec's
    T_range, pH_dissolution_below/above, and redox_requirement; passes
    if ANY combination yields sigma > 0. This catches genuine spec ↔
    engine drift while being robust to heuristic mismatch on minerals
    with narrow stability windows.

    If a mineral fails: either the spec's declared ranges don't actually
    overlap the engine's accept range (real bug — fix the spec OR fix
    the engine), or the engine has constraints that aren't expressible
    in the standard spec fields (add to HEURISTIC_SKIPS with a citation
    of which engine constraint isn't captured).
    """
    if not spec.get("required_ingredients"):
        pytest.skip(f"{name} has no required_ingredients to test")
    if name in HEURISTIC_SKIPS:
        pytest.skip(f"{name}: {HEURISTIC_SKIPS[name]}")
    best_sigma, best_config = _try_to_fire(vugg, name, spec)
    assert best_sigma > 0, (
        f"{name}: NO combination of (T, pH, O2) candidates derived from "
        f"the spec yielded sigma > 0 even at 5× ingredient thresholds. "
        f"This is a real spec ↔ engine drift: the spec's declared T_range "
        f"{spec.get('T_range_C')}, pH gates "
        f"(below={spec.get('pH_dissolution_below')}, "
        f"above={spec.get('pH_dissolution_above')}), and "
        f"redox_requirement={spec.get('redox_requirement')!r} do not "
        f"overlap the engine's accept window. Either fix the spec to "
        f"match the engine, or fix the engine to match the spec. "
        f"Required ingredients: {spec.get('required_ingredients')}"
    )


@pytest.mark.parametrize("name,spec", MINERAL_PAIRS, ids=MINERAL_IDS)
def test_each_ingredient_is_necessary(vugg, name, spec):
    """Zeroing any ONE required ingredient should block sigma to 0.

    Catches the bug where the spec declares "Ba, S, O2" required but
    the engine actually only gates on "Ba and S" (O2 is ignored). Each
    ingredient declared in the spec must be a real, necessary gate.
    """
    required = spec.get("required_ingredients", {})
    if not required:
        pytest.skip(f"{name} has no required_ingredients to test")
    if name in HEURISTIC_SKIPS:
        pytest.skip(f"{name}: {HEURISTIC_SKIPS[name]}")
    fluid_base, T, pressure = _favorable_fluid_for_necessity_test(vugg, name, spec)
    if fluid_base is None:
        pytest.skip(
            f"{name}: no favorable-fluid config found (covered by "
            f"test_fires_with_favorable_fluid failure)"
        )

    failures = []
    for elem in required:
        # Build a fluid where THIS ONE element is zeroed but everything else
        # remains at the favorable level.
        fluid = replace(fluid_base, **{elem: 0.0})
        cond = vugg.VugConditions(temperature=T, pressure=pressure, fluid=fluid)
        sigma = getattr(cond, f"supersaturation_{name}")()
        if sigma > 0:
            failures.append(
                f"  zeroing {elem!r} → sigma={sigma:.3f} (expected 0)"
            )
    assert not failures, (
        f"{name}: required_ingredients includes elements that the engine "
        f"doesn't actually gate on:\n" + "\n".join(failures) +
        f"\nEither remove these elements from required_ingredients in the "
        f"spec, or add the missing gates in the engine."
    )
