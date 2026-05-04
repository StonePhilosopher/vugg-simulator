"""Phase A of PROPOSAL-3D-SIMULATION — multi-ring data shape.

Phase A introduces multi-ring scaffolding: WallState now holds N
parallel rings (default N=16) stacked vertically, but the engine still
writes only to ring[0]. Rings 1..N-1 hold pristine WallCell defaults.

These tests guard the foundation:
  1. Construction invariants (ring count, ring shape, identical
     base_radius_mm across all rings).
  2. ring_index_for_height_mm clamping math.
  3. SIM_VERSION bumped past 17 (signal that data shape changed).
  4. Forward-simulation parity: a fixed scenario run with ring_count=1
     produces identical crystal/dissolution outcomes vs ring_count=16.
     This is the key regression guard — Phase B/C/etc all assume that
     activating multi-ring shape is invisible to the engine until
     per-ring chemistry is added.
"""
import random

import pytest


# ---------------------------------------------------------------------------
# Construction invariants
# ---------------------------------------------------------------------------

def test_default_ring_count_is_16(vugg):
    """Phase A bumps the WallState default from 1 to 16."""
    ws = vugg.WallState()
    assert ws.ring_count == 16
    assert len(ws.rings) == 16


def test_explicit_ring_count_1_still_works(vugg):
    """Legacy callers can opt back to single-ring (used by parity test)."""
    ws = vugg.WallState(ring_count=1)
    assert ws.ring_count == 1
    assert len(ws.rings) == 1


def test_all_rings_share_base_radius_profile(vugg):
    """Phase A invariant: every ring has identical base_radius_mm at
    every cell. The profile is set by _build_profile() once and
    written across all rings — this is what 'identical chemistry'
    means at the geometry level."""
    ws = vugg.WallState(ring_count=16, primary_bubbles=3, secondary_bubbles=5,
                        shape_seed=42)
    ring0 = ws.rings[0]
    for r in range(1, 16):
        ring_r = ws.rings[r]
        assert len(ring_r) == len(ring0)
        for i, (c0, cr) in enumerate(zip(ring0, ring_r)):
            assert c0.base_radius_mm == cr.base_radius_mm, (
                f"ring[{r}][{i}].base_radius_mm differs from ring[0][{i}]"
            )


def test_non_zero_rings_pristine_at_construction(vugg):
    """Phase A: only ring[0] gets touched by the engine. Rings 1..N-1
    must start with default WallCell values so a future per-ring
    chemistry pass can detect 'unwritten' cells unambiguously."""
    ws = vugg.WallState(ring_count=16)
    for r in range(1, 16):
        for cell in ws.rings[r]:
            assert cell.wall_depth == 0.0
            assert cell.crystal_id is None
            assert cell.mineral is None
            assert cell.thickness_um == 0.0


# ---------------------------------------------------------------------------
# ring_index_for_height_mm helper
# ---------------------------------------------------------------------------

def test_ring_index_for_height_mm_clamps_below_floor(vugg):
    ws = vugg.WallState(ring_count=16, ring_spacing_mm=1.0)
    assert ws.ring_index_for_height_mm(-5.0) == 0
    assert ws.ring_index_for_height_mm(0.0) == 0


def test_ring_index_for_height_mm_clamps_above_ceiling(vugg):
    ws = vugg.WallState(ring_count=16, ring_spacing_mm=1.0)
    # Above the ceiling clamps to last ring.
    assert ws.ring_index_for_height_mm(1000.0) == 15


def test_ring_index_for_height_mm_interior(vugg):
    ws = vugg.WallState(ring_count=16, ring_spacing_mm=2.0)
    # height 0..2mm → ring 0; 2..4mm → ring 1; etc.
    assert ws.ring_index_for_height_mm(0.5) == 0
    assert ws.ring_index_for_height_mm(2.5) == 1
    assert ws.ring_index_for_height_mm(15.5) == 7


def test_ring_index_single_ring_always_zero(vugg):
    """A 1-ring vug treats every height as floor — useful for legacy
    callers and for the engine itself, which doesn't know its own
    ring_count."""
    ws = vugg.WallState(ring_count=1)
    assert ws.ring_index_for_height_mm(0.0) == 0
    assert ws.ring_index_for_height_mm(50.0) == 0
    assert ws.ring_index_for_height_mm(-100.0) == 0


# ---------------------------------------------------------------------------
# SIM_VERSION
# ---------------------------------------------------------------------------

def test_sim_version_bumped_past_17(vugg):
    """Phase A schema change deserves a SIM_VERSION bump so save-loaders
    can branch on it. 17 was the pre-Phase-A version."""
    assert vugg.SIM_VERSION >= 18


# ---------------------------------------------------------------------------
# Forward-simulation parity: ring_count=1 vs ring_count=16
# ---------------------------------------------------------------------------

def _wall_signature(sim):
    """A compact summary of the simulation's externally-visible state.
    Sums wall_depth and thickness ACROSS ALL RINGS so the signature is
    invariant under the Phase C v1 ring distribution (crystals now
    scatter across rings instead of bunching on ring 0)."""
    all_cells = [cell for ring in sim.wall_state.rings for cell in ring]
    return {
        "step": sim.step,
        "vug_diameter_mm": sim.conditions.wall.vug_diameter_mm,
        "n_crystals": len(sim.crystals),
        "crystal_ids": sorted(c.crystal_id for c in sim.crystals),
        "crystal_lengths": sorted(round(c.c_length_mm, 6) for c in sim.crystals),
        "crystal_minerals": sorted(c.mineral for c in sim.crystals),
        "wall_depth_sum": round(sum(c.wall_depth for c in all_cells), 6),
        "thickness_sum": round(sum(c.thickness_um for c in all_cells), 6),
    }


def _run_scenario(vugg, scenario_name, ring_count, steps, seed=12345):
    """Run a scenario for `steps` iterations with a forced ring_count.

    Done by patching the WallState shape after the simulator has
    constructed it but before any step runs — same effect as if the
    scenario JSON5 had declared `wall.ring_count`. We just need the
    pre-step WallState shape to match the requested count.

    Engine uses global `random` (intentional — one seed per run via
    CLI), so we re-seed before each run so the two parity paths
    produce identical RNG draws.
    """
    random.seed(seed)
    scenario_fn = vugg.SCENARIOS[scenario_name]
    conditions, events, _duration = scenario_fn()
    sim = vugg.VugSimulator(conditions, events=events)
    # Force the requested ring shape. Profile is already built; we
    # truncate or extend the rings list, sharing the profile from ring[0].
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
    for _ in range(steps):
        sim.run_step()
    return sim


# Note: the Phase A `test_forward_parity_ring_count_1_vs_16` test
# (verifying byte-identical output across ring counts) lived here for
# v0. Phase C v1 (proposal's Phase 2) deliberately breaks that
# invariant: per-ring chemistry fragments growth consumption across
# rings, so a crystal on ring 5 with ring_count=16 sees a slightly
# different ring fluid than the same crystal on ring 0 with
# ring_count=1. The species set stays the same (covered by
# test_forward_parity_under_phase_c_v1 in test_multi_ring_phase_c_v1),
# but exact thicknesses can drift by a few percent. Byte-parity is no
# longer the right invariant.


# Note: the original Phase A test "rings above 0 stay pristine" was
# a v0 anti-leak guard. Phase C v1 (PROPOSAL-3D-SIMULATION proposal's
# Phase 2) intentionally distributes crystals across rings, so the
# invariant no longer holds. Coverage moves to
# tests/test_multi_ring_phase_c_v1.py — see
# test_paint_crystal_writes_to_crystal_ring and
# test_free_wall_nucleations_distribute_across_rings.
