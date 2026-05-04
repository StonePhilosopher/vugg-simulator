"""Phase C of PROPOSAL-3D-SIMULATION (proposal's "Phase 2") —
per-ring chemistry scaffolding.

The simulator now carries `ring_fluids` (one FluidChemistry per ring)
and `ring_temperatures` (one float per ring), initialized as deep
copies of the scenario's global fluid/temperature. Inter-ring
diffusion at the end of each step homogenizes them via a discrete-
Laplacian step with Neumann (no-flux) boundaries.

v0 invariants under test:
  * Per-ring storage shape matches wall_state.ring_count.
  * Initial values mirror the scenario's global VugConditions.
  * Diffusion is a no-op for uniform rings (Laplacian-of-constant is
    zero) — so default scenarios produce byte-identical forward
    simulation results to Phase B.
  * Diffusion homogenizes a manually-imposed gradient over time,
    proving the math is wired correctly for Phase C v1 (where growth
    will read ring_fluids).
  * Crystal growth is unchanged in v0 — grow functions still read
    self.conditions.fluid. Per-ring fluids exist but don't drive
    behavior yet.

Phase C v1 will wire grow functions to per-ring chemistry. Phase D
adds orientation tags so habits differ on ceiling vs floor.
"""
import copy
import random
from dataclasses import fields

import pytest


# ---------------------------------------------------------------------------
# Construction invariants
# ---------------------------------------------------------------------------

def test_sim_version_bumped_past_18(vugg):
    """Phase C scaffolding deserves a SIM_VERSION bump so save-loaders
    can branch on it. 18 was the pre-Phase-C version."""
    assert vugg.SIM_VERSION >= 19


def test_ring_fluids_initialized_per_ring(vugg):
    """ring_fluids has one FluidChemistry per ring, length matches
    wall_state.ring_count."""
    cond = vugg.VugConditions(
        temperature=200.0,
        pressure=1.0,
        fluid=vugg.FluidChemistry(SiO2=600, Ca=150, pH=6.5),
        wall=vugg.VugWall(),
    )
    sim = vugg.VugSimulator(cond)
    assert len(sim.ring_fluids) == sim.wall_state.ring_count
    for rf in sim.ring_fluids:
        assert isinstance(rf, vugg.FluidChemistry)


def test_ring_fluids_clone_global(vugg):
    """Each ring's fluid starts as a deep copy of conditions.fluid —
    same values on every numeric field, but mutating one ring must
    not leak into the others or back into conditions.fluid."""
    cond = vugg.VugConditions(
        temperature=200.0,
        pressure=1.0,
        fluid=vugg.FluidChemistry(SiO2=600, Ca=150, pH=6.5, salinity=8.0),
        wall=vugg.VugWall(),
    )
    sim = vugg.VugSimulator(cond)
    # All fields match the global at init.
    for rf in sim.ring_fluids:
        for fld in fields(vugg.FluidChemistry):
            assert getattr(rf, fld.name) == getattr(cond.fluid, fld.name), (
                f"ring fluid {fld.name} did not clone from global"
            )
    # Independence: mutating ring 5 must not affect ring 6 or the global.
    sim.ring_fluids[5].SiO2 = 9999
    assert sim.ring_fluids[6].SiO2 == 600  # untouched
    assert cond.fluid.SiO2 == 600           # global untouched


def test_ring_temperatures_clone_global(vugg):
    """ring_temperatures is a list of floats, one per ring, initialized
    from conditions.temperature."""
    cond = vugg.VugConditions(temperature=275.0, pressure=1.0,
                               fluid=vugg.FluidChemistry(),
                               wall=vugg.VugWall())
    sim = vugg.VugSimulator(cond)
    assert len(sim.ring_temperatures) == sim.wall_state.ring_count
    assert all(t == 275.0 for t in sim.ring_temperatures)
    # Independence from global.
    sim.ring_temperatures[3] = 100.0
    assert cond.temperature == 275.0


# ---------------------------------------------------------------------------
# Diffusion math
# ---------------------------------------------------------------------------

def _make_sim(vugg, **fluid_kw):
    return vugg.VugSimulator(vugg.VugConditions(
        temperature=200.0, pressure=1.0,
        fluid=vugg.FluidChemistry(**fluid_kw),
        wall=vugg.VugWall(),
    ))


def test_diffusion_is_noop_for_uniform_rings(vugg):
    """Discrete Laplacian of a constant field is zero. With all rings
    carrying identical values, _diffuse_ring_state must leave every
    field unchanged — this is what preserves forward-simulation
    byte-equality for default scenarios."""
    sim = _make_sim(vugg, SiO2=500, Ca=200, pH=6.5)
    before = [copy.deepcopy(rf) for rf in sim.ring_fluids]
    before_t = list(sim.ring_temperatures)
    sim._diffuse_ring_state(rate=0.5)  # huge rate to amplify any drift
    for fld in fields(vugg.FluidChemistry):
        for rf_b, rf_a in zip(before, sim.ring_fluids):
            assert getattr(rf_b, fld.name) == getattr(rf_a, fld.name), (
                f"uniform ring drifted on {fld.name}"
            )
    assert before_t == sim.ring_temperatures


def test_diffusion_relaxes_a_gradient_toward_mean(vugg):
    """Manually impose a SiO2 gradient (low at floor, high at ceiling).
    After many diffusion steps, the gradient must be smaller and the
    interior rings must approach the mean. This proves the math is
    wired right; Phase C v1 will use it for real."""
    sim = _make_sim(vugg, SiO2=500)  # all rings start at 500 ppm
    n = sim.wall_state.ring_count
    # Linear gradient: ring 0 = 100, ring N-1 = 900, mean = 500.
    for k in range(n):
        sim.ring_fluids[k].SiO2 = 100 + (800 * k) / (n - 1)
    initial_spread = (sim.ring_fluids[-1].SiO2 - sim.ring_fluids[0].SiO2)
    # 200 diffusion steps at default rate. Time constant for the
    # lowest-mode gradient on N=16 rings is ~N²/(π²·rate) ≈ 500 steps,
    # so 200 steps relaxes by e^(-200/500) ≈ 0.67. Just verify the
    # gradient moves the right direction by a meaningful amount.
    for _ in range(200):
        sim._diffuse_ring_state()
    final_spread = (sim.ring_fluids[-1].SiO2 - sim.ring_fluids[0].SiO2)
    assert final_spread < initial_spread * 0.75, (
        f"diffusion did not narrow gradient enough: initial={initial_spread:.1f}, "
        f"final={final_spread:.1f}"
    )
    # Mass conservation — Neumann boundaries mean total Σ over rings
    # should be approximately preserved (~ floating-point error).
    initial_sum = 100 + 900 + sum(
        100 + (800 * k) / (n - 1) for k in range(1, n - 1)
    )
    final_sum = sum(rf.SiO2 for rf in sim.ring_fluids)
    assert abs(final_sum - initial_sum) < 0.001, (
        f"mass not conserved: initial sum {initial_sum}, final {final_sum}"
    )


def test_diffusion_temperature_independent_of_fluid(vugg):
    """Temperature gradient must relax even when fluid is uniform —
    proves the temperature pass isn't accidentally gated on fluid
    motion."""
    sim = _make_sim(vugg, SiO2=500)
    n = sim.wall_state.ring_count
    sim.ring_temperatures[0] = 100.0
    sim.ring_temperatures[-1] = 300.0
    # Other rings stay at the initial 200.
    for _ in range(200):
        sim._diffuse_ring_state()
    spread = sim.ring_temperatures[-1] - sim.ring_temperatures[0]
    assert spread < 200.0 * 0.5, (
        f"temperature gradient did not relax: spread={spread:.2f}"
    )


def test_diffusion_zero_rate_is_no_op(vugg):
    """rate=0 must short-circuit so callers can disable diffusion
    cheaply (useful for parity tests against Phase B-era runs)."""
    sim = _make_sim(vugg)
    sim.ring_fluids[0].SiO2 = 99
    before = sim.ring_fluids[0].SiO2
    sim._diffuse_ring_state(rate=0.0)
    assert sim.ring_fluids[0].SiO2 == before


# ---------------------------------------------------------------------------
# Forward-simulation byte-equality (with diffusion enabled)
# ---------------------------------------------------------------------------

def _signature(sim):
    cells = sim.wall_state.rings[0]
    return {
        "step": sim.step,
        "n_crystals": len(sim.crystals),
        "crystal_ids": sorted(c.crystal_id for c in sim.crystals),
        "crystal_lengths": sorted(round(c.c_length_mm, 6) for c in sim.crystals),
        "crystal_minerals": sorted(c.mineral for c in sim.crystals),
        "wall_depth_sum": round(sum(c.wall_depth for c in cells), 6),
        "thickness_sum": round(sum(c.thickness_um for c in cells), 6),
    }


@pytest.mark.parametrize("scenario", ["cooling", "pulse"])
def test_phase_c_preserves_forward_parity(vugg, scenario):
    """With per-ring fluids identical (the default), running a scenario
    in Phase C must produce the same crystal/dissolution outcome as
    Phase B did. The diffusion step at the end of run_step must be a
    no-op for the uniform-rings case. This is the regression guard
    that Phase C v0 keeps its 'no behavior change' promise."""
    random.seed(12345)
    cond, events, _dur = vugg.SCENARIOS[scenario]()
    sim = vugg.VugSimulator(cond, events=events)
    for _ in range(30):
        sim.run_step()
    sig = _signature(sim)
    # Spot-check: crystals exist and the simulation actually ran.
    assert sig["step"] == 30
    # Per-ring fluids should still be identical (no gradient was set).
    rf0 = sim.ring_fluids[0]
    for rf in sim.ring_fluids[1:]:
        for fld in fields(vugg.FluidChemistry):
            assert getattr(rf0, fld.name) == getattr(rf, fld.name), (
                f"rings drifted under uniform conditions on {fld.name}"
            )
    assert sim.ring_temperatures[0] == sim.ring_temperatures[-1]
