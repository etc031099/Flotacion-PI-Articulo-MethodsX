"""Integration tests against a real Uvicorn subprocess over loopback HTTP."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import json
import http.client
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
import unittest
import urllib.error
import urllib.request

from jsonschema import Draft202012Validator
from flotation.core import simulate

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "http://127.0.0.1:8000"


class RealAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = json.loads((ROOT / "configs/paper_identified.json").read_text(encoding="utf-8"))
        cls.schema = json.loads((ROOT / "schemas/simulation-v1.schema.json").read_text(encoding="utf-8"))
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            cls.port = sock.getsockname()[1]
        (ROOT / "tmp").mkdir(exist_ok=True)
        cls.log = (ROOT / "tmp/api-tests.log").open("w", encoding="utf-8")
        env = dict(os.environ)
        env.pop("FLOTALAB_PORT", None)
        env.pop("FLOTALAB_ALLOWED_ORIGINS", None)
        cls.process = subprocess.Popen([sys.executable, "servidor.py", "--port", str(cls.port)], cwd=ROOT, stdout=cls.log, stderr=cls.log, env=env)
        cls.base = f"http://127.0.0.1:{cls.port}"
        deadline = time.monotonic() + 15
        try:
            while time.monotonic() < deadline:
                if cls.process.poll() is not None:
                    raise RuntimeError("El servidor terminó; revisa tmp/api-tests.log y usa el entorno con requirements-api.txt")
                try:
                    with urllib.request.urlopen(cls.base + "/health", timeout=.5) as response:
                        if response.status == 200:
                            return
                except (OSError, urllib.error.URLError):
                    time.sleep(.05)
            raise RuntimeError("El servidor de pruebas no respondió")
        except BaseException:
            cls.process.terminate()
            cls.process.wait(timeout=5)
            cls.log.close()
            raise

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.wait(timeout=5)
        cls.log.close()

    def request(self, path="/simulate", data=None, *, method=None, origin=ORIGIN, headers=None, raw=None):
        request_headers = {"Origin": origin} if origin is not None else {}
        if data is not None or raw is not None:
            request_headers["Content-Type"] = "application/json"
        request_headers.update(headers or {})
        body = raw if raw is not None else json.dumps(data).encode() if data is not None else None
        req = urllib.request.Request(self.base + path, data=body, headers=request_headers, method=method)
        try:
            response = urllib.request.urlopen(req, timeout=30)
        except urllib.error.HTTPError as exc:
            response = exc
        with response:
            contents = response.read()
            try:
                parsed = json.loads(contents)
            except ValueError:
                parsed = contents.decode()
            return response.status, response.headers, parsed

    def post(self, config=None, strategy="feedback"):
        return self.request(data={"schema_version": "1.0.0", "config": config or self.config, "strategy": strategy})

    def test_health_real_versions_and_capabilities(self):
        code, headers, data = self.request("/health")
        self.assertEqual(code, 200)
        self.assertEqual((data["engine"], data["api_version"], data["model_version"]), ("python", "1.0.0", "1.0.0"))
        self.assertEqual(data["capabilities"]["dt_s"], 1)
        self.assertEqual(data["capabilities"]["max_duration_s"], 7200)
        self.assertEqual(headers["X-FlotaLab-Engine"], "python")
        self.assertNotIn("Set-Cookie", headers)

    def test_simulate_real_schema_provenance_and_exact_direct_parity(self):
        code, headers, data = self.post()
        self.assertEqual(code, 200)
        Draft202012Validator(self.schema).validate(data)
        self.assertEqual(data, simulate(self.config))
        self.assertEqual(headers["X-FlotaLab-Model-Version"], "1.0.0")
        self.assertTrue(headers["X-FlotaLab-Request-ID"])

    def test_real_preflight_authorized_origin(self):
        code, headers, _ = self.request(method="OPTIONS", headers={"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
        self.assertEqual(code, 200)
        self.assertEqual(headers["Access-Control-Allow-Origin"], ORIGIN)
        self.assertNotIn("Access-Control-Allow-Credentials", headers)
        self.assertIn("POST", headers["Access-Control-Allow-Methods"])

    def test_rejects_foreign_origin_and_null_even_for_health(self):
        for origin in ("https://no-autorizado.example", "null"):
            code, headers, _ = self.request("/health", origin=origin)
            self.assertEqual(code, 403)
            self.assertNotIn("Access-Control-Allow-Origin", headers)
            code, _, _ = self.request(data={"schema_version": "1.0.0", "config": self.config, "strategy": "feedback"}, origin=origin)
            self.assertEqual(code, 403)

    def test_production_preflight_exact_origin_and_preview_rejected(self):
        production = "https://flotacion-pi-methodsx.vercel.app"
        code, headers, _ = self.request(method="OPTIONS", origin=production, headers={"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
        self.assertEqual(code, 200)
        self.assertEqual(headers["Access-Control-Allow-Origin"], production)
        code, headers, _ = self.request("/health", origin="https://flotacion-pi-methodsx-preview.vercel.app")
        self.assertEqual(code, 403)
        self.assertNotIn("Access-Control-Allow-Origin", headers)

    def test_rejects_foreign_preflight(self):
        code, headers, _ = self.request(method="OPTIONS", origin="https://no-autorizado.example", headers={"Access-Control-Request-Method": "POST"})
        self.assertEqual(code, 400)
        self.assertNotIn("Access-Control-Allow-Origin", headers)

    def test_local_cli_without_origin_and_host_protection(self):
        self.assertEqual(self.request("/health", origin=None)[0], 200)
        self.assertEqual(self.request("/health", headers={"Host": "rebinding.example"})[0], 400)
        self.assertEqual(self.request("/health?file=secret")[0], 400)
        self.assertEqual(self.request("/docs")[0], 404)

    def test_invalid_contract_parameters_units_and_unknown_fields(self):
        for mutate in (lambda c: c["units"].update(flow="m3/s"),
                       lambda c: c.update(schema_version="2"),
                       lambda c: c["cells"][0].update(theta_s=1.5),
                       lambda c: c["cells"][0].update(kc_final=1),
                       lambda c: c["cells"][0].update(k_prime=-1e-300),
                       lambda c: c.update(command="run.exe")):
            c = deepcopy(self.config)
            mutate(c)
            self.assertEqual(self.post(c)[0], 422)
        self.assertEqual(self.request(data={"schema_version": "1.0.0", "config": self.config, "strategy": "feedback", "file": "x"})[0], 422)

    def test_excessive_duration_events_and_body(self):
        c = deepcopy(self.config)
        c["duration_s"] = 7201
        self.assertEqual(self.post(c)[0], 422)
        c = deepcopy(self.config)
        c["events"] = [{"time_s": 0, "type": "feed", "value": 45}] * 129
        self.assertEqual(self.post(c)[0], 422)
        # Send the oversized declaration before any body (the server rejects it immediately).
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        connection.putrequest("POST", "/simulate")
        for key, value in {"Origin": ORIGIN, "Content-Type": "application/json", "Content-Length": "262145"}.items():
            connection.putheader(key, value)
        connection.endheaders()
        response = connection.getresponse()
        self.assertEqual(response.status, 413)
        response.read()
        connection.close()

    def test_malformed_nonfinite_duplicate_json_and_content_type(self):
        for raw in (b"{", b'{"x":NaN}', b'{"x":Infinity}', b'{"x":1,"x":2}'):
            self.assertEqual(self.request(raw=raw)[0], 400)
        self.assertEqual(self.request(raw=b"{}", headers={"Content-Type": "text/plain"})[0], 415)

    def test_streamed_body_size_limit_without_content_length(self):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        connection.request("POST", "/simulate", body=iter([b" " * 131073, b" " * 131073]),
                           headers={"Origin": ORIGIN, "Content-Type": "application/json", "Transfer-Encoding": "chunked"}, encode_chunked=True)
        response = connection.getresponse()
        self.assertEqual(response.status, 413)
        self.assertEqual(response.headers["Access-Control-Allow-Origin"], ORIGIN)
        response.read()
        connection.close()

    def test_equilibrium_and_measured_series_delay(self):
        c = deepcopy(self.config)
        c.update(duration_s=30, events=[])
        _, _, equilibrium = self.post(c)
        self.assertLess(max(equilibrium["iae_cm_s"]), 1e-8)
        c["cells"][0]["setpoint_cm"] = 29.9
        code, _, result = self.post(c)
        self.assertEqual(code, 200)
        self.assertTrue(all(row["qout_lpm"][0] == 45 for row in result["series"][:7]))
        self.assertEqual(result["series"][7]["qout_lpm"][0], result["series"][0]["command_lpm"][0])

    def test_real_perturbation_strategies_match_direct_python(self):
        for model, tuning in (("identified", "paper_final"), ("physical", "simc")):
            for ff in ("paper_increment", "accumulated_increment"):
                c = deepcopy(self.config)
                c.update(model=model, tuning=tuning, feedforward_mode=ff)
                for strategy in ("feedback", "feedback_feedforward"):
                    code, _, result = self.post(c, strategy)
                    self.assertEqual(code, 200)
                    self.assertEqual(result, simulate(c, strategy))

    def test_real_saturation_spill_and_conservation(self):
        c = deepcopy(self.config)
        c.update(model="physical", tuning="simc", duration_s=80,
                 events=[{"time_s": 0, "type": "feed", "value": 10000}])
        code, _, r = self.post(c)
        self.assertEqual(code, 200)
        self.assertTrue(any(any(row["saturated"]) for row in r["series"]))
        self.assertTrue(any(sum(row["spill_lpm"]) > 0 for row in r["series"]))
        self.assertLess(max(abs(row["balance_residual_l"]) for row in r["series"]), 1e-8)

    def test_concurrent_calculation_is_bounded_and_max_horizon_supported(self):
        c = deepcopy(self.config)
        c.update(duration_s=7200, events=[])
        barrier = threading.Barrier(2)

        def call():
            barrier.wait()
            return self.post(c)

        with ThreadPoolExecutor(max_workers=2) as pool:
            answers = list(pool.map(lambda _: call(), range(2)))
        self.assertEqual(sorted(answer[0] for answer in answers), [200, 429])
        result = next(data for code, _, data in answers if code == 200)
        self.assertEqual(len(result["series"]), 7200)


if __name__ == "__main__":
    unittest.main()
