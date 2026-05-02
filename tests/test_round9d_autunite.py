"""Round 9d regression — autunite + cation fork on the P-branch.

Adds the Ca-cation analog of torbernite. Where 9b shipped the anion
fork (P vs As) and 9c completed it (P vs As vs V), 9d adds the cation
fork on the P-branch (Cu vs Ca) — the geological default routing of
uranyl phosphate to autunite when groundwater Ca dominates.

Two species share a single chemistry stage:
  torbernite  Cu(UO₂)₂(PO₄)₂·12H₂O  Cu/(Cu+Ca) > 0.5  +  P-anion fork
  autunite    Ca(UO₂)₂(PO₄)₂·11H₂O  Ca/(Cu+Ca) > 0.5  +  P-anion fork

Pre-9d torbernite would fire whenever Cu>=5 and the P-anion fork passed,
even in Ca-saturated groundwater (geologically wrong: real torbernite is
rare). Post-9d the cation fork sends Ca-dominant fluids to autunite.

These tests verify both directions of the cation gate plus a no-Cu
end-member case where only autunite is mechanically possible.
"""

from vugg import VugConditions, FluidChemistry, VugWall


def _u_supergene_fluid(*, cu=0, ca=0, u=2.5, p=8.0, as_=2.0, v=0.0,
                       o2=1.5, ph=6.5, T=20.0):
    """U-bearing supergene fluid with explicit Cu/Ca/anion loading."""
    return VugConditions(
        temperature=T,
        pressure=0.05,
        fluid=FluidChemistry(Cu=cu, Ca=ca, U=u, P=p, As=as_, V=v, O2=o2, pH=ph),
        wall=VugWall(),
    )


# ---- Cation fork — Ca-dominant fires autunite ----

def test_ca_dominant_fires_autunite():
    cond = _u_supergene_fluid(cu=0, ca=80)
    assert cond.supersaturation_autunite() > 1.0, \
        "Ca/(Cu+Ca)=1.0 + P-anion-dominant — autunite should fire"


def test_ca_dominant_blocks_torbernite():
    cond = _u_supergene_fluid(cu=0, ca=80)
    assert cond.supersaturation_torbernite() == 0, \
        "Pure Ca fluid — torbernite cation-gate fails (no Cu)"


# ---- Cation fork — Cu-dominant fires torbernite, blocks autunite ----

def test_cu_dominant_fires_torbernite():
    cond = _u_supergene_fluid(cu=40, ca=5, T=25.0)
    assert cond.supersaturation_torbernite() > 1.0, \
        "Cu/(Cu+Ca)=0.89 — torbernite cation-gate passes"


def test_cu_dominant_blocks_autunite():
    cond = _u_supergene_fluid(cu=40, ca=5, T=25.0)
    assert cond.supersaturation_autunite() == 0, \
        "Cu-dominant fluid — autunite cation-blocked, torbernite gets the U"


# ---- Mixed Ca>Cu still autunite (the realistic groundwater case) ----

def test_mixed_ca_above_cu_fires_autunite():
    """Real groundwater: Ca ~50, Cu ~5 (Ca/(Cu+Ca) = 0.91). The 9d
    cation fork's whole point is that this case routes to autunite
    rather than firing torbernite as pre-9d would have."""
    cond = _u_supergene_fluid(cu=5, ca=50)
    assert cond.supersaturation_autunite() > 1.0, \
        "Realistic mixed Ca>>Cu — should fire autunite"
    assert cond.supersaturation_torbernite() == 0, \
        "Realistic mixed Ca>>Cu — torbernite cation-blocked"


# ---- Anion fork — As-dominant blocks autunite (uranospinite case) ----

def test_as_dominant_blocks_autunite_via_anion_fork():
    """Ca dominant cation, but As dominant anion → would form uranospinite
    (Ca-uranyl arsenate, not in game). Autunite blocked, falls through."""
    cond = _u_supergene_fluid(cu=0, ca=80, p=2.0, as_=8.0)
    assert cond.supersaturation_autunite() == 0


def test_v_dominant_blocks_autunite_via_anion_fork():
    """V dominant anion → carnotite branch (or tyuyamunite, the Ca-uranyl
    vanadate not yet in game). Autunite blocked."""
    cond = _u_supergene_fluid(cu=0, ca=80, p=2.0, as_=2.0, v=8.0)
    assert cond.supersaturation_autunite() == 0


# ---- Hard ingredient gates ----

def test_no_uranium_blocks_autunite():
    cond = _u_supergene_fluid(cu=0, ca=80, u=0)
    assert cond.supersaturation_autunite() == 0, \
        "U=0 fails U>=0.3 ingredient gate"


def test_no_phosphate_blocks_autunite():
    cond = _u_supergene_fluid(cu=0, ca=80, p=0, as_=0, v=0)
    assert cond.supersaturation_autunite() == 0, \
        "P=0 fails P>=1.0 ingredient gate (and anion_total=0 short-circuits)"


def test_low_calcium_blocks_autunite():
    """Ca>=15 floor — typical groundwater is ~50ppm Ca, but very fresh
    spring water can be lower. Below the floor, autunite doesn't form."""
    cond = _u_supergene_fluid(cu=0, ca=10)
    assert cond.supersaturation_autunite() == 0


def test_reducing_blocks_autunite():
    cond = _u_supergene_fluid(cu=0, ca=80, o2=0.3)
    assert cond.supersaturation_autunite() == 0, \
        "Reducing fluid keeps U as insoluble U⁴⁺ (uraninite); autunite needs U⁶⁺"


def test_acidic_blocks_autunite():
    cond = _u_supergene_fluid(cu=0, ca=80, ph=4.0)
    assert cond.supersaturation_autunite() == 0, \
        "pH=4.0 below 4.5 stability gate — autunite dissolves in acid"


def test_too_hot_blocks_autunite():
    cond = _u_supergene_fluid(cu=0, ca=80, T=80.0)
    assert cond.supersaturation_autunite() == 0, \
        "T=80°C above 50°C ceiling — autunite dehydrates above ~80°C to meta-autunite"


def test_too_cold_blocks_autunite():
    cond = _u_supergene_fluid(cu=0, ca=80, T=2.0)
    assert cond.supersaturation_autunite() == 0, \
        "T=2°C below 5°C floor — kinetics too slow for nucleation"


# ---- Sanity: 9c carnotite still passes (unchanged by 9d) ----

def test_v_dominant_still_fires_carnotite_unchanged():
    """Sanity check that the 9d cation fork on torbernite/autunite didn't
    break carnotite's V-branch. K + V + U should still fire.

    Note (Round 9e update, May 2026): carnotite now also has a K/(K+Ca)
    cation gate. We need Ca=5 explicit (low-Ca evaporite/playa context)
    to keep the test focused on the V-anion branch verification."""
    cond = VugConditions(
        temperature=30.0,
        pressure=0.05,
        fluid=FluidChemistry(K=30, Ca=5, U=2.5, V=8, P=0, As=0, O2=1.5, pH=6.5),
        wall=VugWall(),
    )
    assert cond.supersaturation_carnotite() > 1.0
