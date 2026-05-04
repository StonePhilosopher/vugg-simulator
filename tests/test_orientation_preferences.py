"""Phase D v2 (SIM_VERSION 23) — mineral-specific orientation preferences.

Verifies that minerals listed in `ORIENTATION_PREFERENCE` actually
nucleate on their preferred rings more often than spatially neutral
species. Statistical test: nucleate many crystals at fixed seed,
count how many landed on the preferred orientation, compare against
the area-weighted-only baseline.

Spatially neutral minerals are NOT tested here — that's the engine
default and is covered by the existing Phase D tests.
"""
import random


def _setup_sim(vugg, ring_count=16):
    cond, events, _ = vugg.SCENARIOS["porphyry"]()
    sim = vugg.VugSimulator(cond, events)
    # WallState's ring_count is set by the WallState ctor and ignores
    # conditions.wall.ring_count for engine state — overwrite directly
    # for the test. Re-init the rings array to match.
    if ring_count != sim.wall_state.ring_count:
        sim.wall_state.ring_count = ring_count
        sim.wall_state.rings = [list(sim.wall_state.rings[0])
                                 for _ in range(ring_count)]
    return sim


def _ring_orient_distribution(sim, mineral, n_samples=400):
    """Nucleate `n_samples` of `mineral` and return counts per
    orientation tag. Random seeded for reproducibility."""
    counts = {'floor': 0, 'wall': 0, 'ceiling': 0}
    for _ in range(n_samples):
        ringIdx = sim._assign_wall_ring("vug wall", mineral)
        orient = sim.wall_state.ring_orientation(ringIdx)
        counts[orient] += 1
    return counts


def test_selenite_strongly_prefers_floor(vugg):
    """Selenite has a 3.0× floor weight. With 16 rings, floor occupies
    rings 0..3 (4 of 16 = 25% of the rings). Pure area weighting (no
    bias) puts ~10% of nucleations on the floor (since rings 0..3 are
    near-pole and have low area). With 3.0× boost the floor share
    should rise substantially — to >25% at minimum."""
    random.seed(42)
    sim = _setup_sim(vugg)
    counts = _ring_orient_distribution(sim, 'selenite', n_samples=600)
    total = sum(counts.values())
    floor_frac = counts['floor'] / total
    # Without bias, floor ≈ 8-12%. With 3.0× selenite bias, expect ≥25%.
    assert floor_frac >= 0.25, (
        f"selenite floor fraction {floor_frac:.2%} is below 25% — "
        f"the 3.0× floor bias isn't biting. Counts: {counts}")


def test_galena_weakly_prefers_floor(vugg):
    """Galena has 1.5× floor bias. Floor share should be > the
    no-bias baseline but smaller than selenite's."""
    random.seed(42)
    sim = _setup_sim(vugg)
    galena_counts = _ring_orient_distribution(sim, 'galena', n_samples=600)
    random.seed(42)
    sim2 = _setup_sim(vugg)
    neutral_counts = _ring_orient_distribution(sim2, 'quartz', n_samples=600)
    g_floor = galena_counts['floor'] / sum(galena_counts.values())
    n_floor = neutral_counts['floor'] / sum(neutral_counts.values())
    assert g_floor > n_floor, (
        f"galena floor frac {g_floor:.2%} should exceed neutral "
        f"baseline {n_floor:.2%}. Counts: galena={galena_counts}, "
        f"neutral={neutral_counts}")


def test_hematite_prefers_ceiling(vugg):
    """Hematite has 1.5× ceiling bias (iron-rose rosettes)."""
    random.seed(42)
    sim = _setup_sim(vugg)
    counts = _ring_orient_distribution(sim, 'hematite', n_samples=600)
    random.seed(42)
    sim2 = _setup_sim(vugg)
    neutral = _ring_orient_distribution(sim2, 'quartz', n_samples=600)
    h_ceil = counts['ceiling'] / sum(counts.values())
    n_ceil = neutral['ceiling'] / sum(neutral.values())
    assert h_ceil > n_ceil, (
        f"hematite ceiling frac {h_ceil:.2%} should exceed neutral "
        f"baseline {n_ceil:.2%}. Counts: hematite={counts}, "
        f"neutral={neutral}")


def test_stibnite_prefers_wall(vugg):
    """Stibnite has 1.5× wall bias (acicular sprays perpendicular
    to lateral substrate)."""
    random.seed(42)
    sim = _setup_sim(vugg)
    counts = _ring_orient_distribution(sim, 'stibnite', n_samples=600)
    random.seed(42)
    sim2 = _setup_sim(vugg)
    neutral = _ring_orient_distribution(sim2, 'quartz', n_samples=600)
    s_wall = counts['wall'] / sum(counts.values())
    n_wall = neutral['wall'] / sum(neutral.values())
    assert s_wall > n_wall, (
        f"stibnite wall frac {s_wall:.2%} should exceed neutral "
        f"baseline {n_wall:.2%}. Counts: stibnite={counts}, "
        f"neutral={neutral}")


def test_neutral_mineral_unchanged(vugg):
    """Quartz isn't in ORIENTATION_PREFERENCE — its distribution
    should match pure area-weighted sampling. We just verify that
    no orientation gets a wildly disproportionate share."""
    random.seed(42)
    sim = _setup_sim(vugg)
    counts = _ring_orient_distribution(sim, 'quartz', n_samples=600)
    total = sum(counts.values())
    # Wall rings (4..11 in a 16-ring sim, 8 of 16) carry the bulk
    # of surface area — should dominate. Floor + ceiling are small.
    wall_frac = counts['wall'] / total
    assert wall_frac > 0.6, (
        f"quartz wall frac {wall_frac:.2%} should dominate (>60%) "
        f"under area-weighted-only sampling. Counts: {counts}")


def test_pseudomorph_inherits_host_ring_regardless_of_preference(vugg):
    """Even if a pseudomorph's mineral has a strong orientation bias,
    the host's ring wins — pseudomorphs paint over the host, so they
    must share the same wall location."""
    random.seed(42)
    sim = _setup_sim(vugg)
    # Manually construct a host crystal at a specific ring
    host = vugg.Crystal(mineral='quartz', crystal_id=1, nucleation_step=0,
                         nucleation_temp=300, position='vug wall')
    host.wall_ring_index = 14  # ceiling-area ring
    sim.crystals.append(host)
    # Now nucleate a "selenite" that overgrows on the host. Position
    # string includes "on quartz #1" → triggers host-inherit path.
    ringIdx = sim._assign_wall_ring("on quartz #1", "selenite")
    assert ringIdx == 14, (
        f"selenite-on-quartz pseudomorph should inherit host's ring "
        f"14 regardless of selenite's floor preference, got {ringIdx}")


def test_single_ring_sim_returns_zero_regardless_of_preference(vugg):
    """In a single-ring simulation (legacy / mobile mode), the only
    valid ring index is 0. Bias has nothing to bite on; should still
    consume one RNG value for parity."""
    random.seed(42)
    sim = _setup_sim(vugg, ring_count=1)
    for mineral in ['selenite', 'galena', 'hematite', 'stibnite', 'quartz']:
        ringIdx = sim._assign_wall_ring("vug wall", mineral)
        assert ringIdx == 0, f"{mineral} in 1-ring sim returned {ringIdx}"
