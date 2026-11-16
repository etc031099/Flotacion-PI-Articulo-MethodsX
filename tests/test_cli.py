import json
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]


class CLITests(unittest.TestCase):
    def test_python_comparison_exchange_is_importable_in_javascript(self):
        output = ROOT / "tmp" / "cli-comparison.json"
        subprocess.run([sys.executable, "-m", "flotation", "configs/paper_identified.json", "--output", str(output), "--strategy", "compare"], cwd=ROOT, check=True, capture_output=True)
        data = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(data["engine"], "python")
        self.assertEqual(data["exchange_version"], "1.0.0")
        self.assertEqual(len(data["results"]), 2)
        self.assertEqual(data["results"][0]["config"], data["results"][1]["config"])
        subprocess.run(["node", "scripts/check_result.mjs", str(output)], cwd=ROOT, check=True, capture_output=True)
        output.unlink()

    def test_single_strategy_exchange_and_legacy_result_remain_compatible(self):
        for exchange in (False, True):
            output = ROOT / "tmp" / "cli-single.json"
            command = [sys.executable, "-m", "flotation", "configs/paper_identified.json", "--output", str(output), "--strategy", "feedback_feedforward"]
            if exchange:
                command.append("--exchange")
            subprocess.run(command, cwd=ROOT, check=True, capture_output=True)
            data = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(data["kind"], "simulation_exchange" if exchange else "result")
            result = data["results"][0] if exchange else data
            self.assertEqual(result["strategy"], "feedback_feedforward")
            self.assertEqual(result["schema_version"], "1.0.0")
            subprocess.run(["node", "scripts/check_result.mjs", str(output)], cwd=ROOT, check=True, capture_output=True)
            output.unlink()
