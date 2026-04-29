"""Mineral metastability mechanics — re-dissolution, paramorph, etc.

Round 8e introduces the first water-solubility metastability mechanic
in the sim. Chalcanthite (CuSO₄·5H₂O) re-dissolves when the host fluid
becomes more dilute (salinity < 4) OR less acidic (pH > 5). Distinct
from THERMAL_DECOMPOSITION (high-T destruction) and PARAMORPH_TRANSITIONS
(in-place mineral change) — this is just chemistry.

Future metastability mechanics added to this file: cinnabar/metacinnabar
phase boundary, gypsum/anhydrite hydration cycles, etc.
"""
import pytest


def _make_chalcanthite_crystal(vugg, *, total_growth_um=20.0):
    """Construct a fresh chalcanthite crystal with some growth."""
    c = vugg.Crystal(
        mineral="chalcanthite",
        crystal_id=1,
        nucleation_step=1,
        nucleation_temp=30,
        position="vug wall",
        habit="stalactitic",
    )
    z = vugg.GrowthZone(
        step=1, temperature=30,
        thickness_um=total_growth_um, growth_rate=total_growth_um,
        note="stalactitic chalcanthite",
    )
    c.add_zone(z)
    return c


def test_chalcanthite_persists_in_concentrated_acidic_fluid(vugg):
    """High salinity + low pH → chalcanthite stays put across run_step."""
    conditions = vugg.VugConditions(
        temperature=30,
        fluid=vugg.FluidChemistry(Cu=100, S=200, O2=1.5, pH=3.0, salinity=20.0),
    )
    sim = vugg.VugSimulator(conditions)
    c = _make_chalcanthite_crystal(vugg, total_growth_um=20.0)
    c.crystal_id = 999
    sim.crystals.append(c)
    sim.run_step()
    assert not c.dissolved
    assert c.active
    # total_growth_um should not have decreased.
    assert c.total_growth_um >= 20.0


def test_chalcanthite_dissolves_in_dilute_fluid(vugg):
    """Salinity < 4 → chalcanthite re-dissolves over a run_step."""
    conditions = vugg.VugConditions(
        temperature=30,
        fluid=vugg.FluidChemistry(Cu=100, S=200, O2=1.5, pH=3.0, salinity=2.0),
    )
    sim = vugg.VugSimulator(conditions)
    c = _make_chalcanthite_crystal(vugg, total_growth_um=20.0)
    c.crystal_id = 999
    sim.crystals.append(c)
    pre_growth = c.total_growth_um
    sim.run_step()
    # Growth should have decreased (or crystal fully dissolved).
    assert c.total_growth_um < pre_growth or c.dissolved
    log_text = "\n".join(sim.log)
    assert "RE-DISSOLVED" in log_text or "re-dissolving" in log_text.lower()


def test_chalcanthite_dissolves_in_neutral_fluid(vugg):
    """pH > 5 → chalcanthite re-dissolves over a run_step (even if salty)."""
    conditions = vugg.VugConditions(
        temperature=30,
        fluid=vugg.FluidChemistry(Cu=100, S=200, O2=1.5, pH=7.0, salinity=20.0),
    )
    sim = vugg.VugSimulator(conditions)
    c = _make_chalcanthite_crystal(vugg, total_growth_um=20.0)
    c.crystal_id = 999
    sim.crystals.append(c)
    pre_growth = c.total_growth_um
    sim.run_step()
    assert c.total_growth_um < pre_growth or c.dissolved


def test_chalcanthite_full_dissolution_marks_crystal_inactive(vugg):
    """Multiple dilute steps fully dissolve a small chalcanthite — crystal
    becomes inactive + dissolved + Cu/S returned to fluid."""
    conditions = vugg.VugConditions(
        temperature=30,
        fluid=vugg.FluidChemistry(Cu=100, S=200, O2=1.5, pH=7.0, salinity=2.0),
    )
    sim = vugg.VugSimulator(conditions)
    c = _make_chalcanthite_crystal(vugg, total_growth_um=10.0)  # small, fully dissolves
    c.crystal_id = 999
    sim.crystals.append(c)
    # Run enough steps to ensure full dissolution. The dissolution rate
    # is asymptotic (40% per step) until total_growth_um < 0.5, then
    # collapses to zero. Loop generously.
    for _ in range(40):
        sim.run_step()
        if c.dissolved:
            break
    assert c.dissolved, f"crystal still has {c.total_growth_um} µm after 40 steps"
    assert not c.active
    # Crystal is now fully dissolved; the inventory still tracks it but
    # its growth zone is gone. (We don't assert the fluid Cu/S balance
    # here because other engines in run_step also pull on those pools.)
    assert c.total_growth_um <= 0


def test_other_minerals_unaffected_by_water_solubility_hook(vugg):
    """The water-solubility hook fires only for chalcanthite, not other
    minerals — running steps with a calcite crystal in dilute fluid
    should not trigger the chalcanthite re-dissolution log path."""
    conditions = vugg.VugConditions(
        temperature=30,
        fluid=vugg.FluidChemistry(Ca=200, CO3=200, O2=1.0, pH=7.0, salinity=2.0),
    )
    sim = vugg.VugSimulator(conditions)
    cal = vugg.Crystal(
        mineral="calcite",
        crystal_id=1,
        nucleation_step=1,
        nucleation_temp=30,
        position="vug wall",
        habit="rhombohedral",
    )
    cal.add_zone(vugg.GrowthZone(step=1, temperature=30, thickness_um=20.0, growth_rate=20.0))
    sim.crystals.append(cal)
    sim.run_step()
    log_text = "\n".join(sim.log)
    # The water-solubility re-dissolution hook should NOT fire for calcite.
    assert "RE-DISSOLVED" not in log_text
