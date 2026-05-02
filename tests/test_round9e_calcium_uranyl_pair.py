"""Round 9e regression — tyuyamunite + uranospinite + cation forks on
zeunerite + carnotite.

Ships the two Ca-cation analogs that complete the autunite-group
cation+anion fork mechanic across all three anion branches:

  P-branch: torbernite (Cu) ↔ autunite (Ca)              — 9d
  As-branch: zeunerite (Cu) ↔ uranospinite (Ca)          — 9e
  V-branch: carnotite (K) ↔ tyuyamunite (Ca)             — 9e

Each pair preserves the anion fork P/(P+As+V) > 0.5 already in place
from Rounds 9b/9c. The Round 9e gates added are:

  zeunerite: Cu/(Cu+Ca) > 0.5
  carnotite: K/(K+Ca) > 0.5
  uranospinite (new): Ca/(Cu+Ca) > 0.5
  tyuyamunite (new): Ca/(K+Ca) > 0.5
"""

from vugg import VugConditions, FluidChemistry, VugWall


def _u_supergene_fluid(*, cu=0, ca=0, k=0, u=2.5, p=0.0, as_=0.0, v=0.0,
                       o2=1.5, ph=6.5, T=20.0):
    """U-bearing supergene fluid with explicit cation + anion loading."""
    return VugConditions(
        temperature=T,
        pressure=0.05,
        fluid=FluidChemistry(Cu=cu, Ca=ca, K=k, U=u, P=p, As=as_, V=v, O2=o2, pH=ph),
        wall=VugWall(),
    )


# ============================================================
# uranospinite — Ca-cation As-branch
# ============================================================

def test_ca_dominant_as_branch_fires_uranospinite():
    cond = _u_supergene_fluid(ca=80, as_=8)
    assert cond.supersaturation_uranospinite() > 1.0, \
        "Ca-dominant + As-anion-dominant — uranospinite should fire"


def test_cu_dominant_blocks_uranospinite():
    cond = _u_supergene_fluid(ca=5, cu=40, as_=8, T=25)
    assert cond.supersaturation_uranospinite() == 0, \
        "Cu-dominant fluid — zeunerite wins, uranospinite cation-blocked"


def test_uranospinite_blocks_zeunerite_when_ca_dominant():
    """The mirror direction — Ca-dominant fluid should also block zeunerite."""
    cond = _u_supergene_fluid(ca=80, as_=8)
    assert cond.supersaturation_zeunerite() == 0, \
        "Ca-dominant fluid — zeunerite cation-blocked by Round 9e gate"


def test_p_dominant_blocks_uranospinite_via_anion_fork():
    """Ca dominant cation, but P dominant anion → would form autunite.
    Uranospinite blocked because the As-anion fork fails."""
    cond = _u_supergene_fluid(ca=80, p=8, as_=2)
    assert cond.supersaturation_uranospinite() == 0


def test_v_dominant_blocks_uranospinite_via_anion_fork():
    cond = _u_supergene_fluid(ca=80, v=8, as_=2)
    assert cond.supersaturation_uranospinite() == 0


def test_no_uranium_blocks_uranospinite():
    cond = _u_supergene_fluid(ca=80, as_=8, u=0)
    assert cond.supersaturation_uranospinite() == 0


def test_low_arsenic_blocks_uranospinite():
    """As < 2.0 fails ingredient gate."""
    cond = _u_supergene_fluid(ca=80, as_=1.0)
    assert cond.supersaturation_uranospinite() == 0


def test_low_calcium_blocks_uranospinite():
    cond = _u_supergene_fluid(ca=10, as_=8)
    assert cond.supersaturation_uranospinite() == 0


def test_reducing_blocks_uranospinite():
    cond = _u_supergene_fluid(ca=80, as_=8, o2=0.3)
    assert cond.supersaturation_uranospinite() == 0


def test_acidic_blocks_uranospinite():
    cond = _u_supergene_fluid(ca=80, as_=8, ph=4.0)
    assert cond.supersaturation_uranospinite() == 0


def test_too_hot_blocks_uranospinite():
    cond = _u_supergene_fluid(ca=80, as_=8, T=80)
    assert cond.supersaturation_uranospinite() == 0


# ============================================================
# tyuyamunite — Ca-cation V-branch
# ============================================================

def test_ca_dominant_v_branch_fires_tyuyamunite():
    cond = _u_supergene_fluid(ca=80, v=8, T=25)
    assert cond.supersaturation_tyuyamunite() > 1.0, \
        "Ca-dominant + V-anion-dominant — tyuyamunite should fire"


def test_k_dominant_blocks_tyuyamunite():
    cond = _u_supergene_fluid(ca=5, k=30, v=8, T=30)
    assert cond.supersaturation_tyuyamunite() == 0, \
        "K-dominant fluid — carnotite wins, tyuyamunite cation-blocked"


def test_tyuyamunite_blocks_carnotite_when_ca_dominant():
    """The mirror direction — Ca-dominant fluid should also block carnotite."""
    cond = _u_supergene_fluid(ca=80, k=5, v=8, T=30)
    assert cond.supersaturation_carnotite() == 0, \
        "Ca-dominant fluid — carnotite cation-blocked by Round 9e gate"


def test_p_dominant_blocks_tyuyamunite_via_anion_fork():
    cond = _u_supergene_fluid(ca=80, p=8, v=2)
    assert cond.supersaturation_tyuyamunite() == 0


def test_as_dominant_blocks_tyuyamunite_via_anion_fork():
    cond = _u_supergene_fluid(ca=80, as_=8, v=2)
    assert cond.supersaturation_tyuyamunite() == 0


def test_no_uranium_blocks_tyuyamunite():
    cond = _u_supergene_fluid(ca=80, v=8, u=0)
    assert cond.supersaturation_tyuyamunite() == 0


def test_low_vanadium_blocks_tyuyamunite():
    cond = _u_supergene_fluid(ca=80, v=0.5)
    assert cond.supersaturation_tyuyamunite() == 0


def test_acidic_blocks_tyuyamunite():
    cond = _u_supergene_fluid(ca=80, v=8, ph=4.0)
    assert cond.supersaturation_tyuyamunite() == 0


# ============================================================
# Cation forks on existing zeunerite + carnotite
# ============================================================

def test_zeunerite_fires_cu_dominant_as_branch():
    """Zeunerite still works in mining-district context (low Ca)."""
    cond = _u_supergene_fluid(cu=40, ca=5, as_=8, T=25)
    assert cond.supersaturation_zeunerite() > 1.0


def test_zeunerite_blocks_when_ca_above_cu():
    """Schneeberg post-arsenopyrite-weathering context (Cu depleted,
    Ca + As rich) routes the As-branch to uranospinite. Ca=80 reflects
    the calcium-enriched groundwater after Cu has been consumed."""
    cond = _u_supergene_fluid(cu=5, ca=80, as_=8)
    assert cond.supersaturation_zeunerite() == 0
    assert cond.supersaturation_uranospinite() > 1.0


def test_carnotite_fires_k_dominant_v_branch():
    """Carnotite still works in evaporite/playa context (low Ca)."""
    cond = _u_supergene_fluid(k=30, ca=5, v=8, T=30)
    assert cond.supersaturation_carnotite() > 1.0


def test_carnotite_blocks_when_ca_above_k():
    """Realistic Colorado Plateau groundwater (Ca>>K) routes V-branch to tyuyamunite."""
    cond = _u_supergene_fluid(k=5, ca=50, v=8, T=30)
    assert cond.supersaturation_carnotite() == 0
    assert cond.supersaturation_tyuyamunite() > 1.0


# ============================================================
# Sanity: 9d autunite still passes (unchanged by 9e)
# ============================================================

def test_autunite_still_fires_unchanged_by_9e():
    """Sanity check that 9e didn't accidentally affect 9d autunite."""
    cond = _u_supergene_fluid(ca=80, p=8, as_=2)
    assert cond.supersaturation_autunite() > 1.0


# ============================================================
# Symmetry probe — every cation+anion combination routes correctly
# ============================================================

def test_full_six_corner_symmetry():
    """Final integration: with all six cation+anion combos prepared,
    each fluid routes to exactly one species (and blocks all five others).

    The 6 corners of the autunite-group cation+anion fork:
      Cu-P → torbernite       Ca-P → autunite
      Cu-As → zeunerite       Ca-As → uranospinite
      K-V → carnotite         Ca-V → tyuyamunite
    """
    cases = [
        # (cation_dict, anion_dict, expected_winner)
        ({"cu": 40, "ca": 5}, {"p": 8, "as_": 2}, "torbernite"),
        ({"cu": 5, "ca": 80}, {"p": 8, "as_": 2}, "autunite"),
        ({"cu": 40, "ca": 5}, {"as_": 8, "p": 2}, "zeunerite"),
        ({"cu": 5, "ca": 80}, {"as_": 8, "p": 2}, "uranospinite"),
        ({"k": 30, "ca": 5}, {"v": 8, "p": 0}, "carnotite"),
        ({"k": 5, "ca": 80}, {"v": 8, "p": 0}, "tyuyamunite"),
    ]
    species = ["torbernite", "autunite", "zeunerite", "uranospinite", "carnotite", "tyuyamunite"]

    for cations, anions, winner in cases:
        cond = _u_supergene_fluid(**cations, **anions, T=25)
        for sp in species:
            sigma = getattr(cond, f"supersaturation_{sp}")()
            if sp == winner:
                assert sigma > 1.0, \
                    f"cations={cations}, anions={anions} should fire {sp}, got σ={sigma:.2f}"
            else:
                assert sigma == 0, \
                    f"cations={cations}, anions={anions} should NOT fire {sp}, got σ={sigma:.2f} (winner: {winner})"
