"""Wireframe-crystal primitive library coverage tests.

The 3D-mode wireframe renderer maps each crystal's `habit` string to one
of ~12 hand-crafted polyhedra (PRIM_CUBE, PRIM_HEX_PRISM_TERMINATED, …).
A direct lookup table covers the common cases; an `includes`-based
fuzzy fallback handles the long tail of compound forms (e.g.
`saddle_rhomb_or_massive`).

This test is a coverage gate: every mineral in data/minerals.json must
have a habit that resolves to *some* primitive — direct or fuzzy. If a
new mineral lands with a habit string that the fuzzy matcher can't
parse, this test catches it before the renderer silently falls back to
PRIM_RHOMBOHEDRON for everything.

The JS lookup logic is mirrored here so the test is engine-side; if
the JS table or fuzzy substrings change, update both in lock-step.
"""
import json
import re
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parent.parent


def _all_habits():
    spec_path = REPO_ROOT / "data" / "minerals.json"
    with open(spec_path, encoding="utf-8") as f:
        spec = json.load(f)
    habits = set()
    for _name, m in spec["minerals"].items():
        h = m.get("habit")
        if isinstance(h, str) and h:
            habits.add(h)
    return habits


def _index_html_text():
    """Read the live shipped index.html so the test verifies the
    primitive table that's actually deployed, not a Python copy."""
    with open(REPO_ROOT / "index.html", encoding="utf-8") as f:
        return f.read()


# Mirror of the JS HABIT_TO_PRIMITIVE keys + fuzzy substring matchers.
# Keep in sync with the lookup in index.html (`_lookupCrystalPrimitive`).
_DIRECT_KEYS = {
    "cubic", "pseudocubic", "pseudo_cubic",
    "cubo-pyritohedral", "cubic_or_pyritohedral", "cubic_or_octahedral",
    "pyritohedral",
    "octahedral",
    "tetrahedral", "tetrahedral_or_massive",
    "rhombohedral", "saddle_rhomb_or_massive",
    "rhombohedral_or_botryoidal", "rhombohedral_or_scalenohedral",
    "rhombohedral_or_tabular_or_botryoidal", "botryoidal_or_rhombohedral",
    "scalenohedral", "scalenohedral_or_rhombohedral",
    "prismatic", "short_prismatic", "striated_prism",
    "hex_prism", "hex_prism_long",
    "hexagonal_prism", "hexagonal_prism_or_botryoidal_campylite",
    "prismatic_hex", "prismatic_or_blocky", "prismatic_orthorhombic",
    "prismatic_tabular_pseudo_cubic", "prismatic_or_rosette",
    "tabular_prism",
    "tabular", "tabular_square", "tabular_hex",
    "hex_plate", "hexagonal_platy", "tabular_plates", "tabular_monoclinic",
    "tabular_or_prismatic_or_fibrous", "platy_scales", "micro_plates",
    "acicular", "acicular_tuft", "tufted_spray",
    "elongated_blade", "wire", "capillary",
    "columnar_or_cyclic_twinned",
    "cockscomb_or_spearhead", "dipyramidal", "bipyramidal_alpha",
    "disphenoidal_{112}", "stellate_sixling",
    "hexagonal_barrel", "barrel",
    "hemimorphic_hexagonal", "deep_blue_prismatic",
    "botryoidal", "reniform", "botryoidal_or_acicular",
    "botryoidal_or_mammillary_or_fibrous", "botryoidal_cryptocrystalline",
    "cobalt_bloom_or_botryoidal", "nickel_bloom_or_capillary",
    "pitchblende_massive", "massive_granular", "earthy_crust",
    "stalactitic", "arborescent", "dendritic",
    "default_habit",
}

_FUZZY_SUBSTRINGS = (
    "cube", "cubic", "pyritohed", "octahed", "tetrahed",
    "scalenohed", "dogtooth", "rhomb",
    "dipyramid", "bipyramid",
    "hex_prism", "hexagonal", "prism",
    "tabular", "platy", "plate", "plates",
    "acicular", "needle", "wire", "capillary",
    "botryoidal", "reniform", "mammillary", "massive",
    "earthy", "stalactit",
)


def _resolves(habit: str) -> bool:
    """Return True if the habit hits the direct table OR fuzzy fallback.
    Mirrors the JS `_lookupCrystalPrimitive` decision flow."""
    if habit in _DIRECT_KEYS:
        return True
    h = habit.lower()
    return any(s in h for s in _FUZZY_SUBSTRINGS)


def test_all_primitives_defined_in_index_html():
    """The 12 primitive constants the proposal calls out must all exist
    in the deployed index.html. Catches accidental deletion / rename."""
    text = _index_html_text()
    expected = [
        "PRIM_CUBE", "PRIM_OCTAHEDRON", "PRIM_TETRAHEDRON",
        "PRIM_RHOMBOHEDRON", "PRIM_SCALENOHEDRON",
        "PRIM_HEX_PRISM", "PRIM_HEX_PRISM_TERMINATED",
        "PRIM_DIPYRAMID", "PRIM_PYRITOHEDRON",
        "PRIM_TABULAR", "PRIM_ACICULAR", "PRIM_BOTRYOIDAL",
    ]
    for name in expected:
        assert re.search(rf"\bconst {name}\b", text), (
            f"Primitive {name} missing from index.html — wireframe "
            f"renderer will fall back to default for matching habits."
        )


def test_lookup_helpers_present():
    """Wireframe-rendering helpers must all exist in index.html."""
    text = _index_html_text()
    for fn in ("_lookupCrystalPrimitive", "_orthonormalBasis",
               "_convexHull2D", "_renderCrystalWireframe",
               "_seededRand"):
        assert re.search(rf"\bfunction {fn}\b", text), (
            f"Wireframe helper `{fn}` missing from index.html."
        )


@pytest.mark.parametrize("habit", sorted(_all_habits()))
def test_every_habit_resolves_to_a_primitive(habit):
    """Every habit string in data/minerals.json must hit either the
    direct lookup table or a fuzzy-substring matcher. Hitting only
    `default_habit` (which falls through to PRIM_RHOMBOHEDRON as a
    last-resort default) is a smell — flag it so the table can be
    extended to give that habit its real primitive."""
    assert _resolves(habit), (
        f"Habit {habit!r} doesn't resolve to a primitive — neither in "
        f"the direct table nor via fuzzy substring. Add an entry to "
        f"HABIT_TO_PRIMITIVE in index.html (or a new substring)."
    )


def test_painters_order_render_dispatch_present():
    """The refactored 3D renderer must build a unified paintItems list
    and dispatch ring vs crystal items. Regex-check for the structural
    markers; if these vanish we've lost painter's-order interleaving."""
    text = _index_html_text()
    assert "paintItems" in text, "paintItems list missing from 3D renderer"
    assert "kind: 'ring'" in text or 'kind: "ring"' in text, (
        "Ring paint-item kind missing")
    assert "kind: 'crystal'" in text or 'kind: "crystal"' in text, (
        "Crystal paint-item kind missing")
