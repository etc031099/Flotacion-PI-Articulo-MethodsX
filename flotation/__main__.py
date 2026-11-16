"""python -m flotation CONFIG --output RESULT [--strategy ...]"""
import argparse
import json
from pathlib import Path
from .core import simulate, compare

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("config", type=Path)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--strategy", choices=["feedback", "feedback_feedforward", "compare"], default="feedback")
parser.add_argument("--exchange", action="store_true", help="Include declared Python provenance in an exchange envelope")
args = parser.parse_args()
config = json.loads(args.config.read_text(encoding="utf-8-sig"))
results = compare(config) if args.strategy == "compare" else {args.strategy: simulate(config, args.strategy)}
result = ({"kind": "simulation_exchange", "exchange_version": "1.0.0", "engine": "python", "results": list(results.values())}
          if args.exchange or args.strategy == "compare" else results[args.strategy])
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(result, ensure_ascii=False, allow_nan=False, indent=2), encoding="utf-8")
print(json.dumps({"output": str(args.output), "iae_cm_s": {s: r["iae_cm_s"] for s, r in results.items()}}))
