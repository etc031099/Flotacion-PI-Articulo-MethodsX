from copy import deepcopy
import json
import math
from pathlib import Path
import subprocess
import unittest

from flotation.core import UNITS, compare, simc, simulate, validate_config

ROOT = Path(__file__).resolve().parents[1]


def config(model="identified"):
    return json.loads((ROOT / "configs" / ("physical_simc.json" if model == "physical" else "paper_identified.json")).read_text(encoding="utf-8"))


class CoreTests(unittest.TestCase):
    def test_equilibrium_both_models_and_strategies(self):
        for model in ("physical", "identified"):
            c = config(model)
            c["events"] = []
            for r in compare(c).values():
                self.assertLess(max(r["iae_cm_s"]), 1e-8)
                for row in r["series"]:
                    for q in row["qout_lpm"]:
                        self.assertAlmostEqual(q, 45)

    def test_sign_and_exact_delay_all_three_cells(self):
        for i in range(3):
            for direction in (-1, 1):
                c = config()
                c["duration_s"] = 20
                c["events"] = []
                c["cells"][i]["setpoint_cm"] += direction * 0.1
                r = simulate(c)
                rows = r["series"]
                theta = c["cells"][i]["theta_s"]
                self.assertLess(direction * (rows[0]["command_lpm"][i] - 45), 0)
                for row in rows[:theta]:
                    self.assertAlmostEqual(row["qout_lpm"][i], 45)
                    self.assertAlmostEqual(row["next_level_cm"][i], c["cells"][i]["initial_level_cm"])
                self.assertAlmostEqual(rows[theta]["qout_lpm"][i], rows[0]["command_lpm"][i])
                self.assertGreater(direction * (rows[theta]["next_level_cm"][i] - rows[theta]["level_cm"][i]), 0)

    def test_propagation_and_volume_conservation(self):
        for model in ("physical", "identified"):
            for r in compare(config(model)).values():
                self.assertLess(max(abs(row["balance_residual_l"]) for row in r["series"]), 1e-8)
                for row in r["series"]:
                    self.assertEqual(row["qin_lpm"][1:], row["qout_lpm"][:2])
                    for i, area in enumerate(r["storage_area_cm2"]):
                        dv = area * (row["next_level_cm"][i] - row["level_cm"][i]) / 1000
                        self.assertAlmostEqual(dv, (row["qin_lpm"][i] - row["qout_lpm"][i] - row["spill_lpm"][i]) / 60, places=10)

    def test_geometric_and_identified_open_loop_slopes(self):
        for model in ("physical", "identified"):
            c = config(model)
            c.update(duration_s=2, events=[{"time_s": 0, "type": "feed", "value": 46}])
            r = simulate(c)
            slope = r["series"][0]["next_level_cm"][0] - 30
            expected = 1000 / (60 * 900) if model == "physical" else 0.001018
            self.assertAlmostEqual(slope, expected)

    def test_simc_table_discrepancies_remain_visible(self):
        calculated = [simc(-0.001018, theta, tc) for theta, tc in zip([7, 6, 3], [7, 6, 8])]
        self.assertAlmostEqual(calculated[0]["kc"], -70.16559079427448)
        self.assertEqual([g["ti_s"] for g in calculated], [56, 48, 44])
        self.assertNotAlmostEqual(calculated[2]["kc"], -78.1, places=1)
        self.assertNotEqual(calculated[2]["ti_s"], 52)
        self.assertAlmostEqual(simc(-1000 / (60 * 900), 7, 7)["kc"], -3.857142857142857)
        self.assertEqual(simc(-0.001018, 7, 7, 20)["ti_s"], 20)

    def test_iae_is_left_sum_same_horizon(self):
        for r in compare(config()).values():
            self.assertEqual(len(r["series"]), 900)
            for i in range(3):
                self.assertAlmostEqual(r["iae_cm_s"][i], sum(abs(row["error_cm"][i]) for row in r["series"]), places=10)
            self.assertEqual(r["final_level_cm"], r["series"][-1]["next_level_cm"])

    def test_feedforward_literal_pulse_and_accumulated_variant(self):
        for mode in ("paper_increment", "accumulated_increment"):
            c = config()
            c.update(duration_s=3, feedforward_mode=mode, events=[{"time_s": 0, "type": "feed", "value": 55}])
            fb, ff = compare(c).values()
            self.assertAlmostEqual(ff["series"][0]["command_lpm"][0] - fb["series"][0]["command_lpm"][0], 8)
            # Levels and integrals remain equal until own pump delay is exhausted.
            self.assertAlmostEqual(ff["series"][1]["command_lpm"][0] - fb["series"][1]["command_lpm"][0], 0 if mode == "paper_increment" else 8)

    def test_saturation_overflow_and_empty_protection(self):
        for feed in (0, 10000):
            c = config("physical")
            c.update(duration_s=80, events=[{"time_s": 0, "type": "feed", "value": feed}])
            for cell in c["cells"]:
                cell["initial_level_cm"] = 0 if feed == 0 else 44.9
                cell["setpoint_cm"] = cell["initial_level_cm"]
            r = simulate(c)
            self.assertLess(max(abs(row["balance_residual_l"]) for row in r["series"]), 1e-8)
            for row in r["series"]:
                self.assertTrue(all(0 <= q <= 90 for q in row["command_lpm"]))
                self.assertTrue(all(0 <= q <= 90 + 1e-9 for q in row["qout_lpm"]))
                self.assertTrue(all(-1e-10 <= h <= 45 + 1e-10 for h in row["next_level_cm"]))
            if feed:
                self.assertGreater(sum(sum(row["spill_lpm"]) for row in r["series"]), 0)

    def test_numerical_convergence_small_step_without_saturation(self):
        for model in ("physical", "identified"):
            c = config(model)
            c.update(duration_s=1800, events=[{"time_s": 10, "type": "setpoint", "cell": 0, "value": 30.1}])
            for r in compare(c).values():
                self.assertTrue(all(math.isfinite(v) for v in r["final_level_cm"]))
                self.assertLess(max(abs(v) for row in r["series"][-100:] for v in row["error_cm"]), 1e-5)
                self.assertFalse(any(any(row["saturated"]) for row in r["series"]))

    def test_conditional_antiwindup_recovers(self):
        c = config("physical")
        c.update(duration_s=1200, events=[{"time_s": 0, "type": "setpoint", "cell": 0, "value": 45}, {"time_s": 100, "type": "setpoint", "cell": 0, "value": 30}])
        r = simulate(c)
        self.assertTrue(any(row["saturated"][0] for row in r["series"]))
        self.assertLess(max(abs(v) for v in r["series"][-1]["error_cm"]), 1e-4)

    def test_invalid_inputs(self):
        for key, value in [("dt_s", 0.5), ("schema_version", "2"), ("model", "bad"), ("feed_lpm", float("nan")), ("duration_s", 0), ("units", {**UNITS, "flow": "m3/s"}), ("pump_max_lpm", 0), ("feedforward_mode", "bad")]:
            c = config()
            c[key] = value
            with self.assertRaises(ValueError):
                simulate(c)
        for key, value in [("theta_s", 1.5), ("area_cm2", 0), ("ti_final_s", 0), ("k_prime", 1), ("kff", 2)]:
            c = config()
            c["cells"][0][key] = value
            with self.assertRaises(ValueError):
                simulate(c)
        with self.assertRaises(ValueError):
            simulate(config(), "unknown")

    def test_python_javascript_full_series_roundtrip(self):
        # Both directions use actual JSON files, not hard-coded expected arrays.
        cases = []
        for model in ("physical", "identified"):
            for mode in ("paper_increment", "accumulated_increment"):
                c = config(model)
                c["feedforward_mode"] = mode
                cases.append(c)
        edge = config("physical")
        edge.update(duration_s=80, events=[{"time_s": 0, "type": "feed", "value": 10000}])
        cases.append(edge)
        dry = deepcopy(edge)
        dry["events"][0]["value"] = 0
        for cell in dry["cells"]:
            cell["initial_level_cm"] = cell["setpoint_cm"] = 0
        cases.append(dry)
        path = ROOT / "tmp" / "interop-tests"
        path.mkdir(parents=True, exist_ok=True)
        try:
            for c in cases:
                (path / "config.json").write_text(json.dumps(c), encoding="utf-8")
                for strategy in ("feedback", "feedback_feedforward"):
                    subprocess.run(["node", "scripts/simulate.mjs", str(path / "config.json"), str(path / "js.json"), strategy], cwd=ROOT, check=True, capture_output=True)
                    js = json.loads((path / "js.json").read_text(encoding="utf-8"))
                    py = simulate(c, strategy)
                    self.assert_nested_close(py, js)
                    (path / "python.json").write_text(json.dumps(py), encoding="utf-8")
                    subprocess.run(["node", "scripts/check_result.mjs", str(path / "python.json")], cwd=ROOT, check=True, capture_output=True)
                    self.assertEqual(c, simulate(js["config"], strategy)["config"])
        finally:
            for name in ("config.json", "js.json", "python.json"):
                (path / name).unlink(missing_ok=True)

    def assert_nested_close(self, a, b):
        if isinstance(a, dict):
            self.assertEqual(a.keys(), b.keys())
            for key in a:
                self.assert_nested_close(a[key], b[key])
        elif isinstance(a, list):
            self.assertEqual(len(a), len(b))
            for x, y in zip(a, b):
                self.assert_nested_close(x, y)
        elif isinstance(a, (float, int)) and not isinstance(a, bool):
            self.assertTrue(math.isclose(a, b, rel_tol=1e-11, abs_tol=1e-9), (a, b))
        else:
            self.assertEqual(a, b)

    def test_json_schema_examples(self):
        import jsonschema
        schema = json.loads((ROOT / "schemas/simulation-v1.schema.json").read_text(encoding="utf-8"))
        jsonschema.Draft202012Validator.check_schema(schema)
        validator = jsonschema.Draft202012Validator(schema)
        for path in [*ROOT.glob("configs/*.json"), *ROOT.glob("examples/*.json")]:
            validator.validate(json.loads(path.read_text(encoding="utf-8")))


if __name__ == "__main__":
    unittest.main()
