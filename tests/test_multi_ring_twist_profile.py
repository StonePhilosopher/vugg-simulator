"""Phase F: per-latitude θ twist tests.

Each ring receives a small θ rotation that varies smoothly with
latitude. Adjacent rings rotate similar amounts, so the equatorial
bubble-merge bumps spiral up the cavity wall instead of stacking in
vertical columns. Renderer-only — engine data is unchanged.
"""
import math


def test_twist_profile_seeded_reproducibility(vugg):
    """Same shape_seed → same twist amplitudes + phases."""
    a = vugg.WallState(shape_seed=42)
    b = vugg.WallState(shape_seed=42)
    c = vugg.WallState(shape_seed=43)
    assert a.twist_amplitudes == b.twist_amplitudes
    assert a.twist_phases == b.twist_phases
    assert a.twist_amplitudes != c.twist_amplitudes


def test_twist_profile_independent_of_polar(vugg):
    """The twist profile uses a different XOR mask than the polar
    profile, so a seed that gives a strong polar bulge shouldn't
    also force a particular twist. Empirical check: at least one
    of {polar, twist} amplitudes differs across two seeds."""
    s1 = vugg.WallState(shape_seed=42)
    s2 = vugg.WallState(shape_seed=42 ^ 1)
    assert (s1.polar_amplitudes != s2.polar_amplitudes
            or s1.twist_amplitudes != s2.twist_amplitudes)


def test_twist_three_harmonics(vugg):
    ws = vugg.WallState(shape_seed=42)
    assert len(ws.twist_amplitudes) == 3
    assert len(ws.twist_phases) == 3


def test_twist_continuity(vugg):
    """Twist should vary smoothly in φ. Adjacent samples differ by no
    more than the worst-case derivative * Δφ."""
    ws = vugg.WallState(shape_seed=42)
    prev = ws.ring_twist_radians(0.0)
    for k in range(1, 100):
        phi = math.pi * k / 99
        cur = ws.ring_twist_radians(phi)
        max_step = sum((n + 1) * abs(a)
                        for n, a in enumerate(ws.twist_amplitudes)) * (math.pi / 99)
        assert abs(cur - prev) <= max_step + 1e-9
        prev = cur


def test_twist_renderer_only_no_engine_impact(vugg):
    """Engine data on ring[0] (cells' base_radius_mm) must match
    between ring_count=1 and ring_count=16 with the same seed —
    the twist only affects rendering, not the per-cell data the
    engine reads."""
    a = vugg.WallState(shape_seed=42, ring_count=16)
    b = vugg.WallState(shape_seed=42, ring_count=1)
    for j, (cell_a, cell_b) in enumerate(zip(a.rings[0], b.rings[0])):
        assert cell_a.base_radius_mm == cell_b.base_radius_mm, (
            f"twist profile leaked into engine data: cell {j} differs"
        )
