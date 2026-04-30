"""Round 9b regression — anion-competition mechanic.

The 3-branch generalization of 9a's broth-ratio gate. Three uranyl
minerals compete for the same U⁶⁺ cation, differentiated by which
anion dominates the local fluid:

  torbernite   Cu(UO₂)₂(PO₄)₂·12H₂O    P/(P+As) > 0.5   (9b)
  zeunerite    Cu(UO₂)₂(AsO₄)₂·xH₂O    As/(P+As) > 0.5  (9b)
  carnotite    K₂(UO₂)₂(VO₄)₂·3H₂O     V branch         (9c — deferred)

These tests exercise 9b's two branches via synthetic VugConditions
independent of any scenario, so the mechanic is verified even when
no shipped scenario has the U + Cu + (P or As) conjunction at
supergene T.

When a "Schneeberg-style oxidized U-pegmatite" scenario lands,
torbernite/zeunerite will nucleate naturally; until then this file
is the canonical proof the engines work.
"""

import pytest

from vugg import VugConditions, FluidChemistry, VugWall


def _u_supergene_fluid(cu=40, u=2.5, p=0.0, as_=0.0, ph=6.0, o2=1.5, T=25.0):
    """Construct a U-bearing supergene-T fluid with given P/As loading.

    Defaults pass every non-anion-fraction gate for both torbernite
    and zeunerite, so the only varying input is the anion ratio.
    Cu=40 + U=2.5 are mid-range supergene loadings (real Tsumeb-style
    fluids carry 50-100 ppm Cu; Schneeberg U-pegmatite supergene
    fluids carry 1-10 ppm U) — chosen to land sigma above the 1.0
    nucleation threshold without over-tuning.
    """
    return VugConditions(
        temperature=T,
        pressure=0.05,
        fluid=FluidChemistry(Cu=cu, U=u, P=p, As=as_, O2=o2, pH=ph),
        wall=VugWall(),
    )


# ---- P-dominant fluid ----

def test_p_dominant_fires_torbernite():
    cond = _u_supergene_fluid(p=8.0, as_=2.0)  # P/(P+As) = 0.8
    assert cond.supersaturation_torbernite() > 1.0, \
        "P/(P+As)=0.80 — torbernite should fire"


def test_p_dominant_blocks_zeunerite():
    cond = _u_supergene_fluid(p=8.0, as_=2.0)
    assert cond.supersaturation_zeunerite() == 0, \
        "P/(P+As)=0.80 — zeunerite should be ratio-blocked"


# ---- As-dominant fluid ----

def test_as_dominant_fires_zeunerite():
    cond = _u_supergene_fluid(p=2.0, as_=8.0)  # As/(P+As) = 0.8
    assert cond.supersaturation_zeunerite() > 1.0, \
        "As/(P+As)=0.80 — zeunerite should fire"


def test_as_dominant_blocks_torbernite():
    cond = _u_supergene_fluid(p=2.0, as_=8.0)
    assert cond.supersaturation_torbernite() == 0, \
        "As/(P+As)=0.80 — torbernite should be ratio-blocked"


# ---- Hard ingredient gates ----

def test_no_uranium_blocks_both():
    """U=0 fails the U>=0.3 gate — supergene Cu+P+As without U
    should not nucleate either uranyl mineral. This is the empirical
    state of the current supergene_oxidation scenario (Tsumeb), which
    is why 9b doesn't nucleate at seed-42 in any shipped scenario."""
    cond = _u_supergene_fluid(u=0.0, p=8.0, as_=2.0)
    assert cond.supersaturation_torbernite() == 0
    cond2 = _u_supergene_fluid(u=0.0, p=2.0, as_=8.0)
    assert cond2.supersaturation_zeunerite() == 0


def test_too_hot_blocks_both():
    """T=80°C is above the 50°C ceiling — would dehydrate to
    metatorbernite/metazeunerite, not the parent forms."""
    cond = _u_supergene_fluid(p=8.0, as_=2.0, T=80.0)
    assert cond.supersaturation_torbernite() == 0
    cond2 = _u_supergene_fluid(p=2.0, as_=8.0, T=80.0)
    assert cond2.supersaturation_zeunerite() == 0


def test_reducing_blocks_both():
    """Reducing fluid (low O₂) keeps U as insoluble U⁴⁺ (uraninite),
    blocking both uranyl minerals from forming."""
    cond = _u_supergene_fluid(p=8.0, as_=2.0, o2=0.3)
    assert cond.supersaturation_torbernite() == 0
    cond2 = _u_supergene_fluid(p=2.0, as_=8.0, o2=0.3)
    assert cond2.supersaturation_zeunerite() == 0


def test_acidic_blocks_both():
    """pH<5.0 puts the fluid in the acid-dissolution regime — these
    minerals dissolve, not nucleate."""
    cond = _u_supergene_fluid(p=8.0, as_=2.0, ph=4.0)
    assert cond.supersaturation_torbernite() == 0
    cond2 = _u_supergene_fluid(p=2.0, as_=8.0, ph=4.0)
    assert cond2.supersaturation_zeunerite() == 0


# ---- Boundary at 50/50 ----

def test_balanced_anions_neither_dominates():
    """At P==As, both species pass their >=0.5 fraction gate.
    Same boundary behavior as 9a's broth-ratio mechanic — the
    nucleation roll decides which species fires when chemistry
    is degenerate."""
    cond = _u_supergene_fluid(p=5.0, as_=5.0)
    assert cond.supersaturation_torbernite() > 0
    assert cond.supersaturation_zeunerite() > 0


# ---- Sweet-spot peak ----

def test_p_sweet_spot_boost():
    """P fraction in the 0.55-0.85 sweet spot gets a 1.3× boost.
    Beyond 0.95 the engine doesn't damp (unlike 9a's pure-Cu damp
    against malachite competition) — pure-P torbernite is fine
    territory; the only competition is with autunite (Ca-branch),
    which isn't yet implemented."""
    cond_peak = _u_supergene_fluid(p=7.0, as_=3.0)   # P_frac = 0.70 (in 0.55-0.85)
    cond_low = _u_supergene_fluid(p=5.5, as_=4.5)    # P_frac = 0.55 (boundary)
    sigma_peak = cond_peak.supersaturation_torbernite()
    sigma_low = cond_low.supersaturation_torbernite()
    assert sigma_peak >= sigma_low, \
        "P sweet-spot boost should produce sigma at least as strong"
