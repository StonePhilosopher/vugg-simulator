"""Round 9a regression — broth-ratio branching mechanic.

The first mineral pair where the *ratio* of fluid elements (not
presence/absence) gates nucleation: rosasite forms only when
Cu/(Cu+Zn) > 0.5; aurichalcite forms only when Zn/(Cu+Zn) > 0.5.
Same parent broth, opposite outcome based on ratio.

These tests exercise the mechanic via synthetic VugConditions
independent of any scenario, so the gate logic is verified even
when no shipped scenario has Cu-dominant supergene fluid.
"""

import pytest

from vugg import VugConditions, FluidChemistry, VugWall


def _supergene_fluid(cu, zn, ph=6.9, co3=80, o2=1.5, T=25.0):
    """Construct a supergene-T fluid with a given Cu/Zn ratio.

    Defaults pass every non-ratio gate for both rosasite and
    aurichalcite, so the only varying input is the ratio.
    """
    return VugConditions(
        temperature=T,
        pressure=0.05,
        fluid=FluidChemistry(Cu=cu, Zn=zn, CO3=co3, O2=o2, pH=ph),
        wall=VugWall(),
    )


# ---- Cu-dominant fluid ----

def test_cu_dominant_fires_rosasite():
    cond = _supergene_fluid(cu=80, zn=20)
    assert cond.supersaturation_rosasite() > 1.0, \
        "Cu/(Cu+Zn)=0.80 — rosasite should fire"


def test_cu_dominant_blocks_aurichalcite():
    cond = _supergene_fluid(cu=80, zn=20)
    assert cond.supersaturation_aurichalcite() == 0, \
        "Cu/(Cu+Zn)=0.80 — aurichalcite should be ratio-blocked"


# ---- Zn-dominant fluid ----

def test_zn_dominant_fires_aurichalcite():
    cond = _supergene_fluid(cu=20, zn=80)
    assert cond.supersaturation_aurichalcite() > 1.0, \
        "Zn/(Cu+Zn)=0.80 — aurichalcite should fire"


def test_zn_dominant_blocks_rosasite():
    cond = _supergene_fluid(cu=20, zn=80)
    assert cond.supersaturation_rosasite() == 0, \
        "Zn/(Cu+Zn)=0.80 — rosasite should be ratio-blocked"


# ---- Boundary at 50/50 ----

def test_balanced_ratio_neither_dominates():
    """At exactly 50/50, the >=0.5 gate barely passes for the species
    matching whichever side gets the >= comparison. Both rosasite and
    aurichalcite use >= 0.5 vs the dominant fraction; with Cu==Zn the
    cu_fraction is exactly 0.5, so rosasite passes its gate and
    aurichalcite passes its gate. Both should produce non-zero σ.
    The ratio mechanic doesn't promise one dominant winner — at 50/50
    both species can nucleate; the species race is left to the
    nucleation-roll Bernoulli, not the supersaturation function.
    """
    cond = _supergene_fluid(cu=50, zn=50)
    sigma_ros = cond.supersaturation_rosasite()
    sigma_aur = cond.supersaturation_aurichalcite()
    assert sigma_ros > 0, "50/50 — rosasite gate should pass at the boundary"
    assert sigma_aur > 0, "50/50 — aurichalcite gate should pass at the boundary"


# ---- Hard ingredient gates still apply ----

def test_no_zn_blocks_both():
    """Zn=0 fails rosasite's required Zn>=3 gate (rosasite formula
    has Zn) and aurichalcite's Zn>=5 gate. Pure-Cu fluid is malachite
    territory, not rosasite-aurichalcite."""
    cond = _supergene_fluid(cu=80, zn=0)
    assert cond.supersaturation_rosasite() == 0
    assert cond.supersaturation_aurichalcite() == 0


def test_too_hot_blocks_both():
    """T=80°C is above the 10-40°C supergene window."""
    cond = _supergene_fluid(cu=80, zn=20, T=80.0)
    assert cond.supersaturation_rosasite() == 0
    cond2 = _supergene_fluid(cu=20, zn=80, T=80.0)
    assert cond2.supersaturation_aurichalcite() == 0


def test_acidic_blocks_both():
    """Acid dissolves carbonates — both gates require near-neutral pH."""
    cond_ros = _supergene_fluid(cu=80, zn=20, ph=5.0)
    assert cond_ros.supersaturation_rosasite() == 0
    cond_aur = _supergene_fluid(cu=20, zn=80, ph=5.0)
    assert cond_aur.supersaturation_aurichalcite() == 0


# ---- Sweet-spot peak ----

def test_cu_sweet_spot_boost():
    """Cu fraction in the 0.55-0.85 sweet spot gets a 1.3× boost."""
    cond_peak = _supergene_fluid(cu=70, zn=30)  # Cu_frac = 0.70
    cond_extreme = _supergene_fluid(cu=190, zn=10)  # Cu_frac = 0.95+ → 0.5× damp
    sigma_peak = cond_peak.supersaturation_rosasite()
    sigma_extreme = cond_extreme.supersaturation_rosasite()
    assert sigma_peak > sigma_extreme, \
        "Cu sweet-spot (0.55-0.85) should beat extreme Cu (>0.95) by the boost+damp"
