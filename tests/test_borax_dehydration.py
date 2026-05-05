"""v28 borax + tincalconite + dehydration paramorph mechanic.

Three things to verify:
1. Borax supersaturation gates (Na + B + alkaline pH + low T + concentration)
2. Borax growth engine (mass balance, habit selection)
3. apply_dehydration_transitions: borax in a vadose ring with dryness
   → tincalconite paramorph after threshold steps; high T fires immediate.
"""
import random


# ---------------- supersaturation gates ----------------------------------

def test_borax_dormant_without_boron(vugg):
    """No B in fluid → no borax even with everything else right."""
    cond = vugg.VugConditions()
    cond.fluid.Na = 1500
    cond.fluid.B = 0
    cond.fluid.pH = 9.0
    cond.fluid.concentration = 3.0
    cond.temperature = 30
    assert cond.supersaturation_borax() == 0


def test_borax_dormant_in_acidic_fluid(vugg):
    """Borate doesn't stay in solution at pH < 7 → no borax."""
    cond = vugg.VugConditions()
    cond.fluid.Na = 1500
    cond.fluid.B = 100
    cond.fluid.pH = 5.5
    cond.fluid.concentration = 3.0
    cond.temperature = 30
    assert cond.supersaturation_borax() == 0


def test_borax_dormant_above_60c(vugg):
    """Decahydrate isn't stable above 60°C — engine refuses to grow."""
    cond = vugg.VugConditions()
    cond.fluid.Na = 1500
    cond.fluid.B = 100
    cond.fluid.pH = 9.0
    cond.fluid.concentration = 3.0
    cond.temperature = 80
    assert cond.supersaturation_borax() == 0


def test_borax_fires_in_alkaline_drained_brine(vugg):
    """Na + B + pH 9 + concentration 3 + T < 60 → strong supersat."""
    cond = vugg.VugConditions()
    cond.fluid.Na = 1500
    cond.fluid.B = 100
    cond.fluid.pH = 9.0
    cond.fluid.concentration = 3.0
    cond.temperature = 30
    sigma = cond.supersaturation_borax()
    assert sigma > 1.0


def test_borax_supersat_responds_to_concentration_quadratically(vugg):
    """Per the spec — concentration boost is squared in σ. Checked at
    c=2 vs c=4 (both above the 1.5 hard-gate)."""
    cond = vugg.VugConditions()
    cond.fluid.Na = 1500
    cond.fluid.B = 100
    cond.fluid.pH = 9.0
    cond.temperature = 30
    cond.fluid.Ca = 0  # no borate-stealer
    cond.fluid.concentration = 2.0
    sigma_2 = cond.supersaturation_borax()
    cond.fluid.concentration = 4.0
    sigma_4 = cond.supersaturation_borax()
    # Quadratic: doubling concentration should ~quadruple σ.
    assert abs(sigma_4 / sigma_2 - 4.0) < 0.1, (
        f"σ ratio at 4× vs 2× concentration = {sigma_4 / sigma_2:.2f}, "
        f"expected ~4.0 (quadratic)")
    # Below-gate concentration still returns 0.
    cond.fluid.concentration = 1.0
    assert cond.supersaturation_borax() == 0


def test_borax_suppressed_by_competing_calcium(vugg):
    """High Ca steals borate as colemanite/inyoite → borax σ falls."""
    cond = vugg.VugConditions()
    cond.fluid.Na = 1500
    cond.fluid.B = 100
    cond.fluid.pH = 9.0
    cond.fluid.concentration = 3.0
    cond.temperature = 30
    cond.fluid.Ca = 0
    sigma_no_ca = cond.supersaturation_borax()
    cond.fluid.Ca = 200
    sigma_ca_rich = cond.supersaturation_borax()
    assert sigma_ca_rich < sigma_no_ca, (
        f"high-Ca brine should reduce borax σ, got {sigma_ca_rich:.2f} "
        f"(expected < {sigma_no_ca:.2f})")


# ---------------- growth engine ------------------------------------------

def test_borax_growth_consumes_na_and_b(vugg):
    """grow_borax mass-balances Na + B out of the fluid."""
    random.seed(42)
    cond = vugg.VugConditions()
    cond.fluid.Na = 2000
    cond.fluid.B = 200
    cond.fluid.pH = 9.0
    cond.fluid.concentration = 3.0
    cond.temperature = 30
    cond.fluid.Ca = 0
    crystal = vugg.Crystal(
        mineral='borax', crystal_id=1, nucleation_step=0,
        nucleation_temp=25, position='vug wall')
    pre_Na = cond.fluid.Na
    pre_B = cond.fluid.B
    zone = vugg.grow_borax(crystal, cond, step=1)
    assert zone is not None and zone.thickness_um > 0
    assert cond.fluid.Na < pre_Na
    assert cond.fluid.B < pre_B


def test_borax_redissolves_on_meteoric_flush(vugg):
    """concentration < 1.5 (refill) should redissolve a small borax."""
    random.seed(42)
    cond = vugg.VugConditions()
    cond.fluid.Na = 100
    cond.fluid.B = 5
    cond.fluid.concentration = 1.0  # below 1.5 threshold
    cond.temperature = 25
    crystal = vugg.Crystal(
        mineral='borax', crystal_id=1, nucleation_step=0,
        nucleation_temp=25, position='vug wall')
    crystal.total_growth_um = 30
    crystal.c_length_mm = 0.03
    zone = vugg.grow_borax(crystal, cond, step=1)
    assert zone is not None
    assert zone.thickness_um < 0
    assert crystal.dissolved


# ---------------- dehydration paramorph ---------------------------------

def test_dehydration_no_op_in_submerged_ring(vugg):
    """Borax in a submerged ring should NOT accumulate dry exposure
    or transition. Submerged = wet = no dehydration."""
    crystal = vugg.Crystal(
        mineral='borax', crystal_id=1, nucleation_step=0,
        nucleation_temp=25, position='vug wall')
    fluid = vugg.FluidChemistry()
    fluid.concentration = 3.0
    for _ in range(50):
        result = vugg.apply_dehydration_transitions(
            crystal, fluid, 'submerged', T=30, step=1)
        assert result is None
    assert crystal.dry_exposure_steps == 0
    assert crystal.mineral == 'borax'


def test_dehydration_fires_after_threshold_in_vadose(vugg):
    """Borax in a vadose ring increments dry_exposure_steps each step
    until the 25-step threshold; transition fires on that step."""
    random.seed(42)
    crystal = vugg.Crystal(
        mineral='borax', crystal_id=1, nucleation_step=0,
        nucleation_temp=25, position='vug wall')
    fluid = vugg.FluidChemistry()
    fluid.concentration = 1.0  # vadose path doesn't require concentration
    fired_at = None
    for step in range(1, 50):
        result = vugg.apply_dehydration_transitions(
            crystal, fluid, 'vadose', T=30, step=step)
        if result is not None:
            fired_at = step
            break
    assert fired_at is not None
    assert crystal.mineral == 'tincalconite'
    assert crystal.paramorph_origin == 'borax'
    assert crystal.paramorph_step == fired_at
    assert crystal.dry_exposure_steps == 25


def test_dehydration_fires_in_meniscus_only_with_concentration(vugg):
    """Meniscus rings count as dry only when concentration ≥ 1.5
    (proxy for active evaporation)."""
    crystal_a = vugg.Crystal(
        mineral='borax', crystal_id=1, nucleation_step=0,
        nucleation_temp=25, position='vug wall')
    fluid_dry = vugg.FluidChemistry()
    fluid_dry.concentration = 2.0
    crystal_b = vugg.Crystal(
        mineral='borax', crystal_id=2, nucleation_step=0,
        nucleation_temp=25, position='vug wall')
    fluid_wet = vugg.FluidChemistry()
    fluid_wet.concentration = 1.0  # below threshold
    for step in range(1, 30):
        vugg.apply_dehydration_transitions(crystal_a, fluid_dry, 'meniscus', 30, step)
        vugg.apply_dehydration_transitions(crystal_b, fluid_wet, 'meniscus', 30, step)
    assert crystal_a.mineral == 'tincalconite'
    assert crystal_b.mineral == 'borax', (
        f"meniscus + low concentration should NOT dehydrate, got "
        f"{crystal_b.mineral} after {crystal_b.dry_exposure_steps} steps")


def test_dehydration_heat_path_fires_immediately(vugg):
    """Above T_max (75°C for borax), dehydration fires probabilistically
    each step — no slow counter. A few steps should produce at least
    one transition with high probability."""
    random.seed(42)
    crystal = vugg.Crystal(
        mineral='borax', crystal_id=1, nucleation_step=0,
        nucleation_temp=25, position='vug wall')
    fluid = vugg.FluidChemistry()
    fluid.concentration = 1.0
    fired_at = None
    for step in range(1, 10):
        result = vugg.apply_dehydration_transitions(
            crystal, fluid, 'submerged', T=80, step=step)
        if result is not None:
            fired_at = step
            break
    assert fired_at is not None and fired_at <= 5, (
        f"heat path should fire fast at T=80, got step {fired_at}")
    assert crystal.mineral == 'tincalconite'


def test_dehydration_preserves_external_shape(vugg):
    """Paramorph preserves habit, dominant_forms, c_length_mm.
    The crystal's external geometry survives — only crystal.mineral
    changes."""
    crystal = vugg.Crystal(
        mineral='borax', crystal_id=1, nucleation_step=0,
        nucleation_temp=25, position='vug wall')
    crystal.habit = 'prismatic'
    crystal.dominant_forms = ['{100} pinacoid', '{110} prism']
    crystal.c_length_mm = 12.5
    fluid = vugg.FluidChemistry()
    fluid.concentration = 1.0
    for step in range(1, 30):
        vugg.apply_dehydration_transitions(crystal, fluid, 'vadose', 30, step)
    assert crystal.mineral == 'tincalconite'
    # External properties preserved
    assert crystal.habit == 'prismatic'
    assert crystal.dominant_forms == ['{100} pinacoid', '{110} prism']
    assert crystal.c_length_mm == 12.5


def test_dehydrated_tincalconite_does_not_re_dehydrate(vugg):
    """Once converted, tincalconite isn't in DEHYDRATION_TRANSITIONS,
    so subsequent calls are no-ops. (Tincalconite doesn't lose more
    water under normal humidity — only at >320°C does it go anhydrous,
    which is out of scope here.)"""
    crystal = vugg.Crystal(
        mineral='tincalconite', crystal_id=1, nucleation_step=0,
        nucleation_temp=25, position='vug wall')
    fluid = vugg.FluidChemistry()
    for step in range(1, 30):
        result = vugg.apply_dehydration_transitions(
            crystal, fluid, 'vadose', 30, step)
        assert result is None
    assert crystal.mineral == 'tincalconite'


def test_dehydration_transitions_table_includes_borax(vugg):
    """Sanity: DEHYDRATION_TRANSITIONS has the expected borax → tincal
    mapping with sensible thresholds."""
    table = vugg.DEHYDRATION_TRANSITIONS
    assert 'borax' in table
    new_mineral, threshold, conc_min, T_max = table['borax']
    assert new_mineral == 'tincalconite'
    assert threshold > 0
    assert conc_min >= 1.0
    assert T_max > 60  # above borax's stability ceiling


# ---------------- end-to-end ---------------------------------------------

def test_drained_brine_grows_borax_then_dehydrates(vugg):
    """End-to-end: a Na-B-rich alkaline brine drained with low Ca
    should grow borax, and prolonged vadose exposure should
    pseudomorph some of those crystals to tincalconite."""
    random.seed(42)
    cond = vugg.VugConditions()
    cond.fluid.Na = 1500
    cond.fluid.B = 200
    cond.fluid.pH = 9.0
    cond.fluid.Ca = 10
    cond.temperature = 30
    cond.fluid_surface_ring = 8.0
    sim = vugg.VugSimulator(cond, [])
    for r in range(9, 16):
        sim.ring_fluids[r].concentration = 3.0
    for _ in range(150):
        sim.run_step()
    borax = [c for c in sim.crystals if c.mineral == 'borax']
    tincalconite = [c for c in sim.crystals if c.mineral == 'tincalconite']
    assert len(borax) > 0, "expected borax to fire from drained brine"
    assert len(tincalconite) > 0, (
        f"expected ≥ 1 tincalconite paramorph after 150 steps; got 0. "
        f"Total borax crystals (active + paramorphed) was "
        f"{len(borax) + len(tincalconite)}")
    # Every tincalconite must trace back to borax
    for c in tincalconite:
        assert c.paramorph_origin == 'borax'
        assert c.paramorph_step is not None
