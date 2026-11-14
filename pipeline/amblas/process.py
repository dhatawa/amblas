"""Run the whole chain on a folder of GUNW files and publish to the web app."""
from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from . import config, raster
from .gunw import read_pair
from .insar import stack_pairs

EMPTY_MANIFEST = {"status": "none", "message": "No displacement raster has been processed yet."}


def clear() -> None:
    if config.RESULTS.exists():
        shutil.rmtree(config.RESULTS)
    config.RESULTS.mkdir(parents=True)
    (config.RESULTS / "manifest.json").write_text(json.dumps(EMPTY_MANIFEST, indent=1))


def run(input_dir: Path, coh_min: float = config.COH_MIN, min_pairs: int = config.MIN_PAIRS,
        limit_mm: float | None = None, note: str | None = None) -> dict:
    files = sorted(Path(input_dir).glob("NISAR_L2_*GUNW*.h5"))
    if not files:
        raise SystemExit(f"No GUNW .h5 files in {input_dir}")
    pairs = [read_pair(f) for f in files]
    tracks = {f.name.split("_")[5] for f in files}
    if len(tracks) != 1:
        raise SystemExit(f"Found tracks {sorted(tracks)}: process one track per run (different viewing geometry).")

    st = stack_pairs(pairs, coh_min=coh_min, min_pairs=min_pairs)
    p0 = pairs[0]
    simulated = any(p.simulated for p in pairs)

    config.RESULTS.mkdir(parents=True, exist_ok=True)
    finite = st.cumulative_mm[np.isfinite(st.cumulative_mm)]
    if finite.size == 0:
        raise SystemExit("No pixel passed the quality mask. Lower --coh-min or --min-pairs and say so in the write-up.")
    if limit_mm is None:
        limit_mm = float(max(10.0, np.ceil(np.nanpercentile(np.abs(finite), 98) / 5) * 5))

    tags = {"units": "mm, line of sight, relative to AOI median", "simulated": simulated}
    raster.write_geotiff(config.RESULTS / "los_cumulative_mm.tif", st.cumulative_mm, p0.x, p0.y, p0.epsg, tags)
    raster.write_geotiff(config.RESULTS / "los_sigma_mm.tif", st.sigma_mm, p0.x, p0.y, p0.epsg, tags)
    raster.write_geotiff(config.RESULTS / "n_pairs.tif", st.n_pairs.astype("float32"), p0.x, p0.y, p0.epsg)
    bounds = raster.write_overlay(config.RESULTS / "los_cumulative.png", st.cumulative_mm, p0.x, p0.y, p0.epsg, limit_mm)

    layers = {"cumulative_mm": st.cumulative_mm, "sigma_mm": st.sigma_mm,
              "n_pairs": st.n_pairs.astype("float32"), "mean_coherence": st.mean_coherence}
    locations = json.loads((config.WEB_DATA / "locations.json").read_text())["locations"]
    samples = {loc["id"]: raster.sample_location(loc["lon"], loc["lat"], p0.x, p0.y, p0.epsg, layers, config.SAMPLE_RADIUS_M)
               for loc in locations}

    info = files[0].name.split("_")
    manifest = {
        "status": "simulated" if simulated else "nisar",
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
        "label": "SIMULATED TEST PATTERN - not a measurement" if simulated
                 else "Experimental NISAR InSAR result - preliminary LOS displacement indicator",
        "quantity": "Relative line-of-sight displacement over the observation window",
        "units": "mm",
        "sign": "negative = away from the satellite, positive = toward the satellite"
                + ("" if simulated else " (convention matches MintPy; not checked against GNSS)"),
        "reference": "median of all valid pixels in the AOI",
        "track": info[5], "direction": "ascending" if info[6] == "A" else "descending", "frame": info[7],
        "polarisation": p0.pol,
        "wavelength_cm": round(p0.wavelength_m * 100, 2),
        "first_date": st.first_date, "last_date": st.last_date, "span_days": st.span_days,
        "pairs_used": [{"ref": p.ref_date, "sec": p.sec_date, "days": p.baseline_days} for p in sorted(pairs, key=lambda p: p.ref_date)],
        "chain_connected": st.connected,
        "settings": {"coherence_min": coh_min, "min_pairs": min_pairs, "ionosphere_screen_removed": any(p.iono is not None for p in pairs),
                     "troposphere_correction": "none", "sample_radius_m": config.SAMPLE_RADIUS_M},
        "stats": {"valid_pixel_fraction": round(float(np.isfinite(st.cumulative_mm).mean()), 3),
                  "p02_mm": round(float(np.nanpercentile(finite, 2)), 1), "p98_mm": round(float(np.nanpercentile(finite, 98)), 1),
                  "median_sigma_mm": round(float(np.nanmedian(st.sigma_mm)), 2)},
        "overlay": {"file": "los_cumulative.png", "bounds": bounds, "colour_limit_mm": limit_mm},
        "downloads": ["los_cumulative_mm.tif", "los_sigma_mm.tif", "n_pairs.tif"],
        "locations": samples,
        "notes": sorted({n for p in pairs for n in p.notes}),
        "analyst_note": note,
    }
    (config.RESULTS / "manifest.json").write_text(json.dumps(manifest, indent=1))
    return manifest
