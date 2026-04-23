"""Smoke tests — verify the test harness wires up correctly.

If these fail, no other test will run reliably either. Keep them minimal
and stable; do not pile feature tests in here.
"""


def test_vugg_imports(vugg):
    """vugg.py imports cleanly and exposes the expected attributes."""
    assert hasattr(vugg, "SIM_VERSION")
    assert hasattr(vugg, "FluidChemistry")
    assert hasattr(vugg, "VugConditions")
    assert hasattr(vugg, "MINERAL_ENGINES")
    assert hasattr(vugg, "VugSimulator")


def test_minerals_spec_loads(minerals_spec):
    """data/minerals.json is valid JSON with the expected top-level shape."""
    assert "minerals" in minerals_spec
    assert isinstance(minerals_spec["minerals"], dict)
    assert len(minerals_spec["minerals"]) > 0


def test_engine_count_matches_spec(vugg, minerals_spec):
    """Every mineral in the spec has an engine, and vice-versa.

    This catches the most common drift class (added a JSON entry but
    forgot to register the function, or vice-versa) at the structural
    level. Behavioral checks live in other test files.
    """
    spec_minerals = set(minerals_spec["minerals"].keys())
    engine_minerals = set(vugg.MINERAL_ENGINES.keys())
    only_in_spec = spec_minerals - engine_minerals
    only_in_engine = engine_minerals - spec_minerals
    assert not only_in_spec, (
        f"Minerals in data/minerals.json but missing from MINERAL_ENGINES: "
        f"{sorted(only_in_spec)}"
    )
    assert not only_in_engine, (
        f"Minerals in MINERAL_ENGINES but missing from data/minerals.json: "
        f"{sorted(only_in_engine)}"
    )


def test_sim_version_is_int(vugg):
    """SIM_VERSION should be a plain int — string or float would break version-bump conventions."""
    assert isinstance(vugg.SIM_VERSION, int)
    assert vugg.SIM_VERSION >= 1
