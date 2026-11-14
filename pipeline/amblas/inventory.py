"""Build the NISAR data inventory for the area of interest.

Two sources:
  * a CSV saved from NASA CMR (works offline, ships with the repo)
  * a live CMR query (no login needed for searching)
"""
from __future__ import annotations

import csv
import io
import json
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

from . import config

# Corner coordinates of each track/frame as returned by CMR on 2026-11-14.
# (lon, lat) rings. Used to draw footprints and to test which locations a
# track actually covers.
FOOTPRINTS = {
    ("082", "A", "174"): [(109.82574, -7.91842), (109.36639, -5.77086), (107.12629, -6.2413), (107.57192, -8.38264)],
    ("090", "D", "092"): [(107.66294, -5.8069), (107.21619, -7.89486), (109.46614, -8.35836), (109.89922, -6.27638)],
    ("010", "A", "174"): [(107.76038, -7.92351), (107.30091, -5.77593), (105.04886, -6.24885), (105.49433, -8.39022)],
    ("018", "D", "092"): [(105.58548, -5.7384), (105.08755, -8.06496), (107.34852, -8.52998), (107.83104, -6.21008)],
}


def parse_granule_name(name: str) -> dict:
    """Split a GUNW granule name into the fields we rely on.

    Example:
    NISAR_L2_PR_GUNW_023_082_A_174_024_4000_SH_20260619T223102_20260619T223137_
    20260701T223102_20260701T223136_P05023_N_F_J_001
    """
    p = name.replace(".h5", "").split("_")
    if len(p) < 20 or p[0] != "NISAR" or p[3] != "GUNW":
        raise ValueError(f"not a NISAR GUNW granule name: {name}")
    ref = datetime.strptime(p[11], "%Y%m%dT%H%M%S")
    sec = datetime.strptime(p[13], "%Y%m%dT%H%M%S")
    return {
        "granule": name.replace(".h5", ""),
        "product": p[3],
        "ref_cycle": p[4],
        "track": p[5],
        "direction": "ascending" if p[6] == "A" else "descending",
        "direction_code": p[6],
        "frame": p[7],
        "sec_cycle": p[8],
        "mode_code": p[9],
        "pol_code": p[10],
        "ref_date": ref.strftime("%Y-%m-%d"),
        "sec_date": sec.strftime("%Y-%m-%d"),
        "ref_time_utc": ref.strftime("%H:%M:%S"),
        "baseline_days": (sec.date() - ref.date()).days,
        "crid": p[15],
        "trailing_flags": "_".join(p[16:]),
    }


def point_in_ring(lon: float, lat: float, ring: list[tuple[float, float]]) -> bool:
    inside = False
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        if (y1 > lat) != (y2 > lat):
            if lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
                inside = not inside
    return inside


def read_csv_text(text: str) -> list[dict]:
    rows = []
    for r in csv.DictReader(io.StringIO(text)):
        name = (r.get("Granule UR") or "").strip()
        if not name:
            continue
        item = parse_granule_name(name)
        size = r.get("Size") or ""
        item["size_mb"] = round(float(size), 1) if size else None
        rows.append(item)
    rows.sort(key=lambda d: (d["track"], d["ref_date"]))
    return rows


def query_cmr(aoi: dict | None = None, timeout: int = 60) -> str:
    """Ask NASA CMR for every GUNW granule touching the AOI. Returns CSV text."""
    aoi = aoi or config.AOI
    q = urllib.parse.urlencode({
        "short_name": config.COLLECTION,
        "bounding_box": f"{aoi['west']},{aoi['south']},{aoi['east']},{aoi['north']}",
        "page_size": 2000,
        "sort_key": "start_date",
    })
    with urllib.request.urlopen(f"{config.CMR_GRANULES}.csv?{q}", timeout=timeout) as resp:
        return resp.read().decode("utf-8")


def summarise(rows: list[dict], locations: list[dict]) -> dict:
    tracks = {}
    for r in rows:
        key = (r["track"], r["direction_code"], r["frame"])
        t = tracks.setdefault(key, {
            "track": r["track"], "direction": r["direction"], "frame": r["frame"],
            "pairs": 0, "first_date": r["ref_date"], "last_date": r["sec_date"],
            "baselines_days": [], "connected_chain": True, "covers": [],
            "_prev_sec": None,
        })
        if t["_prev_sec"] not in (None, r["ref_date"]):
            t["connected_chain"] = False
        t["_prev_sec"] = r["sec_date"]
        t["pairs"] += 1
        t["last_date"] = max(t["last_date"], r["sec_date"])
        t["baselines_days"].append(r["baseline_days"])
    out = []
    for key, t in tracks.items():
        t.pop("_prev_sec")
        ring = FOOTPRINTS.get(key)
        t["footprint_known"] = ring is not None
        if ring:
            t["covers"] = [loc["id"] for loc in locations if point_in_ring(loc["lon"], loc["lat"], ring)]
        d0 = datetime.strptime(t["first_date"], "%Y-%m-%d")
        d1 = datetime.strptime(t["last_date"], "%Y-%m-%d")
        t["span_days"] = (d1 - d0).days
        out.append(t)
    out.sort(key=lambda t: (-len(t["covers"]), t["track"]))
    return {"tracks": out, "granule_count": len(rows)}


def footprints_geojson() -> dict:
    feats = []
    for (track, direction, frame), ring in FOOTPRINTS.items():
        feats.append({
            "type": "Feature",
            "properties": {"track": track, "direction": "ascending" if direction == "A" else "descending", "frame": frame},
            "geometry": {"type": "Polygon", "coordinates": [[list(c) for c in ring] + [list(ring[0])]]},
        })
    return {"type": "FeatureCollection", "features": feats}


def build(csv_path: Path | None = None, live: bool = False) -> dict:
    """Write web/data/inventory.json and web/data/footprints.geojson."""
    if live:
        text = query_cmr()
        source = "NASA CMR live query"
        retrieved = datetime.utcnow().strftime("%Y-%m-%d")
        (config.INVENTORY_DIR / f"cmr_gunw_bandung_{retrieved}.csv").write_text(text)
    else:
        csv_path = csv_path or sorted(config.INVENTORY_DIR.glob("cmr_gunw_bandung_*.csv"))[-1]
        text = csv_path.read_text()
        source = f"NASA CMR snapshot ({csv_path.name})"
        retrieved = csv_path.stem.split("_")[-1]
    rows = read_csv_text(text)
    locations = json.loads((config.WEB_DATA / "locations.json").read_text())["locations"]
    inv = {
        "collection": config.COLLECTION,
        "source": source,
        "retrieved": retrieved,
        "aoi": config.AOI,
        "product_note": "L2 GUNW: geocoded unwrapped interferogram, 80 m posting, nearest-neighbour pairs. "
                        "Provisional quality: calibrated, partially validated.",
        **summarise(rows, locations),
        "granules": rows,
    }
    (config.WEB_DATA / "inventory.json").write_text(json.dumps(inv, indent=1))
    (config.WEB_DATA / "footprints.geojson").write_text(json.dumps(footprints_geojson()))
    return inv
