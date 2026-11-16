"""Prepare a portable package; ZIP only after matching independent validation."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "entrega" / "Python_Flotacion"
SOURCES = {name: name for name in ["servidor.py", "simulacion_flotacion.py", "INICIAR_PYTHON.bat", "comprobar_dependencias.py", "configuracion_servidor.json",
           "flotation/__init__.py", "flotation/__main__.py", "flotation/core.py", "flotation/api.py", "flotation/api_settings.py",
           "configs/paper_identified.json", "configs/physical_simc.json", "schemas/simulation-v1.schema.json"]}
SOURCES.update({"requirements.txt": "requirements-python.lock.txt", "LEEME.txt": "LEEME_PYTHON.txt"})


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare():
    PACKAGE.mkdir(parents=True, exist_ok=True)
    unexpected = [str(p.relative_to(PACKAGE)) for p in PACKAGE.rglob("*") if p.is_file() and p.relative_to(PACKAGE).as_posix() not in {*SOURCES, "MANIFIESTO.json"}]
    if unexpected:
        raise SystemExit("La carpeta de entrega contiene archivos ajenos; revíselos antes de empaquetar: " + ", ".join(unexpected))
    for target, source in SOURCES.items():
        destination = PACKAGE / target
        destination.parent.mkdir(parents=True, exist_ok=True)
        if target.endswith(".bat"):
            destination.write_bytes((ROOT / source).read_text(encoding="utf-8").replace("\r\n", "\n").replace("\n", "\r\n").encode("ascii"))
        else:
            shutil.copyfile(ROOT / source, destination)
    manifest = {"package_version": "1.0.0", "api_version": "1.0.0", "model_version": "1.0.0",
                "files": [{"path": name, "sha256": digest(PACKAGE / name)} for name in sorted(SOURCES)]}
    (PACKAGE / "MANIFIESTO.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"package": str(PACKAGE), "files": len(SOURCES) + 1, "zip": "NOT CREATED - independent validation required"}))


def create_zip(evidence_path):
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    manifest_path = PACKAGE / "MANIFIESTO.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if evidence.get("status") != "PASS" or evidence.get("manifest_sha256") != digest(manifest_path):
        raise SystemExit("La evidencia independiente no corresponde al paquete actual")
    expected = {entry["path"] for entry in manifest["files"]} | {"MANIFIESTO.json"}
    actual = {p.relative_to(PACKAGE).as_posix() for p in PACKAGE.rglob("*") if p.is_file()}
    if actual != expected:
        raise SystemExit("La carpeta de entrega cambió después de validarla")
    for entry in manifest["files"]:
        if digest(PACKAGE / entry["path"]) != entry["sha256"]:
            raise SystemExit("Archivo modificado después de validación: " + entry["path"])
    archive = PACKAGE.parent / "Python_Flotacion.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zipped:
        for name in sorted(expected):
            zipped.write(PACKAGE / name, "Python_Flotacion/" + name)
    print(json.dumps({"zip": str(archive), "sha256": digest(archive), "bytes": archive.stat().st_size, "files": len(expected)}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["prepare", "zip"])
    parser.add_argument("--evidence", type=Path)
    args = parser.parse_args()
    if args.action == "prepare":
        prepare()
    elif args.evidence:
        create_zip(args.evidence)
    else:
        parser.error("zip requiere --evidence de la validación independiente")
