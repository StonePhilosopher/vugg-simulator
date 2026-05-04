"""Cross-axis (polar) profile tests.

The equatorial bubble-merge profile defines the cavity outline as you
sweep θ around the rotation axis (slice the cavity horizontally).
Without a polar profile, slice the cavity vertically and you'd see a
perfect sphere shrink-shape — every latitude shares the same θ profile
scaled by sin(latitude). The polar Fourier profile adds vertical-axis
irregularity: each ring's effective radius is multiplied by a
per-latitude factor in [0.5, 1+sum(amp)], producing bulges and
pinches when the cavity is sliced vertically.

Renderer-only for v0: engine math (mean_diameter_mm, paint_crystal,
cell_arc_mm) still reads the equatorial profile via ring[0]'s
base_radius_mm, so the polar modulation doesn't change crystal
nucleation or growth.
"""
import math

import pytest


def test_polar_profile_seeded_reproducibility(vugg):
    """Same shape_seed → same polar amplitudes + phases. Different
    seeds → different profiles."""
    a = vugg.WallState(shape_seed=42)
    b = vugg.WallState(shape_seed=42)
    c = vugg.WallState(shape_seed=43)
    assert a.polar_amplitudes == b.polar_amplitudes
    assert a.polar_phases == b.polar_phases
    assert a.polar_amplitudes != c.polar_amplitudes


def test_polar_profile_three_harmonics(vugg):
    """The default polar profile uses 3 cosine harmonics — short enough
    to read as organic, long enough to be visibly irregular."""
    ws = vugg.WallState(shape_seed=42)
    assert len(ws.polar_amplitudes) == 3
    assert len(ws.polar_phases) == 3


def test_polar_profile_factor_within_amplitude_range(vugg):
    """Factor should never exceed 1 + sum_of_max_amplitudes (no
    runaway), and should never go below 0.5 (clamped floor to prevent
    ring-radius inversion)."""
    ws = vugg.WallState(shape_seed=42)
    max_combined = 1.0 + sum(abs(a) for a in ws.polar_amplitudes)
    for k in range(20):
        phi = math.pi * k / 19  # sample [0, π]
        f = ws.polar_profile_factor(phi)
        assert 0.5 <= f <= max_combined + 1e-9


def test_polar_profile_factor_continuity(vugg):
    """Factor is continuous in φ — adjacent samples should be close
    (no random jumps). This catches accidental discretization or
    sample-bug regressions."""
    ws = vugg.WallState(shape_seed=42)
    prev = ws.polar_profile_factor(0.0)
    for k in range(1, 100):
        phi = math.pi * k / 99
        cur = ws.polar_profile_factor(phi)
        # Cosine harmonics are smooth; adjacent samples (Δφ ≈ 0.03
        # rad) shouldn't differ by more than the worst-case derivative
        # times Δφ. Worst case derivative magnitude is ~ Σ|n*amp_n|.
        max_step = sum((n + 1) * abs(a) for n, a in enumerate(ws.polar_amplitudes)) * (math.pi / 99)
        assert abs(cur - prev) <= max_step + 1e-9
        prev = cur


def test_polar_profile_renderer_only_no_engine_impact(vugg):
    """Ring 0's base_radius_mm cells must NOT carry the polar factor —
    the engine reads ring[0] for cell_arc_mm, mean_diameter_mm, etc.,
    and the polar profile is supposed to be a renderer-only visual.
    With ring_count=16, ring 0 is the south pole; its base_radius_mm
    should match the equatorial bubble-merge profile (modulo the
    bubble-merge's own per-cell variation)."""
    a = vugg.WallState(shape_seed=42, ring_count=16)
    b = vugg.WallState(shape_seed=42, ring_count=1)
    # Same equatorial seed → same per-cell base_radius_mm on ring 0.
    for j, (cell_a, cell_b) in enumerate(zip(a.rings[0], b.rings[0])):
        assert cell_a.base_radius_mm == cell_b.base_radius_mm, (
            f"polar profile leaked into engine data: cell {j} "
            f"differs between ring_count=16 and ring_count=1"
        )
