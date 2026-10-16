#!/usr/bin/env python3
"""
Astrodex — télécharge un cliché réel (Digitized Sky Survey, domaine public, via le
service SkyView de la NASA/GSFC) pour chaque objet de tools/cache/ngc_manifest.json,
et l'enregistre en catalog/images/ngc/{slug}.webp.

Reprise possible : les fichiers déjà présents sont sautés, donc on peut relancer le
script autant de fois que nécessaire jusqu'à couverture complète.

Usage : python tools/fetch_dss_images.py [--workers 6] [--limit N]
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "tools" / "cache" / "ngc_manifest.json"
OUT_DIR = ROOT / "catalog" / "images" / "ngc"
FAIL_LOG = ROOT / "tools" / "cache" / "ngc_fetch_failures.json"
BASE_URL = "https://skyview.gsfc.nasa.gov/current/cgi/runquery.pl"
SURVEYS = ["DSS2 Blue", "DSS1 Blue", "DSS"]
SIZE_PX = 360


def field_of_view_deg(size_arcmin: float | None) -> float:
    base = (size_arcmin or 6.0) * 3.2 / 60  # marge autour de l'objet, en degrés
    return max(0.09, min(1.3, base))


def fetch_one(slug: str, info: dict) -> tuple[str, bool, str]:
    out_path = OUT_DIR / f"{slug}.webp"
    if out_path.exists():
        return slug, True, "déjà présent"
    fov = field_of_view_deg(info.get("size_arcmin"))
    pos = f"{info['ra_deg']},{info['dec_deg']}"
    last_err = ""
    for survey in SURVEYS:
        params = {"Position": pos, "Survey": survey, "Pixels": SIZE_PX, "Size": f"{fov:.4f}", "Return": "JPEG"}
        url = f"{BASE_URL}?{urllib.parse.urlencode(params)}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "astrodex-ngc-fetch/1.0"})
            with urllib.request.urlopen(req, timeout=40) as r:
                data = r.read()
            if len(data) < 800:  # réponse trop petite : pas d'imagerie à cette position/relevé
                last_err = f"{survey}: réponse vide"
                continue
            img = Image.open(io.BytesIO(data)).convert("L").convert("RGB")
            OUT_DIR.mkdir(parents=True, exist_ok=True)
            img.save(out_path, "WEBP", quality=82, method=4)
            return slug, True, survey
        except (urllib.error.URLError, OSError, Image.UnidentifiedImageError) as exc:
            last_err = f"{survey}: {exc}"
            continue
    return slug, False, last_err


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    items = list(manifest.items())
    if args.limit:
        items = items[: args.limit]

    todo = [(s, d) for s, d in items if not (OUT_DIR / f"{s}.webp").exists()]
    print(f"{len(items)} objets, {len(items) - len(todo)} déjà téléchargés, {len(todo)} restants",
          file=sys.stderr)

    done, failed = 0, {}
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(fetch_one, s, d): s for s, d in todo}
        for fut in as_completed(futures):
            slug, ok, info = fut.result()
            done += 1
            if not ok:
                failed[slug] = info
            if done % 50 == 0 or done == len(todo):
                elapsed = time.time() - t0
                rate = done / elapsed if elapsed else 0
                remaining = (len(todo) - done) / rate if rate else 0
                print(f"  {done}/{len(todo)} ({len(failed)} échecs) — "
                      f"{rate:.1f}/s, ~{remaining / 60:.0f} min restantes", file=sys.stderr)

    if failed:
        FAIL_LOG.write_text(json.dumps(failed, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n⚠ {len(failed)} échecs consignés dans {FAIL_LOG.relative_to(ROOT)}", file=sys.stderr)
    print(f"\nTerminé : {len(items) - len(failed)}/{len(items)} images disponibles dans "
          f"{OUT_DIR.relative_to(ROOT)}", file=sys.stderr)


if __name__ == "__main__":
    main()
