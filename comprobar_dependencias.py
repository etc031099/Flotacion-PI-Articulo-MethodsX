"""Check installed locked distributions without reinstalling on every launch."""
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
import sys


def main():
    lock = Path(__file__).resolve().parent / "requirements.txt"
    if not lock.is_file():
        print("No se encuentra requirements.txt junto al iniciador.")
        return 1
    try:
        for line in lock.read_text(encoding="utf-8").splitlines():
            requirement = line.strip()
            if not requirement or requirement.startswith("#"):
                continue
            package, expected = requirement.split("==", 1)
            if version(package) != expected:
                print(f"Es necesario instalar la version indicada de {package}.")
                return 1
        import fastapi
        import uvicorn
        import jsonschema
    except (PackageNotFoundError, ImportError, ValueError):
        print("Faltan dependencias del programa.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
