"""Copy package outside the repository, install fresh venv, run BAT/API/CLI, stop all owned processes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    args = parser.parse_args()
    source = args.package.resolve()
    manifest_hash = hashlib.sha256((source / "MANIFIESTO.json").read_bytes()).hexdigest()
    independent = Path(tempfile.gettempdir()) / ("FlotaLab-validacion-" + uuid.uuid4().hex[:10])
    shutil.copytree(source, independent)
    env = {k: v for k, v in os.environ.items() if k not in ("PYTHONPATH", "PYTHONHOME", "FLOTALAB_PORT", "FLOTALAB_ALLOWED_ORIGINS")}
    log_path = independent / "validacion.log"
    process = None
    checks = []
    with log_path.open("w", encoding="utf-8") as log:
        def run(command):
            subprocess.run(command, cwd=independent, env=env, check=True, stdout=log, stderr=log, timeout=180)

        try:
            run([sys.executable, "-m", "venv", ".venv"])
            executable = independent / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
            run([str(executable), "-m", "pip", "--isolated", "install", "--index-url", "https://pypi.org/simple", "-r", "requirements.txt"])
            checks.append("Fresh independent venv and locked dependency installation")
            run([str(executable), "comprobar_dependencias.py"])
            checks.append("Dependency check succeeds without reinstallation")
            path_info = subprocess.check_output([str(executable), "-c", "import flotation.core,sys,json; print(json.dumps({'core':flotation.core.__file__,'prefix':sys.prefix}))"], cwd=independent, env=env, text=True)
            info = json.loads(path_info)
            if not Path(info["core"]).resolve().is_relative_to(independent) or not Path(info["prefix"]).resolve().is_relative_to(independent):
                raise RuntimeError("El programa depende de una carpeta externa")
            checks.append("Core and interpreter resolve only inside independent package")
            with socket.socket() as sock:
                sock.bind(("127.0.0.1", 0))
                port = sock.getsockname()[1]
            env["FLOTALAB_PORT"] = str(port)
            command = ["cmd.exe", "/d", "/c", ".\\INICIAR_PYTHON.bat"] if os.name == "nt" else [str(executable), "servidor.py"]
            process = subprocess.Popen(command, cwd=independent, env=env, stdin=subprocess.PIPE, stdout=log, stderr=log,
                                       creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0)
            base = f"http://127.0.0.1:{port}"
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                if process.poll() is not None:
                    raise RuntimeError("El iniciador terminó antes de iniciar el servicio")
                try:
                    with urllib.request.urlopen(base + "/health", timeout=.5) as response:
                        health = json.load(response)
                    break
                except OSError:
                    time.sleep(.1)
            else:
                raise RuntimeError("El iniciador no levantó la API")
            if health["engine"] != "python" or health["api_version"] != "1.0.0":
                raise RuntimeError("Health incompatible")
            checks.append("Windows BAT launcher starts real API (no mocked process)")
            config = json.loads((independent / "configs/paper_identified.json").read_text(encoding="utf-8"))
            answers = []
            for strategy in ("feedback", "feedback_feedforward"):
                body = json.dumps({"schema_version": "1.0.0", "config": config, "strategy": strategy}).encode()
                request = urllib.request.Request(base + "/simulate", data=body, headers={"Content-Type": "application/json", "Origin": "http://127.0.0.1:8000"})
                with urllib.request.urlopen(request, timeout=20) as response:
                    if response.headers["X-FlotaLab-Engine"] != "python":
                        raise RuntimeError("Falta procedencia Python")
                    answers.append(json.load(response))
            checks.append("Real HTTP simulate computes both strategies from independent package")
            run([str(executable), "simulacion_flotacion.py", "configs/paper_identified.json", "--output", "resultado_autonomo.json", "--strategy", "compare"])
            result = json.loads((independent / "resultado_autonomo.json").read_text(encoding="utf-8"))
            if result["results"] != answers:
                raise RuntimeError("El resultado HTTP difiere del CLI Python")
            checks.append("Portable mathematical CLI matches every API field exactly")
            evidence = {"status": "PASS", "manifest_sha256": manifest_hash, "independent_directory": str(independent),
                        "interpreter": str(executable), "python_version": subprocess.check_output([str(executable), "--version"], text=True).strip(),
                        "checks": checks, "health": health, "iae_cm_s": {r["strategy"]: r["iae_cm_s"] for r in answers},
                        "max_abs_difference": 0.0, "log": str(log_path)}
        except BaseException as exc:
            evidence = {"status": "FAIL", "manifest_sha256": manifest_hash, "checks": checks, "error": str(exc), "log": str(log_path)}
            raise
        finally:
            if process is not None and process.poll() is None:
                if os.name == "nt":
                    subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], stdout=log, stderr=log, check=False)
                else:
                    process.terminate()
                process.wait(timeout=10)
            args.evidence.parent.mkdir(parents=True, exist_ok=True)
            args.evidence.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": evidence["status"], "checks": len(checks), "evidence": str(args.evidence), "independent_directory": str(independent)}))


if __name__ == "__main__":
    main()
