"""Generate versioned example scenarios, JSON schema and simulated result files."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from flotation.core import UNITS, simulate


def write(path, data, compact=False):
    dest = ROOT / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False, indent=None if compact else 2) + "\n", encoding="utf-8")


scenario = {
    "schema_version": "1.0.0", "kind": "scenario", "units": UNITS,
    "description": "Escenario didáctico simulado; no reproduce la Figura 14.",
    "model": "identified", "tuning": "paper_final", "feedforward_mode": "paper_increment",
    "dt_s": 1, "duration_s": 900, "feed_lpm": 45,
    "pump_min_lpm": 0, "pump_max_lpm": 90,
    "cells": [{"area_cm2": 900, "height_cm": 45, "initial_level_cm": h, "setpoint_cm": h,
               "k_prime": -0.001018, "theta_s": theta, "tau_c_s": tc, "kc_final": kc,
               "ti_final_s": ti, "kff": ff}
              for h, theta, tc, kc, ti, ff in zip([30, 33, 33], [7, 6, 3], [7, 6, 8], [-62, -76, -85], [56, 30, 44], [0.8, 0.8, 1.0])],
    "events": [{"time_s": 60, "type": "setpoint", "cell": 0, "value": 29},
               {"time_s": 180, "type": "setpoint", "cell": 1, "value": 32},
               {"time_s": 300, "type": "setpoint", "cell": 2, "value": 32},
               {"time_s": 420, "type": "feed", "value": 55},
               {"time_s": 600, "type": "feed", "value": 45}]
}
write("configs/paper_identified.json", scenario)
physical = json.loads(json.dumps(scenario))
physical.update(model="physical", tuning="simc", description="Balance geométrico con SIMC recalculado; no usa las ganancias finales experimentales.")
write("configs/physical_simc.json", physical)
for strategy in ("feedback", "feedback_feedforward"):
    write(f"examples/identified_{strategy}.json", simulate(scenario, strategy), compact=True)

num = {"type": "number"}
positive = {"type": "number", "exclusiveMinimum": 0}
nonnegative = {"type": "number", "minimum": 0}
triple = {"type": "array", "minItems": 3, "maxItems": 3, "items": num}
cell_properties = {k: num for k in scenario["cells"][0]}
cell_properties.update(area_cm2=positive, height_cm=positive, initial_level_cm=nonnegative,
                       setpoint_cm=nonnegative, k_prime={"type": "number", "exclusiveMaximum": 0},
                       theta_s={"type": "integer", "minimum": 0, "maximum": 3600}, tau_c_s=positive,
                       kc_final={"type": "number", "exclusiveMaximum": 0}, ti_final_s=positive,
                       kff={"type": "number", "minimum": 0, "maximum": 1})
event_props = {"time_s": {"type": "integer", "minimum": 0}, "type": {"enum": ["feed", "setpoint"]}, "value": nonnegative, "cell": {"type": "integer", "minimum": 0, "maximum": 2}}
event = {"type": "object", "additionalProperties": False, "properties": event_props,
         "required": ["time_s", "type", "value"],
         "if": {"properties": {"type": {"const": "setpoint"}}}, "then": {"required": ["cell"]}}
scenario_props = {
    "schema_version": {"const": "1.0.0"}, "kind": {"const": "scenario"}, "units": {"const": UNITS},
    "description": {"type": "string"}, "model": {"enum": ["physical", "identified"]},
    "tuning": {"enum": ["paper_final", "simc"]}, "feedforward_mode": {"enum": ["paper_increment", "accumulated_increment"]},
    "dt_s": {"const": 1}, "duration_s": {"type": "integer", "minimum": 1, "maximum": 86400},
    "feed_lpm": nonnegative, "pump_min_lpm": nonnegative, "pump_max_lpm": positive,
    "cells": {"type": "array", "minItems": 3, "maxItems": 3, "items": {"type": "object", "additionalProperties": False, "required": list(cell_properties), "properties": cell_properties}},
    "events": {"type": "array", "items": event}
}
scenario_schema = {"type": "object", "additionalProperties": False, "required": [k for k in scenario_props if k != "description"], "properties": scenario_props}
row_props = {k: triple for k in ["level_cm", "setpoint_cm", "error_cm", "qin_lpm", "command_lpm", "qout_lpm", "spill_lpm", "next_level_cm"]}
row_props.update(time_s={"type": "integer", "minimum": 0}, balance_residual_l=num,
                 saturated={"type": "array", "minItems": 3, "maxItems": 3, "items": {"type": "boolean"}})
result_props = {"schema_version": {"const": "1.0.0"}, "kind": {"const": "result"}, "data_origin": {"const": "simulated"},
                "units": {"const": UNITS}, "strategy": {"enum": ["feedback", "feedback_feedforward"]},
                "config": {"$ref": "#/$defs/scenario"}, "storage_area_cm2": {**triple, "items": positive},
                "controllers": {"type": "array", "minItems": 3, "maxItems": 3, "items": {"type": "object", "additionalProperties": False, "required": ["kc", "ti_s"], "properties": {"kc": num, "ti_s": positive}}},
                "iae_cm_s": triple, "final_level_cm": triple,
                "series": {"type": "array", "minItems": 1, "items": {"type": "object", "additionalProperties": False, "required": list(row_props), "properties": row_props}}}
write("schemas/simulation-v1.schema.json", {"$schema": "https://json-schema.org/draft/2020-12/schema", "$id": "urn:flotation:simulation:1.0.0", "title": "Three-cell PI simulation 1.0.0", "oneOf": [{"$ref": "#/$defs/scenario"}, {"$ref": "#/$defs/result"}], "$defs": {"scenario": scenario_schema, "result": {"type": "object", "additionalProperties": False, "required": list(result_props), "properties": result_props}}})
