"""Independent Decimal arithmetic for shared host/fluid history, not MVT physics.

Reads causal inputs, not JS-derived numbers as expected values. This witness
does not validate a natural fluid EOS, wetting, speciation or a sealing law.
"""
import json
from decimal import Decimal, localcontext
from pathlib import Path

root = Path(__file__).resolve().parent
receipt = json.loads((root / "receipt.json").read_text(encoding="utf-8"), parse_float=Decimal)
reference = json.loads((root.parent / "physical-reservoir-mapping" / "source-evidence.json").read_text(encoding="utf-8"))
causes = receipt["causes"]
case_input = causes["input"]

with localcontext() as ctx:
    ctx.prec = 60
    d = lambda x: x if isinstance(x, Decimal) else Decimal(x)
    eps = Decimal(2) ** -52
    vm = Decimal(reference["calcite"]["molarVolumeCm3Mol"]) * 1000
    checked = 0

    def check(actual, expected, scale=None):
        global checked
        expected, actual = d(expected), d(actual)
        tolerance = 128 * eps * (abs(expected) if scale is None else d(scale))
        assert abs(actual - expected) <= tolerance, (actual, expected, tolerance)
        checked += 1

    axes = [case_input["host"]["axesMm"][k] for k in ("x", "y", "z")]
    dims = [len(a) - 1 for a in axes]
    volumes, scales = [], []
    phases, initial = case_input["host"]["phases"], dict.fromkeys(("calcite", "dolomite", "quartz"), Decimal(0))
    for i, phase in enumerate(phases):
        xyz = [i // (dims[1] * dims[2]), (i // dims[2]) % dims[1], i % dims[2]]
        lengths = [d(axis[coord + 1]) - d(axis[coord]) for axis, coord in zip(axes, xyz)]
        v = lengths[0] * lengths[1] * lengths[2]
        scale = sum((abs(d(axes[k][xyz[k] + 1])) + abs(d(axes[k][xyz[k]])))
                    * lengths[(k + 1) % 3] * lengths[(k + 2) % 3] for k in range(3))
        volumes.append(v)
        scales.append(scale)
        initial[phase] += v

    donors = {r["id"]: r for r in case_input["reservoirs"]}
    components = dict.fromkeys(next(iter(donors.values()))["molality"], Decimal(0))
    admitted = dict.fromkeys(donors, Decimal(0))
    water = wet = void = Decimal(0)
    exported = dict.fromkeys(initial, Decimal(0))
    for e in causes["sharedEvents"]:
        if e["type"] == "export_breccia":
            for i in e["parcelIds"]:
                void += volumes[i]
                exported[phases[i]] += volumes[i]
        elif e["type"] == "admit_fluid":
            r = donors[e["reservoirId"]]
            v = d(e["volume"]["value"])
            w = v * d(r["solventMassPerVolume"]["value"])
            wet += v
            water += w
            admitted[r["id"]] += v
            for key, q in r["molality"].items():
                components[key] += w * d(q["value"])

    # Coordinate subtraction is checked at the coordinate scale, not the tiny
    # removed-parcel scale. This is binary roundoff, not physical uncertainty.
    coordinate_volume_scale = sum(scales)
    for name in ("connected", "sealed"):
        case = receipt["cases"][name]
        check(case["pore"]["geometricVoidVolumeMm3"], void, coordinate_volume_scale)
        check(case["pore"]["wetVolumeMm3"], wet)
        check(case["pore"]["waterKg"], water)
        for phase in initial:
            check(case["host"]["initialPhaseVolumesMm3"][phase], initial[phase], coordinate_volume_scale)
            check(case["host"]["remainingPhaseVolumesMm3"][phase], initial[phase] - exported[phase], coordinate_volume_scale)
            check(case["host"]["exportedPhaseVolumesMm3"][phase], exported[phase], coordinate_volume_scale)
        for key, value in components.items():
            check(case["pore"]["components"][key], value)
        for rid, r in donors.items():
            remaining = d(r["volume"]["value"]) - admitted[rid]
            check(case["externalReservoirs"][rid]["remainingVolumeMm3"], remaining)
            check(case["externalReservoirs"][rid]["remainingWaterKg"], remaining * d(r["solventMassPerVolume"]["value"]))

    i = causes["prescribedTransfer"]["parcelId"]
    assert phases[i] == "calcite"
    removed = volumes[i] / vm
    reacted = receipt["cases"]["sealedTransfer"]
    check(reacted["host"]["dissolvedCalciteMol"], removed, scales[i] / vm)
    check(reacted["pore"]["geometricVoidVolumeMm3"], void + volumes[i], coordinate_volume_scale)
    check(reacted["pore"]["waterKg"], water)
    for key, value in components.items():
        coefficient = 1 if key in ("calciumMol", "dicMolC") else 2 if key == "alkalinityEq" else 0
        check(reacted["pore"]["components"][key], value + coefficient * removed,
              abs(value) + coefficient * scales[i] / vm)
    for phase in initial:
        expected = initial[phase] - exported[phase] - (volumes[i] if phase == "calcite" else 0)
        check(reacted["host"]["remainingPhaseVolumesMm3"][phase], expected, coordinate_volume_scale)
    assert reacted["pore"]["wetVolumeMm3"] is None

    pulse = causes["pulse"]
    donor = donors[pulse["reservoirId"]]
    pulse_water = d(pulse["volume"]["value"]) * d(donor["solventMassPerVolume"]["value"])
    for name in ("connectedPulse", "reopenedPulse"):
        case = receipt["cases"][name]
        check(case["pore"]["waterKg"], water + pulse_water)
        check(case["pore"]["wetVolumeMm3"], wet + d(pulse["volume"]["value"]))
        for key, value in components.items():
            check(case["pore"]["components"][key], value + pulse_water * d(donor["molality"][key]["value"]))
        check(case["externalReservoirs"][donor["id"]]["remainingVolumeMm3"],
              d(donor["volume"]["value"]) - admitted[donor["id"]] - d(pulse["volume"]["value"]))

    assert receipt["boundaryProofs"]["connectedMaterialDigest"] == receipt["boundaryProofs"]["sealedMaterialDigest"]
    assert receipt["actualMvt"]["connectedPhysicalSnapshot"] is None
    assert receipt["actualMvt"]["sealedPhysicalSnapshot"] is None
    assert receipt["productionMappingAllowed"] is False
    print(json.dumps({"method": "Python Decimal precision 60; causal material/parcel arithmetic",
                      "checked": checked, "waterKg": str(water), "removedCalciteMol": str(removed),
                      "physicalMvtAuthority": False, "productionMappingAllowed": False}, indent=2))
