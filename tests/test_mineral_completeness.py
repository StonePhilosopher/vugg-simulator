"""Per-mineral structural completeness tests.

For each mineral in data/minerals.json, validates that the spec entry is
complete and self-consistent. Catches the class of bug where a new mineral
ships with an incomplete or malformed spec entry — the kind of thing you
notice 6 months later when the Library UI fails to render that mineral.

Overlaps with tools/sync-spec.js but provides per-mineral failure
granularity (sync-spec gives bulk pass/fail; pytest tells you exactly
which mineral and which field is the problem).

Test categories:
  1. Required JSON fields present + correct type
  2. required_ingredients references real FluidChemistry fields
  3. trace_ingredients references real FluidChemistry fields
  4. Declared narrate_function exists on VugSimulator
  5. habit_variants are well-formed (name + 5 required sub-fields, valid vector)
  6. T_range_C / T_optimum_C are well-formed [low, high] pairs
"""
import dataclasses

import pytest

from tests.conftest import all_mineral_pairs

MINERAL_PAIRS = all_mineral_pairs()
MINERAL_IDS = [name for name, _ in MINERAL_PAIRS]


REQUIRED_SPEC_FIELDS = [
    "formula",
    "nucleation_sigma",
    "max_size_cm",
    "growth_rate_mult",
    "thermal_decomp_C",
    "fluorescence",
    "twin_laws",
    "acid_dissolution",
    "habit",
    "narrate_function",
    "runtimes_present",
    "class",
    "description",
    "scenarios",
    "habit_variants",
    "required_ingredients",
]

# Per proposals/vugg-mineral-template.md §3, habit_variants[].vector
# must be one of these 5. The template explicitly says: "Anything else
# is noise" — the topo renderer + space scorer use these tokens.
VALID_VECTORS = {"projecting", "coating", "tabular", "equant", "dendritic"}


def _fluid_field_names():
    """All valid FluidChemistry attribute names — used to validate
    required_ingredients/trace_ingredients keys reference real fields."""
    import vugg
    return {f.name for f in dataclasses.fields(vugg.FluidChemistry)}


FLUID_FIELDS = _fluid_field_names()


# ---------------------------------------------------------------------------
# Spec field completeness
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("name,spec", MINERAL_PAIRS, ids=MINERAL_IDS)
def test_has_required_fields(name, spec):
    """Every mineral must declare all required spec fields per _schema."""
    missing = [f for f in REQUIRED_SPEC_FIELDS if f not in spec]
    assert not missing, (
        f"{name}: missing required spec fields: {missing}. "
        f"All minerals must declare {REQUIRED_SPEC_FIELDS}."
    )


@pytest.mark.parametrize("name,spec", MINERAL_PAIRS, ids=MINERAL_IDS)
def test_field_types(name, spec):
    """Required fields have correct types (catches typos like '0.4' instead of 0.4)."""
    type_checks = [
        ("formula", str),
        ("nucleation_sigma", (int, float)),
        ("max_size_cm", (int, float)),
        ("growth_rate_mult", (int, float)),
        ("class", str),
        ("description", str),
        ("scenarios", list),
        ("habit_variants", list),
        ("required_ingredients", dict),
        ("runtimes_present", list),
    ]
    failures = []
    for field, expected in type_checks:
        if field not in spec:
            continue
        v = spec[field]
        if not isinstance(v, expected):
            failures.append(
                f"  {field}: expected {expected}, got {type(v).__name__}={v!r}"
            )
    assert not failures, (
        f"{name}: spec field type errors:\n" + "\n".join(failures)
    )


# ---------------------------------------------------------------------------
# Reference integrity — keys must be real FluidChemistry fields
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("name,spec", MINERAL_PAIRS, ids=MINERAL_IDS)
def test_required_ingredients_are_fluid_fields(name, spec):
    """required_ingredients keys must be real FluidChemistry attribute names.

    Catches typos like 'Si' (should be 'SiO2') or 'Sulfur' (should be 'S')
    that would silently never gate the engine.
    """
    required = spec.get("required_ingredients", {})
    bad = [k for k in required if k not in FLUID_FIELDS]
    assert not bad, (
        f"{name}: required_ingredients references non-FluidChemistry "
        f"fields: {bad}. Valid fields: {sorted(FLUID_FIELDS)}"
    )


# Documented future schema additions — minerals reference these in
# trace_ingredients to record real geochemical species that don't yet
# have FluidChemistry fields. They're documented for future schema
# extensions (the same mineral commits that pre-research these elements
# also leave pending_schema_additions notes in locality_chemistry.json).
# Adding to this list documents the intent without inventing a field.
KNOWN_PENDING_TRACE_FIELDS = {
    "Cd",         # MVT sphalerite trace; future grow_greenockite (BACKLOG)
    "Cs",         # pegmatite trace in beryl/spodumene
    "Re",         # rhenium in molybdenite (Bingham porphyry-Re byproduct)
    "REE",        # rare earth elements aggregate marker
    "Y",          # often grouped with REE
    "Th",         # thorium decay-chain marker (uraninite)
    "Hg",         # mercury, mostly cinnabar future
    # Non-elemental annotations (narrator-only flags):
    "OH",         # structural hydroxide notation in some entries
    "radiation",  # radiation-damage flag (uraninite)
}


@pytest.mark.parametrize("name,spec", MINERAL_PAIRS, ids=MINERAL_IDS)
def test_trace_ingredients_are_fluid_fields(name, spec):
    """trace_ingredients keys must be real FluidChemistry fields, or
    declared pending future-schema additions in KNOWN_PENDING_TRACE_FIELDS.

    Catches typos like 'Si' (should be 'SiO2') while allowing legitimate
    documentation of upcoming schema extensions. New entries to
    KNOWN_PENDING_TRACE_FIELDS must cite a corresponding BACKLOG item
    or geochemical justification.
    """
    trace = spec.get("trace_ingredients", {})
    valid = FLUID_FIELDS | KNOWN_PENDING_TRACE_FIELDS
    bad = [k for k in trace if k not in valid]
    assert not bad, (
        f"{name}: trace_ingredients references unknown fields: {bad}. "
        f"Either typo (real fields: {sorted(FLUID_FIELDS)}), or "
        f"add to KNOWN_PENDING_TRACE_FIELDS with a citation if it's "
        f"a documented future schema addition."
    )


# ---------------------------------------------------------------------------
# Narrate function existence
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("name,spec", MINERAL_PAIRS, ids=MINERAL_IDS)
def test_narrate_function_exists(vugg, name, spec):
    """If spec declares narrate_function, that method must exist on VugSimulator.

    This is the same check sync-spec.js does, but with per-mineral
    failure messages.
    """
    nf = spec.get("narrate_function")
    if not nf:
        # null is allowed — means "use generic narrator" (which is None today,
        # so the mineral gets no descriptive text, but that's not a structural
        # bug — flag those as a separate "needs narrator" backlog item)
        pytest.skip(f"{name}: narrate_function is null (no narrator declared)")
    assert hasattr(vugg.VugSimulator, nf), (
        f"{name}: spec declares narrate_function={nf!r} but VugSimulator "
        f"has no such method. Either add the method, or set narrate_function "
        f"to null."
    )
    method = getattr(vugg.VugSimulator, nf)
    assert callable(method), (
        f"{name}: VugSimulator.{nf} exists but is not callable"
    )


# ---------------------------------------------------------------------------
# habit_variants well-formed
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("name,spec", MINERAL_PAIRS, ids=MINERAL_IDS)
def test_habit_variants_well_formed(name, spec):
    """Each habit_variant must have name + 4 numeric/enum sub-fields per template."""
    habits = spec.get("habit_variants", [])
    if not habits:
        pytest.skip(f"{name}: no habit_variants declared")
    failures = []
    for i, h in enumerate(habits):
        if not isinstance(h, dict):
            failures.append(f"  variant[{i}]: not a dict (got {type(h).__name__})")
            continue
        for required_field in ("name", "wall_spread", "void_reach", "vector", "trigger"):
            if required_field not in h:
                failures.append(f"  variant[{i}].{required_field}: missing")
        # Type + range checks
        if "wall_spread" in h:
            ws = h["wall_spread"]
            if not isinstance(ws, (int, float)) or ws < 0 or ws > 1:
                failures.append(
                    f"  variant[{i}].wall_spread: expected 0.0-1.0, got {ws!r}"
                )
        if "void_reach" in h:
            vr = h["void_reach"]
            if not isinstance(vr, (int, float)) or vr < 0 or vr > 1:
                failures.append(
                    f"  variant[{i}].void_reach: expected 0.0-1.0, got {vr!r}"
                )
        if "vector" in h:
            v = h["vector"]
            if v not in VALID_VECTORS:
                failures.append(
                    f"  variant[{i}].vector: {v!r} not in {sorted(VALID_VECTORS)}"
                )
    assert not failures, (
        f"{name}: habit_variants malformed:\n" + "\n".join(failures)
    )


# ---------------------------------------------------------------------------
# T_range / T_optimum well-formed
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("name,spec", MINERAL_PAIRS, ids=MINERAL_IDS)
def test_T_ranges_well_formed(name, spec):
    """T_range_C and T_optimum_C must be [low, high] with low < high."""
    failures = []
    for field in ("T_range_C", "T_optimum_C"):
        if field not in spec:
            continue
        v = spec[field]
        if v is None:
            continue
        if not isinstance(v, list) or len(v) != 2:
            failures.append(f"  {field}: expected [low, high], got {v!r}")
            continue
        low, high = v
        if not isinstance(low, (int, float)) or not isinstance(high, (int, float)):
            failures.append(f"  {field}: non-numeric values: {v!r}")
            continue
        if low > high:
            failures.append(f"  {field}: low ({low}) > high ({high})")
    # T_optimum should be inside T_range when both are present
    if (spec.get("T_range_C") and spec.get("T_optimum_C")
            and isinstance(spec["T_range_C"], list)
            and isinstance(spec["T_optimum_C"], list)):
        r_low, r_high = spec["T_range_C"]
        o_low, o_high = spec["T_optimum_C"]
        if o_low < r_low or o_high > r_high:
            failures.append(
                f"  T_optimum_C {spec['T_optimum_C']} extends outside "
                f"T_range_C {spec['T_range_C']}"
            )
    assert not failures, (
        f"{name}: T-range fields malformed:\n" + "\n".join(failures)
    )


# ---------------------------------------------------------------------------
# Scenarios reference integrity
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("name,spec", MINERAL_PAIRS, ids=MINERAL_IDS)
def test_scenarios_are_real(vugg, name, spec):
    """Spec-declared scenarios must match real entries in vugg.SCENARIOS.

    Catches the bug where a new mineral cites a scenario that was
    renamed/removed/never existed.
    """
    declared = spec.get("scenarios", [])
    if not declared:
        pytest.skip(f"{name}: no scenarios declared")
    real = set(vugg.SCENARIOS.keys()) - {"random"}
    bad = [s for s in declared if s not in real]
    assert not bad, (
        f"{name}: spec.scenarios references unknown scenarios: {bad}. "
        f"Valid: {sorted(real)}"
    )
