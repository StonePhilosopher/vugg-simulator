"""Chemistry submodule — fluid composition + supersaturation + thermometers.

PROPOSAL-MODULAR-REFACTOR Phase A. Submodules are added incrementally:
  - fluid.py — FluidChemistry dataclass (Phase A3, shipped)
  - conditions.py — VugConditions skeleton (later phase)
  - supersat/<class>.py — supersaturation methods grouped by mineral class

Each submodule is re-exported from vugg/__init__.py so the public import
surface (`from vugg import FluidChemistry`) stays flat.
"""
