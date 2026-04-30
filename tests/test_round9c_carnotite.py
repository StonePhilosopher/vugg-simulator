"""Round 9c regression — carnotite + completion of the 3-way anion-competition trio.

Carnotite is the V-branch (K-cation) of the autunite-group trio:

  torbernite   Cu(UO₂)₂(PO₄)₂·12H₂O    P/(P+As+V) > 0.5   (9b)
  zeunerite    Cu(UO₂)₂(AsO₄)₂·xH₂O    As/(P+As+V) > 0.5  (9b)
  carnotite    K₂(UO₂)₂(VO₄)₂·3H₂O     V/(P+As+V) > 0.5   (9c — this file)

This file is the temporary bridge per TASK-BRIEF-DATA-AS-TRUTH.md item 6:
the test cases mirror what's declared in `data/minerals.json:carnotite.test_cases`
and will be exercised by the generic test runner once that ships. Until
then this per-round file runs the same logic.

Plus extra cases for the **9c denominator widening** affecting torbernite
and zeunerite — V-rich fluid should now route to carnotite, not fall
through to torbernite by default.
"""

import pytest

from vugg import VugConditions, FluidChemistry, VugWall


def _carnotite_fluid(k=30, u=2.5, v=0.0, p=0.0, as_=0.0, ph=6.5, o2=1.5, T=30.0):
    """Construct a carnotite-candidate supergene fluid.

    Defaults pass every non-anion-fraction gate, so the only varying input
    is the anion ratio. K=30 + U=2.5 are realistic Schneeberg-style oxidized
    U-pegmatite + Colorado Plateau roll-front loadings.
    """
    return VugConditions(
        temperature=T,
        pressure=0.05,
        fluid=FluidChemistry(K=k, U=u, V=v, P=p, As=as_, O2=o2, pH=ph),
        wall=VugWall(),
    )


# ---- Carnotite branch fires ----

def test_v_dominant_fires_carnotite():
    cond = _carnotite_fluid(v=8.0, p=2.0, as_=0.0)  # V/(P+As+V) = 0.80
    assert cond.supersaturation_carnotite() > 1.0, \
        "V/(P+As+V)=0.80 — carnotite should fire"


def test_p_dominant_blocks_carnotite():
    cond = _carnotite_fluid(v=2.0, p=8.0, as_=0.0)
    assert cond.supersaturation_carnotite() == 0, \
        "P-dominant fluid — torbernite wins, carnotite ratio-blocked"


def test_as_dominant_blocks_carnotite():
    cond = _carnotite_fluid(v=2.0, p=0.0, as_=8.0)
    assert cond.supersaturation_carnotite() == 0, \
        "As-dominant fluid — zeunerite wins, carnotite ratio-blocked"


# ---- Hard ingredient gates ----

def test_no_potassium_blocks_carnotite():
    cond = _carnotite_fluid(k=0, v=8.0)
    assert cond.supersaturation_carnotite() == 0, \
        "K=0 fails K>=5 ingredient gate"


def test_no_uranium_blocks_carnotite():
    cond = _carnotite_fluid(u=0, v=8.0)
    assert cond.supersaturation_carnotite() == 0, \
        "U=0 fails U>=0.3 ingredient gate"


def test_no_vanadium_blocks_carnotite():
    cond = _carnotite_fluid(v=0)
    assert cond.supersaturation_carnotite() == 0, \
        "V=0 fails V>=1.0 ingredient gate"


def test_reducing_blocks_carnotite():
    cond = _carnotite_fluid(v=8.0, o2=0.3)
    assert cond.supersaturation_carnotite() == 0, \
        "Reducing fluid keeps U as U⁴⁺; carnotite needs U⁶⁺"


def test_too_hot_blocks_carnotite():
    cond = _carnotite_fluid(v=8.0, T=80.0)
    assert cond.supersaturation_carnotite() == 0, \
        "T=80°C above 50°C ceiling"


def test_acidic_blocks_carnotite():
    cond = _carnotite_fluid(v=8.0, ph=4.0)
    assert cond.supersaturation_carnotite() == 0, \
        "pH=4.0 below 5.0 stability gate"


# ---- The 9c widening: V-rich fluid blocks torbernite + zeunerite ----

def test_v_dominant_blocks_torbernite():
    """Pre-9c, torbernite gate was P/(P+As) > 0.5 — V was invisible.
    Post-9c, denominator includes V so V-rich fluid routes to carnotite.

    Construct fluid with all of Cu, U, P, V populated where V dominates
    P+As. Torbernite must NOT fire.
    """
    cond = VugConditions(
        temperature=25,
        pressure=0.05,
        fluid=FluidChemistry(Cu=40, U=2.5, P=2, As=0, V=8, O2=1.5, pH=6.0),
        wall=VugWall(),
    )
    assert cond.supersaturation_torbernite() == 0, \
        "V-dominant fluid — torbernite ratio-blocked by 3-way denominator"


def test_v_dominant_blocks_zeunerite():
    """Same shape for zeunerite — V-rich fluid should not fire zeunerite."""
    cond = VugConditions(
        temperature=25,
        pressure=0.05,
        fluid=FluidChemistry(Cu=40, U=2.5, P=0, As=2, V=8, O2=1.5, pH=6.0),
        wall=VugWall(),
    )
    assert cond.supersaturation_zeunerite() == 0, \
        "V-dominant fluid — zeunerite ratio-blocked by 3-way denominator"


# ---- 3-way coexistence: each branch wins its dominant fluid, others block ----

def test_three_way_competition_p_branch():
    """P-dominant fluid: torbernite fires, zeunerite + carnotite block."""
    cond = VugConditions(
        temperature=25,
        pressure=0.05,
        # Cu+K both populated so the cation gates pass for whichever branch
        fluid=FluidChemistry(Cu=40, K=30, U=2.5, P=8, As=2, V=2, O2=1.5, pH=6.0),
        wall=VugWall(),
    )
    assert cond.supersaturation_torbernite() > 1.0, "P-dominant should fire torbernite"
    assert cond.supersaturation_zeunerite() == 0, "P-dominant should block zeunerite"
    assert cond.supersaturation_carnotite() == 0, "P-dominant should block carnotite"


def test_three_way_competition_as_branch():
    cond = VugConditions(
        temperature=25,
        pressure=0.05,
        fluid=FluidChemistry(Cu=40, K=30, U=2.5, P=2, As=8, V=2, O2=1.5, pH=6.0),
        wall=VugWall(),
    )
    assert cond.supersaturation_zeunerite() > 1.0, "As-dominant should fire zeunerite"
    assert cond.supersaturation_torbernite() == 0, "As-dominant should block torbernite"
    assert cond.supersaturation_carnotite() == 0, "As-dominant should block carnotite"


def test_three_way_competition_v_branch():
    cond = VugConditions(
        temperature=30,
        pressure=0.05,
        fluid=FluidChemistry(Cu=40, K=30, U=2.5, P=2, As=2, V=8, O2=1.5, pH=6.5),
        wall=VugWall(),
    )
    assert cond.supersaturation_carnotite() > 1.0, "V-dominant should fire carnotite"
    assert cond.supersaturation_torbernite() == 0, "V-dominant should block torbernite"
    assert cond.supersaturation_zeunerite() == 0, "V-dominant should block zeunerite"
