"""Start the local API; network binding is deliberately fixed to 127.0.0.1."""
import argparse
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser(description="Motor Python local de FlotaLab")
    parser.add_argument("--port", type=int, help="Puerto alternativo (predeterminado 8765)")
    args = parser.parse_args()
    try:
        import uvicorn
        from flotation.api import create_app
        from flotation.api_settings import Settings, load_settings
        root = Path(__file__).resolve().parent
        settings = load_settings(root)
        if args.port is not None:
            if not 1024 <= args.port <= 65535:
                parser.error("el puerto debe estar entre 1024 y 65535")
            settings = Settings(args.port, settings.allowed_origins, settings.web_url)
        app = create_app(settings, root)
    except ImportError as exc:
        print(f"Falta una dependencia: {exc.name}. Ejecute INICIAR_PYTHON.bat o instale requirements.txt.", file=sys.stderr)
        return 1
    except (ValueError, OSError) as exc:
        print(f"No se pudo iniciar: {exc}", file=sys.stderr)
        return 1
    print(f"\nFlotaLab - Motor matematico Python\nAPI: http://127.0.0.1:{settings.port}\n", flush=True)
    print("Abra la simulacion web y pulse Conectar Python.\nDetenga el servidor con Ctrl+C.\n", flush=True)
    print("Origenes autorizados: " + ", ".join(settings.allowed_origins), flush=True)
    if not settings.web_url:
        print("URL publica de Vercel pendiente. La conexion HTTPS publica aun no esta validada.\n", flush=True)
    try:
        uvicorn.run(app, host="127.0.0.1", port=settings.port, workers=1, reload=False,
                    proxy_headers=False, server_header=False, timeout_keep_alive=5, limit_concurrency=8)
    except (OSError, SystemExit) as exc:
        print("No se pudo abrir el puerto. Cierre otro servidor FlotaLab o use --port 8766.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
