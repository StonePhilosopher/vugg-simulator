"""Geometry — vug wall, ring/cell topo grid, dissolution + crystal paint.

PROPOSAL-MODULAR-REFACTOR Phase A4 home. Submodules:
  * wall.py   — VugWall + WallCell + WallState (Phase A4a, shipped)
  * crystal.py — Crystal dataclass (Phase A4b, later)

Re-exported from vugg/__init__.py so `from vugg import VugWall, WallCell,
WallState, Crystal` keeps working.
"""
