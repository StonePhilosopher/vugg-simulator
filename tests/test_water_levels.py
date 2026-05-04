"""v24 water-level mechanic — VugConditions.fluid_surface_ring +
ring_water_state classifier + nucleation stamping
crystal.growth_environment from the ring's water state.

Foundation pass: the engine knows what's wet vs dry. The renderer's
blue meniscus disc and the air-mode habit consequences land on top
of this scaffolding in subsequent steps.
"""
import random


def test_default_surface_means_fully_submerged(vugg):
    """fluid_surface_ring=None is the legacy / pre-v24 default.
    Every ring should classify as 'submerged' regardless of index,
    so existing scenarios stamp every crystal with growth_environment
    == 'fluid' and behave byte-identically to v23."""
    cond, _, _ = vugg.SCENARIOS["porphyry"]()
    assert cond.fluid_surface_ring is None
    for r in (0, 5, 8, 15):
        assert cond.ring_water_state(r, 16) == 'submerged', (
            f"ring {r} classified as {cond.ring_water_state(r, 16)} "
            f"under None surface — should be 'submerged'")


def test_partial_fill_classifies_rings(vugg):
    """fluid_surface_ring=8.5 in a 16-ring sim should give:
    rings 0..7 submerged, ring 8 meniscus, rings 9..15 vadose."""
    cond, _, _ = vugg.SCENARIOS["porphyry"]()
    cond.fluid_surface_ring = 8.5
    submerged = [r for r in range(16) if cond.ring_water_state(r, 16) == 'submerged']
    meniscus = [r for r in range(16) if cond.ring_water_state(r, 16) == 'meniscus']
    vadose = [r for r in range(16) if cond.ring_water_state(r, 16) == 'vadose']
    assert submerged == list(range(0, 8)), submerged
    assert meniscus == [8], meniscus
    assert vadose == list(range(9, 16)), vadose


def test_surface_at_integer_boundary(vugg):
    """fluid_surface_ring at integer k means rings 0..k-1 are
    submerged (k+1 ≤ surface fails for k itself), ring k is
    classified as vadose (k ≥ surface holds at equality), and
    no ring is the meniscus — surface sits cleanly on the
    boundary between rings."""
    cond, _, _ = vugg.SCENARIOS["porphyry"]()
    cond.fluid_surface_ring = 8.0
    assert cond.ring_water_state(7, 16) == 'submerged'
    assert cond.ring_water_state(8, 16) == 'vadose'
    submerged = [r for r in range(16) if cond.ring_water_state(r, 16) == 'submerged']
    vadose = [r for r in range(16) if cond.ring_water_state(r, 16) == 'vadose']
    meniscus = [r for r in range(16) if cond.ring_water_state(r, 16) == 'meniscus']
    assert submerged == list(range(0, 8))
    assert vadose == list(range(8, 16))
    assert meniscus == []


def test_surface_zero_means_dry_vug(vugg):
    """fluid_surface_ring=0 means no submerged rings — the cavity
    is fully drained. Ring 0 has surface at its floor (ring_idx >=
    surface holds), so it's vadose. Every ring should be vadose."""
    cond, _, _ = vugg.SCENARIOS["porphyry"]()
    cond.fluid_surface_ring = 0.0
    for r in range(16):
        assert cond.ring_water_state(r, 16) == 'vadose', (
            f"ring {r} classified as {cond.ring_water_state(r, 16)} "
            f"under surface=0 — should be 'vadose'")


def test_surface_at_top_means_fully_submerged(vugg):
    """fluid_surface_ring=ring_count means the entire vug is
    submerged: every ring is below the meniscus."""
    cond, _, _ = vugg.SCENARIOS["porphyry"]()
    cond.fluid_surface_ring = 16.0
    for r in range(16):
        assert cond.ring_water_state(r, 16) == 'submerged'


def test_single_ring_sim_handles_surface(vugg):
    """Single-ring simulations have no vertical structure. With surface
    >= 1 every ring is submerged; with surface < 1 the lone ring is
    vadose. No meniscus possible (the ring spans the whole cavity)."""
    cond, _, _ = vugg.SCENARIOS["porphyry"]()
    cond.fluid_surface_ring = None
    assert cond.ring_water_state(0, 1) == 'submerged'
    cond.fluid_surface_ring = 0.5
    assert cond.ring_water_state(0, 1) == 'vadose'
    cond.fluid_surface_ring = 1.0
    assert cond.ring_water_state(0, 1) == 'submerged'


def test_default_scenarios_stamp_all_crystals_fluid(vugg):
    """No existing scenario sets fluid_surface_ring, so every crystal
    nucleated should still get growth_environment == 'fluid'. Mirrors
    the v23 invariant — water-level mechanic is plumbed but dormant
    by default."""
    random.seed(42)
    cond, events, _ = vugg.SCENARIOS["porphyry"]()
    sim = vugg.VugSimulator(cond, events)
    for _ in range(120):
        sim.run_step()
    envs = {c.growth_environment for c in sim.crystals}
    assert envs == {'fluid'}, (
        f"default scenario produced growth_environments {envs} "
        f"— expected {{'fluid'}} only (no water level set)")


def test_partial_fill_stamps_air_in_vadose(vugg):
    """With fluid_surface_ring=8.5, crystals nucleating in rings
    9..15 (vadose) should be stamped 'air'; rings 0..8 (submerged
    + meniscus) should stamp 'fluid'. Test asserts the stamping
    matches the ring classification for every nucleated crystal."""
    random.seed(42)
    cond, events, _ = vugg.SCENARIOS["porphyry"]()
    cond.fluid_surface_ring = 8.5
    sim = vugg.VugSimulator(cond, events)
    for _ in range(150):
        sim.run_step()
    air_rings = [c.wall_ring_index for c in sim.crystals
                 if c.growth_environment == 'air']
    fluid_rings = [c.wall_ring_index for c in sim.crystals
                   if c.growth_environment == 'fluid']
    # Every 'air' crystal must be on a vadose ring (>= 9).
    assert all(r >= 9 for r in air_rings if r is not None), (
        f"air-stamped crystals on non-vadose rings: "
        f"{[r for r in air_rings if r is not None and r < 9]}")
    # Every 'fluid' crystal must be on a submerged or meniscus ring (<= 8).
    assert all(r <= 8 for r in fluid_rings if r is not None), (
        f"fluid-stamped crystals on vadose rings: "
        f"{[r for r in fluid_rings if r is not None and r > 8]}")
    # And the partial-fill scenario should actually produce some of each
    # (otherwise the test isn't exercising the branch it claims to).
    assert len(air_rings) > 0, "no 'air' crystals — vadose rings empty?"
    assert len(fluid_rings) > 0, "no 'fluid' crystals — submerged rings empty?"


def test_meniscus_ring_stamps_fluid_not_air(vugg):
    """Crystals on the meniscus ring are still in wet conditions
    (the surface band carries water by capillary action). Stamp
    them 'fluid', not 'air'. With surface=8.5, ring 8 is the
    meniscus — every crystal there should be 'fluid'."""
    random.seed(42)
    cond, events, _ = vugg.SCENARIOS["porphyry"]()
    cond.fluid_surface_ring = 8.5
    sim = vugg.VugSimulator(cond, events)
    for _ in range(150):
        sim.run_step()
    on_meniscus = [c for c in sim.crystals if c.wall_ring_index == 8]
    if on_meniscus:
        envs = {c.growth_environment for c in on_meniscus}
        assert envs == {'fluid'}, (
            f"meniscus ring crystals stamped {envs} — should be "
            f"{{'fluid'}} only (meniscus is wet)")
