"""Shared pytest fixtures for vugg-simulator tests.

Loads vugg.py, data/minerals.json, and data/locality_chemistry.json once per
session so tests can import them efficiently. All fixtures are session-scoped
where data is read-only.

Conventions:
- All test modules can use these fixtures by including them as parameters.
- Tests should NOT mutate fixture-returned objects unless they explicitly
  copy first (these are session-scoped — mutation leaks across tests).
- For per-mineral parameterization, use the `all_minerals` fixture and
  `pytest.mark.parametrize`.
"""
import json
import sys
from pathlib import Path

import pytest


# Repo root — one level up from tests/
REPO_ROOT = Path(__file__).resolve().parent.parent

# Add repo root to sys.path so `import vugg` works from tests
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


@pytest.fixture(scope="session")
def repo_root():
    """Absolute path to the repo root."""
    return REPO_ROOT


@pytest.fixture(scope="session")
def vugg():
    """The vugg.py module, imported once per session.

    Tests can use this for FluidChemistry, VugConditions, MINERAL_ENGINES,
    scenario_*, etc.
    """
    import vugg as vugg_mod
    return vugg_mod


@pytest.fixture(scope="session")
def minerals_spec(repo_root):
    """The full data/minerals.json content. Read-only — do not mutate."""
    with open(repo_root / "data" / "minerals.json", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="session")
def all_minerals(minerals_spec):
    """List of (mineral_name, mineral_dict) pairs for parameterized tests.

    Use as:
        @pytest.mark.parametrize("name,spec", all_mineral_pairs(),
                                  ids=lambda x: x if isinstance(x, str) else "")
        def test_something(name, spec): ...

    or via the `all_minerals` fixture for non-parameterized iteration.
    """
    return list(minerals_spec["minerals"].items())


@pytest.fixture(scope="session")
def localities_spec(repo_root):
    """The full data/locality_chemistry.json content. Read-only."""
    with open(repo_root / "data" / "locality_chemistry.json", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="session")
def web_index_html(repo_root):
    """Raw text of web/index.html. Use for regex-based mirror checks."""
    with open(repo_root / "web" / "index.html", encoding="utf-8") as f:
        return f.read()


@pytest.fixture(scope="session")
def docs_index_html(repo_root):
    """Raw text of docs/index.html (the GitHub Pages mirror of web/)."""
    with open(repo_root / "docs" / "index.html", encoding="utf-8") as f:
        return f.read()


# ---------------------------------------------------------------------------
# Helpers for parameterized tests
# ---------------------------------------------------------------------------

def all_mineral_pairs():
    """Module-level helper for collection-time parametrization.

    pytest's @parametrize runs at COLLECTION time, before fixtures resolve —
    so it can't depend on the all_minerals fixture. This helper reads the
    spec directly so parametrize can use it.

    Returns:
        list of (name, spec_dict) tuples for every mineral.
    """
    spec_path = REPO_ROOT / "data" / "minerals.json"
    with open(spec_path, encoding="utf-8") as f:
        spec = json.load(f)
    return list(spec["minerals"].items())


def mineral_names():
    """Just the names — useful when you only need the key, not the spec."""
    return [name for name, _ in all_mineral_pairs()]
