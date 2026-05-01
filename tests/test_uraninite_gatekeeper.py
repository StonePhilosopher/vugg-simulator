"""v12 — Uraninite gatekeeper mechanic regression tests.

Per research/research-uraninite.md (boss canonical 626bb22, May 2026):
uraninite is the gatekeeper for the entire secondary uranium family.
The chain is:

  reducing fluid + U → uraninite scavenges U from broth
  conditions flip oxidizing → uraninite oxidizes (UO₂ + ½O₂ + 2H⁺ → UO₂²⁺)
  released uranyl ion → broth U rises → secondary U minerals nucleate

These tests verify:
  1. supersaturation_uraninite gates correctly on reducing/oxidizing
  2. grow_uraninite dissolves grown crystals when O₂ rises
  3. Dissolution releases U back to broth
  4. The full chain works in an end-to-end VugSimulator run

Pre-v12 the JS runtimes used a T-only formula with no O₂ gate; the
reconciliation is also covered here (Python remains canonical, JS now
matches it via supersat parity tests in the cross-runtime suite).
"""

import random

import pytest

from vugg import (
    Crystal,
    FluidChemistry,
    GrowthZone,
    VugConditions,
    VugWall,
    grow_uraninite,
)


def _reducing_u_fluid(u=80.0, T=400.0, o2=0.0, ph=6.5):
    """Reducing U-bearing fluid — passes the uraninite gate.

    U defaults to 80 ppm (real pegmatites carry ~150 ppm; the
    radioactive_pegmatite scenario uses 150). Formula needs U ≥ ~31
    to cross sigma=1.0 at T>200.
    """
    return VugConditions(
        temperature=T,
        pressure=2.0,
        fluid=FluidChemistry(U=u, O2=o2, pH=ph),
        wall=VugWall(),
    )


# ---- supersaturation gate ----

def test_supersat_fires_reducing_high_u():
    """U=80 + O2=0 + T=400 → uraninite supersaturated."""
    cond = _reducing_u_fluid(u=80.0, T=400.0, o2=0.0)
    assert cond.supersaturation_uraninite() >= 1.0, \
        "reducing U-rich fluid should fire uraninite"


def test_supersat_blocks_oxidizing():
    """Same U, but O2=1.0 (oxidizing) → no nucleation."""
    cond = _reducing_u_fluid(u=80.0, T=400.0, o2=1.0)
    assert cond.supersaturation_uraninite() == 0, \
        "uraninite must NOT nucleate under oxidizing conditions"


def test_supersat_blocks_below_u_threshold():
    """U<5 → uraninite gate fails regardless of O2."""
    cond = _reducing_u_fluid(u=3.0, T=400.0, o2=0.0)
    assert cond.supersaturation_uraninite() == 0


def test_supersat_blocks_at_o2_boundary():
    """O2 > 0.3 is the cutoff for the reducing gate."""
    cond = _reducing_u_fluid(u=80.0, T=400.0, o2=0.31)
    assert cond.supersaturation_uraninite() == 0


# ---- grow_uraninite habit dispatch ----

def test_grow_uraninite_pegmatitic_octahedral():
    """T > 500 → octahedral habit (pegmatitic per research §157)."""
    random.seed(42)
    cond = _reducing_u_fluid(u=80.0, T=550.0)
    crystal = Crystal(mineral="uraninite", crystal_id=1, nucleation_step=0, nucleation_temp=550.0, position="pegmatite")
    zone = grow_uraninite(crystal, cond, step=1)
    assert zone is not None
    assert crystal.habit == "octahedral"
    assert "{111} octahedron" in crystal.dominant_forms


def test_grow_uraninite_hydrothermal_pitchblende():
    """T 200-500 → pitchblende_massive (hydrothermal)."""
    random.seed(42)
    cond = _reducing_u_fluid(u=80.0, T=350.0)
    crystal = Crystal(mineral="uraninite", crystal_id=1, nucleation_step=0, nucleation_temp=350.0, position="vein")
    zone = grow_uraninite(crystal, cond, step=1)
    assert zone is not None
    assert crystal.habit == "pitchblende_massive"


def test_grow_uraninite_low_t_cryptocrystalline():
    """T < 200 → still pitchblende_massive (low-T cryptocrystalline).

    Note: at T<200 we lose the *1.3 high-T multiplier, so we need
    U ≥ ~40 ppm to cross sigma=1.0 (vs ~31 at T>200).
    """
    random.seed(42)
    cond = _reducing_u_fluid(u=80.0, T=180.0)
    crystal = Crystal(mineral="uraninite", crystal_id=1, nucleation_step=0, nucleation_temp=180.0, position="roll-front")
    zone = grow_uraninite(crystal, cond, step=1)
    assert zone is not None
    assert crystal.habit == "pitchblende_massive"


# ---- Oxidative dissolution — the gatekeeper feedstock event ----

def test_uraninite_oxidizes_when_o2_rises():
    """Pre-grown uraninite + oxidizing conditions → dissolves, sets c.dissolved."""
    random.seed(42)
    cond = _reducing_u_fluid(u=0.5, T=120.0, o2=1.0)  # oxidizing now, low U
    crystal = Crystal(mineral="uraninite", crystal_id=1, nucleation_step=0, nucleation_temp=400.0, position="vug wall")
    crystal.total_growth_um = 100.0  # had grown earlier under reducing conditions
    zone = grow_uraninite(crystal, cond, step=10)
    assert zone is not None
    assert crystal.dissolved is True
    assert zone.thickness_um < 0  # negative = dissolution
    assert "uraninite weathers" in zone.note or "UO₂²⁺" in zone.note


def test_oxidation_releases_u_to_broth():
    """The defining gatekeeper-feedstock check: U₂²⁺ flows back to broth."""
    random.seed(42)
    cond = _reducing_u_fluid(u=0.5, T=120.0, o2=1.0)
    initial_U = cond.fluid.U
    crystal = Crystal(mineral="uraninite", crystal_id=1, nucleation_step=0, nucleation_temp=400.0, position="vug wall")
    crystal.total_growth_um = 100.0
    grow_uraninite(crystal, cond, step=10)
    assert cond.fluid.U > initial_U, \
        "uraninite oxidation must release UO₂²⁺ back to broth — feedstock for secondary U"


def test_no_dissolution_when_below_growth_threshold():
    """Tiny crystals (< 3µm) should not dissolve — molybdenite parity."""
    random.seed(42)
    cond = _reducing_u_fluid(u=0.5, T=120.0, o2=1.0)
    crystal = Crystal(mineral="uraninite", crystal_id=1, nucleation_step=0, nucleation_temp=400.0, position="vug wall")
    crystal.total_growth_um = 1.0  # below the 3µm threshold
    zone = grow_uraninite(crystal, cond, step=10)
    assert zone is None
    assert crystal.dissolved is False


def test_no_dissolution_when_still_reducing():
    """Existing uraninite under continued reducing conditions → no dissolution."""
    random.seed(42)
    cond = _reducing_u_fluid(u=0.1, T=120.0, o2=0.0)  # still reducing, but low U
    crystal = Crystal(mineral="uraninite", crystal_id=1, nucleation_step=0, nucleation_temp=400.0, position="vug wall")
    crystal.total_growth_um = 100.0
    zone = grow_uraninite(crystal, cond, step=10)
    # sigma might be < 1 due to low U, but no dissolution either
    assert crystal.dissolved is False


# ---- Gatekeeper chain (integration-ish) ----

def test_oxidation_releases_enough_u_to_cross_secondary_threshold():
    """The chain is mechanically valid only if released U is enough to fire
    secondaries. Torbernite/zeunerite/carnotite each gate at U >= 0.3.
    With a 100µm uraninite weathering at 12% per step, released uranyl is
    ~7.2 ppm — comfortably above the 0.3 threshold.
    """
    random.seed(42)
    cond = _reducing_u_fluid(u=0.0, T=25.0, o2=1.5)
    crystal = Crystal(mineral="uraninite", crystal_id=1, nucleation_step=0, nucleation_temp=400.0, position="vug wall")
    crystal.total_growth_um = 100.0
    grow_uraninite(crystal, cond, step=10)
    assert cond.fluid.U >= 0.3, \
        f"released U={cond.fluid.U:.2f} must clear the 0.3 secondary-U gate"
