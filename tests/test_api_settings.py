import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch
from flotation.api_settings import checked_origin, load_settings

ROOT = Path(__file__).resolve().parents[1]


class SettingsTests(unittest.TestCase):
    def test_explicit_origins_only(self):
        for origin in ("*", "https://*.vercel.app", "null", "http://public.example", "https://x.example/path", "https://user:pass@x.example", "https://x.example?q=secret"):
            with self.assertRaises(ValueError):
                checked_origin(origin)
        self.assertEqual(checked_origin("https://EXACT.vercel.app/"), "https://exact.vercel.app")

    def test_delivery_authorizes_only_development_and_exact_production_origin(self):
        with patch.dict(os.environ, {}, clear=True):
            settings = load_settings(ROOT)
        self.assertEqual(settings.port, 8765)
        self.assertEqual(settings.allowed_origins, ("http://127.0.0.1:8000", "http://localhost:8000", "https://flotacion-pi-methodsx.vercel.app"))
        self.assertEqual(settings.web_url, "https://flotacion-pi-methodsx.vercel.app")

    def test_public_origin_override_is_exact_and_does_not_expand_to_all_vercel(self):
        with patch.dict(os.environ, {"FLOTALAB_ALLOWED_ORIGINS": '["https://exact.vercel.app"]', "FLOTALAB_PORT": "8766"}):
            settings = load_settings(ROOT)
        self.assertEqual(settings.port, 8766)
        self.assertEqual(settings.allowed_origins, ("https://exact.vercel.app", "https://flotacion-pi-methodsx.vercel.app"))

    def test_invalid_override_is_rejected(self):
        for value in ('["*"]', '[]', '"not-an-array"'):
            with patch.dict(os.environ, {"FLOTALAB_ALLOWED_ORIGINS": value}):
                with self.assertRaises(ValueError):
                    load_settings(ROOT)
