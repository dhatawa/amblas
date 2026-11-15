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
        limit_mm: float | None = None, note: str | None = None, dem: list[Path] | None = None,
        exclude_radius_m: float = config.TREND_EXCLUDE_RADIUS_M) -> dict:
    files = sorted(Path(input_dir).glob("NISAR_L2_*GUNW*.h5"))
    if not files:
        raise SystemExit(f"No GUNW .h5 files in {input_dir}")
    pairs = [read_pair(f) for f in files]
    tracks = {f.name.split("_")[5] for f in files}
    if len(tracks) != 1:
        raise SystemExit(f"Found tracks {sorted(tracks)}: process one track per run (different viewing geometry).")

    p0 = pairs[0]
    simulated = any(p.simulated for p in pairs)
    locations = json.loads((config.WEB_DATA / "locations.json").read_text())["locations"]

    height = exclude = raw = None
    if dem:
        from .dem import circles_mask, height_on_grid
        height = height_on_grid([Path(d) for d in dem], p0.x, p0.y, p0.epsg)
        exclude = circles_mask([(l["lon"], l["lat"]) for l in locations], p0.x, p0.y, p0.epsg, exclude_radius_m)
        raw = stack_pairs(pairs, coh_min=coh_min, min_pairs=min_pairs)            # kept for a before/after view
    st = stack_pairs(pairs, coh_min=coh_min, min_pairs=min_pairs, height_m=height, exclude=exclude)

    for old in config.RESULTS.glob("los_epoch_*.png"):
        old.unlink()
    for old in ("los_cumulative_raw.png", "grid.json"):
        (config.RESULTS / old).unlink(missing_ok=True)
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
    raw_overlay = None
    if raw is not None:
        raster.write_overlay(config.RESULTS / "los_cumulative_raw.png", raw.cumulative_mm, p0.x, p0.y, p0.epsg, limit_mm)
        raw_overlay = "los_cumulative_raw.png"

    layers = {"cumulative_mm": st.cumulative_mm, "sigma_mm": st.sigma_mm,
              "n_pairs": st.n_pairs.astype("float32"), "mean_coherence": st.mean_coherence}
    if height is not None:
        layers["height_m"] = height
    samples = {loc["id"]: raster.sample_location(loc["lon"], loc["lat"], p0.x, p0.y, p0.epsg, layers, config.SAMPLE_RADIUS_M)
               for loc in locations}
    if raw is not None:      # the same summary before the atmosphere correction
        for loc in locations:
            r = raster.sample_location(loc["lon"], loc["lat"], p0.x, p0.y, p0.epsg,
                                       {"cumulative_mm": raw.cumulative_mm, "sigma_mm": raw.sigma_mm}, config.SAMPLE_RADIUS_M)
            samples[loc["id"]]["cumulative_mm_raw"] = r.get("cumulative_mm")
            samples[loc["id"]]["sigma_mm_raw"] = r.get("sigma_mm")

    # Time series: one map and one value per location for every acquisition date.
    epochs = []
    for i, (date, arr) in enumerate(zip(st.epoch_dates, st.epochs_mm)):
        f = f"los_epoch_{i:02d}.png"
        raster.write_overlay(config.RESULTS / f, arr, p0.x, p0.y, p0.epsg, limit_mm)
        epochs.append({"date": date, "file": f})
        for loc in locations:
            s = raster.sample_location(loc["lon"], loc["lat"], p0.x, p0.y, p0.epsg, {"cumulative_mm": arr}, config.SAMPLE_RADIUS_M)
            samples[loc["id"]].setdefault("series", []).append({"date": date, "mm": s.get("cumulative_mm")})

    grid_layers = {"los": st.cumulative_mm, "sigma": st.sigma_mm}
    if raw is not None:
        grid_layers["los_raw"] = raw.cumulative_mm
        grid_layers["sigma_raw"] = raw.sigma_mm
    if height is not None:
        grid_layers["height"] = height / 10.0     # stored in tenths, so this keeps metres within int16
    grid_meta = raster.write_grid(config.RESULTS / "grid.json", grid_layers, p0.x, p0.y, p0.epsg)

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
                     "troposphere_correction": "linear phase-elevation fit per pair" if height is not None else "none",
                     "trend_fit_excludes_m_around_focus_areas": exclude_radius_m if height is not None else None,
                     "elevation_coeffs_mm_per_km": st.elevation_coeffs or None,
                     "sample_radius_m": config.SAMPLE_RADIUS_M},
        "stats": {"valid_pixel_fraction": round(float(np.isfinite(st.cumulative_mm).mean()), 3),
                  "p02_mm": round(float(np.nanpercentile(finite, 2)), 1), "p98_mm": round(float(np.nanpercentile(finite, 98)), 1),
                  "median_sigma_mm": round(float(np.nanmedian(st.sigma_mm)), 2)},
        "overlay": {"file": "los_cumulative.png", "raw_file": raw_overlay, "bounds": bounds, "colour_limit_mm": limit_mm},
        "epochs": epochs,
        "grid": {"file": "grid.json", **grid_meta, "height_unit": "metres / 10" if height is not None else None},
        "downloads": ["los_cumulative_mm.tif", "los_sigma_mm.tif", "n_pairs.tif"],
        "locations": samples,
        "notes": sorted({n for p in pairs for n in p.notes}),
        "analyst_note": note,
    }
    (config.RESULTS / "manifest.json").write_text(json.dumps(manifest, indent=1))
    return manifest


def grid_from_results() -> dict:
    """Rebuild grid.json from the published GeoTIFFs (no GUNW files needed)."""
    import rasterio
    with rasterio.open(config.RESULTS / "los_cumulative_mm.tif") as src:
        los = src.read(1)
        epsg = src.crs.to_epsg()
        tr = src.transform
        x = tr.c + tr.a * (np.arange(src.width) + 0.5)
        y = tr.f + tr.e * (np.arange(src.height) + 0.5)
    with rasterio.open(config.RESULTS / "los_sigma_mm.tif") as src:
        sigma = src.read(1)
    meta = raster.write_grid(config.RESULTS / "grid.json", {"los": los, "sigma": sigma}, x, y, epsg)
    mpath = config.RESULTS / "manifest.json"
    m = json.loads(mpath.read_text())
    m["grid"] = {"file": "grid.json", **meta, "height_unit": None}
    mpath.write_text(json.dumps(m, indent=1))
    return m["grid"]
