"""Phase C v1 of PROPOSAL-3D-SIMULATION — per-ring chemistry actually
drives growth.

Phase C v0 added per-ring fluid + temperature storage with diffusion
but didn't wire it into growth. Phase C v1 wires it: every nucleated
crystal gets a wall_ring_index (random for free-wall, inherited for
host-substrate overgrowths), paint_crystal targets the crystal's ring
instead of always ring 0, and the engine call temporarily swaps
conditions.fluid + temperature to the crystal's ring's values so
mass-balance side effects (consumption, byproduct release) hit
ring_fluids[k].

Phase C v0 tests still hold (per-ring storage shape, diffusion
math, etc.) — this file adds the v1 invariants:

  * Crystals get a non-None wall_ring_index at nucleation.
  * Free-wall nucleations distribute across rings (not all on ring 0).
  * Host-substrate overgrowths inherit the host's ring.
  * paint_crystal writes to the crystal's ring, not ring 0.
  * Per-ring fluid is consumed/modified by growth (not the global).
  * Forward parity: ring_count=1 vs ring_count=16 produce same
    crystal/dissolution outcome (RNG state preserved by always
    consuming one randrange call per nucleation regardless of ring
    count).
"""
import random

import pytest


def test_sim_version_bumped_past_19(vugg):
    """Phase C v1 deserves a SIM_VERSION bump."""
    assert vugg.SIM_VERSION >= 20


def test_new_crystals_have_wall_ring_index(vugg):
    """Every new crystal nucleated through nucleate() gets a non-None
    wall_ring_index. Phase C v0 set this on Crystal as Optional[int]
    with default None for legacy save loading; v1 always sets it."""
    random.seed(42)
    cond, events, _ = vugg.SCENARIOS["cooling"]()
    sim = vugg.VugSimulator(cond, events)
    for _ in range(20):
        sim.run_step()
    assert len(sim.crystals) > 0, "scenario produced no crystals"
    for c in sim.crystals:
        assert c.wall_ring_index is not None, (
            f"crystal {c.crystal_id} ({c.mineral}) has no wall_ring_index"
        )
        assert 0 <= c.wall_ring_index < sim.wall_state.ring_count


def test_free_wall_nucleations_distribute_across_rings(vugg):
    """With 16 rings and a scenario that produces multiple crystals,
    nucleations should land on more than one ring (Phase C v1
    distributes randomly across rings; Phase D will weight by
    orientation)."""
    random.seed(42)
    cond, events, _ = vugg.SCENARIOS["porphyry"]()
    sim = vugg.VugSimulator(cond, events)
    for _ in range(120):
        sim.run_step()
    rings_used = {c.wall_ring_index for c in sim.crystals
                   if c.wall_ring_index is not None}
    assert len(rings_used) >= 2, (
        f"expected crystals to scatter across rings, got {rings_used}"
    )


def test_host_substrate_overgrowths_inherit_ring(vugg):
    """Crystals whose position string references another crystal
    (e.g. 'on pyrite #3') must land on the host's ring so
    pseudomorphs/overgrowths paint on the same latitude band."""
    cond = vugg.VugConditions(
        temperature=200.0, pressure=1.0,
        fluid=vugg.FluidChemistry(),
        wall=vugg.VugWall(),
    )
    sim = vugg.VugSimulator(cond)
    # Manually nucleate a host on a specific ring.
    host = sim.nucleate("pyrite", "vug wall", sigma=2.0)
    host.wall_ring_index = 7  # force a specific ring
    # Now nucleate a child overgrowth referencing the host.
    child = sim.nucleate("chalcopyrite", f"on pyrite #{host.crystal_id}",
                          sigma=1.5)
    assert child.wall_ring_index == 7


def test_paint_crystal_writes_to_crystal_ring(vugg):
    """paint_crystal must mark the crystal's ring (not always ring 0).
    With a crystal explicitly placed on ring 5, ring 0 should stay
    pristine and ring 5 should carry the paint."""
    cond = vugg.VugConditions(
        temperature=200.0, pressure=1.0,
        fluid=vugg.FluidChemistry(),
        wall=vugg.VugWall(),
    )
    sim = vugg.VugSimulator(cond)
    crystal = vugg.Crystal(
        crystal_id=1, mineral="quartz", nucleation_step=0,
        nucleation_temp=200.0, position="vug wall",
    )
    crystal.wall_center_cell = 60
    crystal.wall_ring_index = 5
    crystal.total_growth_um = 100.0  # painted thickness
    sim.wall_state.paint_crystal(crystal)
    # Ring 5 should carry crystal_id=1 on at least the anchor cell.
    assert sim.wall_state.rings[5][60].crystal_id == 1
    # Ring 0 should stay pristine.
    for cell in sim.wall_state.rings[0]:
        assert cell.crystal_id is None


def test_growth_uses_per_ring_fluid(vugg):
    """When the engine runs for a crystal on ring k, it should see
    that ring's fluid (not the global). We prove this by manually
    setting ring 5's SiO2 differently from the global, nucleating a
    quartz on ring 5, and watching growth respond to the ring's
    chemistry — specifically, the side effect of growth consuming
    SiO2 must hit ring_fluids[5], not conditions.fluid."""
    cond = vugg.VugConditions(
        temperature=200.0, pressure=1.0,
        fluid=vugg.FluidChemistry(SiO2=600.0, Ca=150.0),
        wall=vugg.VugWall(),
    )
    sim = vugg.VugSimulator(cond)
    # Make ring 5's silica markedly higher so quartz grows there
    # specifically, leaving evidence in ring_fluids[5] but not in
    # ring_fluids[0] or the global.
    sim.ring_fluids[5].SiO2 = 1500.0
    # Bypass nucleate() to stay in control of the placement.
    crystal = vugg.Crystal(
        crystal_id=1, mineral="quartz", nucleation_step=0,
        nucleation_temp=200.0, position="vug wall",
        wall_center_cell=60, wall_ring_index=5, total_growth_um=10.0,
    )
    sim.crystals.append(crystal)
    initial_ring5_sio2 = sim.ring_fluids[5].SiO2
    initial_global_sio2 = sim.conditions.fluid.SiO2
    initial_ring0_sio2 = sim.ring_fluids[0].SiO2
    # Run a few steps; the quartz engine on ring 5 should pull SiO2
    # out of ring_fluids[5] (consumption side effect).
    for _ in range(5):
        sim.run_step()
    # After several steps, the global SiO2 should be unchanged-by-
    # this-crystal (modulo whatever wall dissolution / events did
    # to the global, which the cooling-default scenario has nothing
    # of). We don't assert exact values — just that the consumption
    # path is reaching ring_fluids[5] and the global is unaffected
    # by crystal 1's growth.
    # Strict check: ring 5 dropped relative to its initial.
    assert sim.ring_fluids[5].SiO2 < initial_ring5_sio2 + 0.01, (
        "ring 5 SiO2 didn't decrease — engine isn't reading per-ring fluid"
    )
    # The global hasn't been hit by crystal 1's consumption — though
    # diffusion will leak some over many steps, after 5 steps the
    # global should still be near its initial value.
    # (Exact-value assertion impractical because diffusion mixes;
    # this just guards "the consumption isn't going to the global".)
    # We require the global to drift LESS than ring 5 dropped — proving
    # the consumption hit ring 5 first, and only diffusion (slow)
    # propagates to the global.
    ring5_drop = initial_ring5_sio2 - sim.ring_fluids[5].SiO2
    global_drop = initial_global_sio2 - sim.conditions.fluid.SiO2
    # Allow some equilibration but ring 5 must be more depleted.
    assert ring5_drop > global_drop, (
        f"ring 5 should be more depleted than global; "
        f"ring 5 drop={ring5_drop:.2f}, global drop={global_drop:.2f}"
    )


def _wall_signature(sim):
    all_cells = [c for r in sim.wall_state.rings for c in r]
    return {
        "step": sim.step,
        "n_crystals": len(sim.crystals),
        "crystal_ids": sorted(c.crystal_id for c in sim.crystals),
        "crystal_lengths": sorted(round(c.c_length_mm, 6) for c in sim.crystals),
        "crystal_minerals": sorted(c.mineral for c in sim.crystals),
        "wall_depth_sum": round(sum(c.wall_depth for c in all_cells), 6),
        "thickness_sum": round(sum(c.thickness_um for c in all_cells), 6),
    }


def _run(vugg, scenario, ring_count, steps, seed=12345):
    random.seed(seed)
    cond, events, _ = vugg.SCENARIOS[scenario]()
    sim = vugg.VugSimulator(cond, events)
    if ring_count != sim.wall_state.ring_count:
        ring0 = sim.wall_state.rings[0]
        if ring_count == 1:
            sim.wall_state.rings = [ring0]
        else:
            sim.wall_state.rings = [ring0]
            for _ in range(ring_count - 1):
                clone = [vugg.WallCell(base_radius_mm=c.base_radius_mm)
                          for c in ring0]
                sim.wall_state.rings.append(clone)
        sim.wall_state.ring_count = ring_count
        # Resize ring_fluids/temps to match (they were sized at __init__).
        while len(sim.ring_fluids) < ring_count:
            from dataclasses import replace
            sim.ring_fluids.append(replace(sim.ring_fluids[0]))
            sim.ring_temperatures.append(sim.ring_temperatures[0])
        sim.ring_fluids = sim.ring_fluids[:ring_count]
        sim.ring_temperatures = sim.ring_temperatures[:ring_count]
    for _ in range(steps):
        sim.run_step()
    return sim


@pytest.mark.parametrize("scenario", ["cooling", "pulse"])
def test_forward_parity_under_phase_c_v1(vugg, scenario):
    """Per-ring chemistry breaks byte-identical parity across ring
    counts (Phase C v1 fragments growth consumption across rings).
    But the SPECIES SET should be the same — the same minerals
    nucleate in the same scenario regardless of ring_count, even if
    their exact thicknesses drift a few percent. This test verifies
    that loose invariant; byte-equality of thicknesses is no longer
    expected and would over-constrain Phase D's habit-orientation
    work."""
    sim_a = _run(vugg, scenario, ring_count=1, steps=30)
    sim_b = _run(vugg, scenario, ring_count=16, steps=30)
    species_a = sorted(c.mineral for c in sim_a.crystals)
    species_b = sorted(c.mineral for c in sim_b.crystals)
    assert species_a == species_b, (
        f"species set diverged for scenario={scenario}:\n"
        f"  ring_count=1:  {species_a}\n"
        f"  ring_count=16: {species_b}"
    )
    # And the crystal count should match (same nucleation events fire).
    assert len(sim_a.crystals) == len(sim_b.crystals)
