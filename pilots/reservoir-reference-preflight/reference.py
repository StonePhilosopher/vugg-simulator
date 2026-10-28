"""Independent Decimal check of the dimensional preflight, not a density/EOS.

Uses the observed absolute cavity capacity plus existing authored calibration
constants; does not replay JS derived results as expected values. Geometry and
the geological validity of legacy inputs are not independently established.
"""
import json
from decimal import Decimal, localcontext
from pathlib import Path

root = Path(__file__).resolve().parent
receipt = json.loads((root / "receipt.json").read_text(encoding="utf-8"))
record = receipt["record"]
observation = record["observation"]

with localcontext() as ctx:
    ctx.prec = 60
    d = lambda value: Decimal(str(value))
    epsilon = Decimal(2) ** -52
    # Read the stimulus, capacity, achieved volume and tolerance as observations;
    # independently apply the existing calibration and dimensional equations.
    rate = d(observation["stimulus"]["acceptedRateMm"])
    extent = rate * Decimal(15) / Decimal("40.078")
    target = extent * Decimal("36.934")
    remaining = Decimal(500) * Decimal(15) / Decimal("40.078") / 1000
    capacity = d(observation["volumeMm3"])
    computed = {
        "formulaExtentMmolKgReference": extent,
        "targetMm3PerKgReference": target,
        "calciumMgKgReference": extent * Decimal("40.078"),
        "carbonAsCO3MgKgReference": extent * Decimal("60.009"),
        "nominalTargetEquivalentSolventKg": Decimal(1),
        "requiredSolventKgPerM3OfWholeCavity": 1 / (capacity * Decimal("1e-9")),
        "remainingCalciteMolPerKgReference": remaining,
        "remainingCalciteReferenceVolumeMm3PerKg": remaining * Decimal(1000) * Decimal("36.934"),
        "achievedEquivalentSolventKg": d(observation["geometryPlan"]["achievedNumericMm3"]) / target,
    }
    observed = {
        **observation["stimulus"], **observation["geometryPlan"], **record,
    }
    for key, expected in computed.items():
        actual = d(observed[key])
        assert abs(expected - actual) <= 64 * epsilon * abs(expected), (key, actual, expected)
    # This quotient is not evidence that any physical fluid has this density.
    assert record["localAllocation"]["waterKg"] is None
    assert receipt["productionMappingAllowed"] is False
    assert receipt["reactions"] is False and receipt["transport"] is False
    print(json.dumps({"method": "Python Decimal precision 60; independent reference-calibration arithmetic",
                      "observedGeometryAuthority": "same JS scientific cavity capacity; not independently remeshed",
                      "checked": len(computed), "values": {k: str(v) for k, v in computed.items()},
                      "productionMappingAllowed": False}, indent=2))
