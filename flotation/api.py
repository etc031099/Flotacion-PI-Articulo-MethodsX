"""FastAPI adapter over the existing, unchanged mathematical core."""
import asyncio
import json
import math
from pathlib import Path
import threading
from typing import Any, Literal
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from jsonschema import Draft202012Validator
from pydantic import BaseModel, ConfigDict
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .core import VERSION, simulate, validate_config
from .api_settings import (API_VERSION, MAX_DURATION_S, MAX_EVENTS, MAX_REQUEST_BYTES,
                           MAX_RESPONSE_BYTES, Settings, load_settings)

META_HEADERS = {"X-FlotaLab-Engine": "python", "X-FlotaLab-API-Version": API_VERSION,
                "X-FlotaLab-Model-Version": VERSION, "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff"}


class SimulationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    schema_version: Literal["1.0.0"]
    strategy: Literal["feedback", "feedback_feedforward"]
    config: dict[str, Any]


def _json_constant(_):
    raise ValueError("JSON no admite NaN ni Infinity")


def _unique_object(pairs):
    obj = {}
    for key, value in pairs:
        if key in obj:
            raise ValueError("Claves JSON duplicadas")
        obj[key] = value
    return obj


def _finite_tree(value):
    if isinstance(value, dict):
        return all(_finite_tree(v) for v in value.values())
    if isinstance(value, list):
        return all(_finite_tree(v) for v in value)
    return not isinstance(value, float) or math.isfinite(value)


class LocalRequestGuard:
    """Reject foreign origins before computing; bound raw body before JSON parsing."""
    def __init__(self, app, allowed_origins):
        self.app = app
        self.allowed = set(allowed_origins)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = {k.decode("latin1").lower(): v.decode("latin1") for k, v in scope["headers"]}
        origin = headers.get("origin")
        request_id = str(uuid.uuid4())
        scope.setdefault("state", {})["request_id"] = request_id

        async def reject(code, detail):
            await JSONResponse({"detail": detail}, code, headers={**META_HEADERS, "X-FlotaLab-Request-ID": request_id})(scope, receive, send)

        if scope.get("client") and scope["client"][0] != "127.0.0.1":
            await reject(403, "Sólo se admiten conexiones loopback IPv4")
            return
        if origin is not None and origin not in self.allowed:
            await reject(403, "Origen no autorizado; añade el origen exacto en configuracion_servidor.json")
            return
        if scope["path"] in ("/health", "/simulate") and scope.get("query_string"):
            await reject(400, "Estos endpoints no admiten rutas de archivos ni parámetros de consulta")
            return
        if scope["path"] == "/simulate" and scope["method"] == "POST":
            if origin is None and headers.get("sec-fetch-site") in ("cross-site", "same-site"):
                await reject(403, "Falta el origen de la solicitud del navegador")
                return
            if headers.get("content-type", "").split(";")[0].strip().lower() != "application/json":
                await reject(415, "Se requiere Content-Type: application/json")
                return
            try:
                size = int(headers.get("content-length", "0"))
                if size < 0:
                    raise ValueError()
            except ValueError:
                await reject(400, "Content-Length no válido")
                return
            if size > MAX_REQUEST_BYTES:
                await reject(413, "Solicitud demasiado grande; máximo 256 KiB")
                return
            body = bytearray()
            try:
                while True:
                    chunk = await asyncio.wait_for(receive(), timeout=5)
                    if chunk["type"] == "http.disconnect":
                        return
                    body.extend(chunk.get("body", b""))
                    if len(body) > MAX_REQUEST_BYTES:
                        await reject(413, "Solicitud demasiado grande; máximo 256 KiB")
                        return
                    if not chunk.get("more_body", False):
                        break
                json.loads(body, parse_constant=_json_constant, object_pairs_hook=_unique_object)
            except asyncio.TimeoutError:
                await reject(408, "Tiempo de lectura agotado")
                return
            except (ValueError, UnicodeError, RecursionError):
                await reject(400, "JSON no válido, demasiado profundo, no finito o con claves duplicadas")
                return
            consumed = False

            async def bounded_receive():
                nonlocal consumed
                if not consumed:
                    consumed = True
                    return {"type": "http.request", "body": bytes(body), "more_body": False}
                return await receive()

            await self.app(scope, bounded_receive, send)
        else:
            await self.app(scope, receive, send)


def create_app(settings: Settings | None = None, package_root=None):
    root = Path(package_root) if package_root else Path(__file__).resolve().parents[1]
    settings = settings or load_settings(root)
    schema = json.loads((root / "schemas" / "simulation-v1.schema.json").read_text(encoding="utf-8"))
    validator = Draft202012Validator({"$defs": schema["$defs"], "$ref": "#/$defs/scenario"})
    result_validator = Draft202012Validator({"$defs": schema["$defs"], "$ref": "#/$defs/result"})
    gate = threading.BoundedSemaphore(1)
    app = FastAPI(title="FlotaLab · Python local", version=API_VERSION, debug=False,
                  docs_url=None, redoc_url=None, openapi_url=None, redirect_slashes=False)
    app.state.settings = settings
    app.add_middleware(LocalRequestGuard, allowed_origins=settings.allowed_origins)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost"])
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.allowed_origins),
                       allow_credentials=False, allow_methods=["GET", "POST"],
                       allow_headers=["Content-Type"],
                       expose_headers=["X-FlotaLab-Engine", "X-FlotaLab-API-Version", "X-FlotaLab-Model-Version", "X-FlotaLab-Request-ID"], max_age=600)

    def response_headers(request):
        return {**META_HEADERS, "X-FlotaLab-Request-ID": request.state.request_id}

    @app.get("/health")
    def health(request: Request):
        return JSONResponse({"status": "ok", "engine": "python", "schema_version": VERSION,
                             "api_version": API_VERSION, "model_version": VERSION,
                             "capabilities": {"strategies": ["feedback", "feedback_feedforward"],
                                              "models": ["physical", "identified"], "dt_s": 1,
                                              "max_duration_s": MAX_DURATION_S, "max_samples": MAX_DURATION_S,
                                              "max_events": MAX_EVENTS, "max_request_bytes": MAX_REQUEST_BYTES,
                                              "max_concurrent_simulations": 1}}, headers=response_headers(request))

    @app.post("/simulate")
    def simulate_endpoint(payload: SimulationRequest, request: Request):
        from fastapi import HTTPException
        c = payload.config
        try:
            if not _finite_tree(c):
                raise ValueError("Todos los números deben ser finitos")
            error = next(validator.iter_errors(c), None)
            if error:
                where = ".".join(map(str, error.absolute_path)) or "config"
                raise ValueError(f"Escenario incompatible con el esquema: {where}")
            validate_config(c)
            if c["duration_s"] > MAX_DURATION_S:
                raise ValueError("Duración excesiva; máximo 7200 s/muestras")
            if len(c["events"]) > MAX_EVENTS:
                raise ValueError("Demasiados eventos; máximo 128")
            if not 0 <= c["pump_min_lpm"] < c["pump_max_lpm"] <= 10000:
                raise ValueError("El límite de bomba de la API es 10000 L/min")
            if c["feed_lpm"] > 10000 or any(e["value"] > 10000 for e in c["events"] if e["type"] == "feed"):
                raise ValueError("El caudal máximo de entrada de la API es 10000 L/min")
            for cell in c["cells"]:
                if not (1 <= cell["area_cm2"] <= 1e6 and .01 <= cell["height_cm"] <= 1000
                        and -100 <= cell["k_prime"] <= -1e-9
                        and -1e5 <= cell["kc_final"] <= -1e-9
                        and .001 <= cell["ti_final_s"] <= 1e5 and cell["tau_c_s"] <= 1e5):
                    raise ValueError("Parámetros fuera de los límites numéricos de la API")
        except (ValueError, TypeError, OverflowError) as exc:
            raise HTTPException(422, str(exc)) from None
        if not gate.acquire(blocking=False):
            raise HTTPException(429, "Motor ocupado; espera al cálculo actual")
        try:
            result = simulate(c, payload.strategy)  # The only mathematical implementation.
            if not _finite_tree(result):
                raise ValueError("Resultado no finito")
            result_validator.validate(result)
            encoded = json.dumps(result, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")
            if len(encoded) > MAX_RESPONSE_BYTES:
                raise HTTPException(413, "Resultado demasiado grande")
            return Response(encoded, media_type="application/json", headers=response_headers(request))
        except (ValueError, OverflowError, ArithmeticError):
            raise HTTPException(422, "El escenario produce un resultado numérico no válido") from None
        finally:
            gate.release()

    return app
