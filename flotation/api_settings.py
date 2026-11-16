"""Local-only configuration. No HTTP endpoint accepts file paths or settings."""
from dataclasses import dataclass
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

API_VERSION = "1.0.0"
MAX_DURATION_S = 7200
MAX_EVENTS = 128
MAX_REQUEST_BYTES = 262144
MAX_RESPONSE_BYTES = 32 * 1024 * 1024
MAX_ORIGINS = 16


def checked_origin(value):
    if not isinstance(value, str) or len(value) > 250:
        raise ValueError("Origen no válido")
    parsed = urlsplit(value)
    if (parsed.scheme not in ("http", "https") or not parsed.hostname
            or parsed.username or parsed.password or parsed.path not in ("", "/")
            or parsed.query or parsed.fragment or "*" in value or parsed.hostname == "null"):
        raise ValueError("Indica un origen exacto, sin rutas, comodines ni credenciales")
    if parsed.scheme == "http" and parsed.hostname not in ("localhost", "127.0.0.1"):
        raise ValueError("Los orígenes públicos deben utilizar HTTPS")
    port = parsed.port  # Also rejects malformed/out-of-range ports.
    host = parsed.hostname.lower()
    if ":" in host:
        raise ValueError("La configuración del servicio utiliza loopback IPv4")
    return f"{parsed.scheme}://{host}" + (f":{port}" if port and port != (443 if parsed.scheme == "https" else 80) else "")


@dataclass(frozen=True)
class Settings:
    port: int
    allowed_origins: tuple[str, ...]
    web_url: str | None = None


def load_settings(package_root=None):
    root = Path(package_root) if package_root else Path(__file__).resolve().parents[1]
    path = root / "configuracion_servidor.json"
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict) or set(data) != {"puerto", "origenes_permitidos", "url_web"}:
        raise ValueError("La configuración requiere puerto, origenes_permitidos y url_web")
    port = data["puerto"]
    if "FLOTALAB_PORT" in os.environ:
        port = int(os.environ["FLOTALAB_PORT"])
    if type(port) is not int or not 1024 <= port <= 65535:
        raise ValueError("El puerto debe estar entre 1024 y 65535")
    origins = data["origenes_permitidos"]
    if "FLOTALAB_ALLOWED_ORIGINS" in os.environ:
        origins = json.loads(os.environ["FLOTALAB_ALLOWED_ORIGINS"])
    if not isinstance(origins, list) or not 1 <= len(origins) <= MAX_ORIGINS:
        raise ValueError("Configura entre 1 y 16 orígenes explícitos")
    allowed = [checked_origin(origin) for origin in origins]
    web_url = data["url_web"]
    if web_url is not None:
        web_url = checked_origin(web_url)
        if not web_url.startswith("https://"):
            raise ValueError("url_web debe ser el origen HTTPS público exacto")
        allowed.append(web_url)
    return Settings(port, tuple(dict.fromkeys(allowed)), web_url)
