"""Generate pressure-dependent logK corrections from Reaktoro/SUPCRTBL.

This is an offline provenance tool, not a browser runtime dependency.  It
computes each dissolution reaction from standard molal Gibbs energies and
stores delta-logK relative to 1 bar at the same temperature.  The existing
game Ksp(T) calibration remains the reference curve; this artifact supplies
only the independently generated pressure response.

Reproducible environment used for the promoted artifact:
  Python 3.12, Reaktoro 2.13.0, embedded SupcrtDatabase("supcrtbl")

Run:
  npm run generate:pressure-grid
  npm run check:pressure-grid

The Node launcher selects only an environment with Reaktoro 2.13.0. Create the
repo-local environment from environment-pressure-grid.yml or point
VUGG_REAKTORO_PYTHON at an equivalent interpreter.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import reaktoro as rkt


ROOT = Path(__file__).resolve().parents[1]
JSON_OUTPUT = ROOT / "data" / "generated" / "thermo-pressure-grid.json"
TS_OUTPUT = ROOT / "js" / "20e-thermo-pressure-grid.generated.ts"

TEMPERATURES_C = [10, 25, 50, 75, 90, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800]
PRESSURES_KBAR = [0.001, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 3.0, 4.4]
REFERENCE_PRESSURE_KBAR = 0.001
MIN_WATER_DENSITY_G_CM3 = 0.35
R_J_MOL_K = 8.31446261815324

# Stoichiometric coefficients are positive for aqueous products and negative
# for the dissolving solid.  Only exact game reactions represented by a
# SUPCRTBL solid are promoted.  The temperature envelope is the intersection
# of the current game's evidence-backed Ksp(T) range and the generated grid.
REACTIONS: dict[str, dict[str, Any]] = {
    "calcite": {
        "family": "carbonate",
        "formula": "CaCO3",
        "equation": "Calcite = Ca+2 + CO3-2",
        "species": {"Calcite": -1, "Ca+2": 1, "CO3-2": 1},
        "usable_temperature_C": [10, 90],
    },
    "aragonite": {
        "family": "carbonate",
        "formula": "CaCO3",
        "equation": "Aragonite = Ca+2 + CO3-2",
        "species": {"Aragonite": -1, "Ca+2": 1, "CO3-2": 1},
        "usable_temperature_C": [10, 90],
    },
    "dolomite": {
        "family": "carbonate",
        "formula": "CaMg(CO3)2",
        "equation": "Dolomite,ordered = Ca+2 + Mg+2 + 2 CO3-2",
        "species": {"Dolomite,ordered": -1, "Ca+2": 1, "Mg+2": 1, "CO3-2": 2},
        "usable_temperature_C": [10, 250],
    },
    "siderite": {
        "family": "carbonate",
        "formula": "FeCO3",
        "equation": "Siderite = Fe+2 + CO3-2",
        "species": {"Siderite": -1, "Fe+2": 1, "CO3-2": 1},
        "usable_temperature_C": [10, 200],
    },
    "rhodochrosite": {
        "family": "carbonate",
        "formula": "MnCO3",
        "equation": "Rhodochrosite = Mn+2 + CO3-2",
        "species": {"Rhodochrosite": -1, "Mn+2": 1, "CO3-2": 1},
        "usable_temperature_C": [10, 200],
    },
    "anhydrite": {
        "family": "sulfate",
        "formula": "CaSO4",
        "equation": "Anhydrite = Ca+2 + SO4-2",
        "species": {"Anhydrite": -1, "Ca+2": 1, "SO4-2": 1},
        "usable_temperature_C": [10, 300],
    },
    "barite": {
        "family": "sulfate",
        "formula": "BaSO4",
        "equation": "Barite = Ba+2 + SO4-2",
        "species": {"Barite": -1, "Ba+2": 1, "SO4-2": 1},
        "usable_temperature_C": [10, 300],
    },
    "celestine": {
        "family": "sulfate",
        "formula": "SrSO4",
        "equation": "Celestite = Sr+2 + SO4-2",
        "species": {"Celestite": -1, "Sr+2": 1, "SO4-2": 1},
        "usable_temperature_C": [10, 200],
    },
}

UNSUPPORTED: dict[str, str] = {
    "selenite": "Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.",
    "gypsum": "Alias of selenite; gypsum is absent from the SUPCRTBL solid-species set.",
    "HMC": "A continuous Mg-calcite solid solution requires a composition/activity model, not the pure-calcite pressure grid.",
    "smithsonite": "Smithsonite is absent from the SUPCRTBL solid-species set used by this generator.",
    "cerussite": "Cerussite is absent from the SUPCRTBL solid-species set used by this generator.",
    "witherite": "Witherite is absent from the SUPCRTBL solid-species set used by this generator.",
    "strontianite": "Strontianite is absent from the SUPCRTBL solid-species set used by this generator.",
    "malachite": "Malachite is absent from the SUPCRTBL solid-species set used by this generator.",
    "azurite": "Azurite is absent from the SUPCRTBL solid-species set used by this generator.",
    "hydrozincite": "Hydrozincite is absent from the SUPCRTBL solid-species set used by this generator.",
    "rosasite": "Variable-composition Cu-Zn solid solution; no exact SUPCRTBL endmember/activity model.",
    "aurichalcite": "Variable-composition Cu-Zn solid solution; no exact SUPCRTBL endmember/activity model.",
}


def scalar(value: Any) -> float:
    return float(value)


def water_density_g_cm3(db: rkt.SupcrtDatabase, temperature_c: float, pressure_kbar: float) -> float:
    water = db.species("H2O(aq)")
    props = water.standardThermoProps(temperature_c + 273.15, pressure_kbar * 1.0e8)
    return scalar(water.molarMass()) / scalar(props.V0) / 1000.0


def reaction_logk(
    db: rkt.SupcrtDatabase,
    species: dict[str, int],
    temperature_c: float,
    pressure_kbar: float,
) -> float:
    temperature_k = temperature_c + 273.15
    pressure_pa = pressure_kbar * 1.0e8
    delta_g_j_mol = sum(
        coefficient * scalar(db.species(name).standardThermoProps(temperature_k, pressure_pa).G0)
        for name, coefficient in species.items()
    )
    return -delta_g_j_mol / (R_J_MOL_K * temperature_k * math.log(10.0))


def rounded(value: float) -> float:
    return round(value, 8)


def generate_payload() -> dict[str, Any]:
    if str(rkt.__version__) != "2.13.0":
        raise RuntimeError(f"Expected Reaktoro 2.13.0, found {rkt.__version__}")
    db = rkt.SupcrtDatabase("supcrtbl")

    density_rows: list[list[float | None]] = []
    for temperature_c in TEMPERATURES_C:
        row: list[float | None] = []
        for pressure_kbar in PRESSURES_KBAR:
            density = water_density_g_cm3(db, temperature_c, pressure_kbar)
            row.append(rounded(density) if math.isfinite(density) and density >= MIN_WATER_DENSITY_G_CM3 else None)
        density_rows.append(row)

    reactions: dict[str, Any] = {}
    for mineral_id, reaction in REACTIONS.items():
        correction_rows: list[list[float | None]] = []
        for row_index, temperature_c in enumerate(TEMPERATURES_C):
            reference_logk = reaction_logk(
                db,
                reaction["species"],
                temperature_c,
                REFERENCE_PRESSURE_KBAR,
            )
            row: list[float | None] = []
            for column_index, pressure_kbar in enumerate(PRESSURES_KBAR):
                if density_rows[row_index][column_index] is None:
                    row.append(None)
                    continue
                logk = reaction_logk(db, reaction["species"], temperature_c, pressure_kbar)
                correction = logk - reference_logk
                row.append(rounded(correction) if math.isfinite(correction) else None)
            correction_rows.append(row)
        reactions[mineral_id] = {
            **reaction,
            "delta_log10_K_from_1bar": correction_rows,
        }

    return {
        "schema_version": 1,
        "model_id": "SUPCRTBL-delta-logK-pressure-grid-v1",
        "generated_date": "2026-08-08",
        "generator": "tools/gen-thermo-pressure-grid.py",
        "generator_environment": {
            "python": "3.12",
            "reaktoro": str(rkt.__version__),
            "database": "supcrtbl",
        },
        "method": "Reaction log10(K) = -deltaG0/(R*T*ln(10)); correction is log10(K(T,P)) - log10(K(T,1 bar)). Existing game Ksp(T) supplies the 1-bar calibration.",
        "sources": [
            "Johnson, Oelkers & Helgeson (1992), SUPCRT92, Computers & Geosciences 18:899-947, doi:10.1016/0098-3004(92)90029-Q",
            "Zimmer et al. (2016), SUPCRTBL, Computers & Geosciences 90:97-111, doi:10.1016/j.cageo.2016.02.013",
            "Wagner & Pruss (2002), IAPWS-95 water EOS, J. Phys. Chem. Ref. Data 31:387-535, doi:10.1063/1.1461829",
        ],
        "reference_pressure_kbar": REFERENCE_PRESSURE_KBAR,
        "temperature_axis_C": TEMPERATURES_C,
        "pressure_axis_kbar": PRESSURES_KBAR,
        "validity": {
            "water_density_min_g_cm3": MIN_WATER_DENSITY_G_CM3,
            "interpolation": "bilinear only when all four cell corners are present",
            "extrapolation": "forbidden",
            "temperature_rule": "runtime also enforces each reaction's usable_temperature_C envelope",
        },
        "water_density_g_cm3": density_rows,
        "reactions": reactions,
        "unsupported": UNSUPPORTED,
    }


def canonical_json(value: Any) -> str:
    # Match ECMAScript JSON.stringify for integer-valued finite floats (1.0
    # serializes as 1 in JavaScript). This lets the lightweight Vitest artifact
    # guard recompute the digest without importing Reaktoro in CI.
    def normalize_numbers(item: Any) -> Any:
        if isinstance(item, dict):
            return {key: normalize_numbers(child) for key, child in item.items()}
        if isinstance(item, list):
            return [normalize_numbers(child) for child in item]
        if isinstance(item, float) and math.isfinite(item) and item.is_integer():
            return int(item)
        return item

    return json.dumps(normalize_numbers(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def render_outputs() -> tuple[str, str]:
    payload = generate_payload()
    digest = hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()
    wrapper = {"data_sha256": digest, "payload": payload}
    json_text = json.dumps(wrapper, ensure_ascii=False, indent=2) + "\n"
    ts_payload = json.dumps(payload, ensure_ascii=False, indent=2)
    ts_text = (
        "// AUTO-GENERATED by tools/gen-thermo-pressure-grid.py. DO NOT EDIT.\n"
        "// Offline source: Reaktoro 2.13.0 + embedded SUPCRTBL.\n\n"
        f"const THERMO_PRESSURE_GRID_DATA_SHA256 = '{digest}';\n"
        f"const THERMO_PRESSURE_GRID = {ts_payload} as const;\n"
    )
    return json_text, ts_text


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail if generated outputs are stale")
    args = parser.parse_args()
    json_text, ts_text = render_outputs()
    expected = ((JSON_OUTPUT, json_text), (TS_OUTPUT, ts_text))
    if args.check:
        stale = [str(path.relative_to(ROOT)) for path, text in expected if not path.exists() or path.read_text(encoding="utf-8") != text]
        if stale:
            raise SystemExit("stale pressure-grid artifact(s): " + ", ".join(stale))
        print("pressure-grid artifacts are current")
        return 0
    for path, text in expected:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")
        print(f"wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
