"""Supersaturation mixins, grouped by mineral class.

Each module in this package declares one mixin (e.g. CarbonatesSupersatMixin)
that contributes its mineral class's supersaturation_<name>(self) methods
to VugConditions via inheritance. See vugg/chemistry/conditions.py for the
class declaration that pulls them in.
"""
