"""Turn arrays into files the web map can show: GeoTIFF, PNG overlay, samples."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.transform import from_origin
from rasterio.warp import Resampling, calculate_default_transform, reproject, transform

# Diverging ramp, colour-blind safe (orange = away from satellite, blue = toward).
_RAMP = np.array([
    (-1.0, 179, 68, 6), (-0.5, 240, 140, 60), (-0.15, 250, 215, 170),
    (0.0, 236, 236, 232),
    (0.15, 180, 215, 240), (0.5, 80, 150, 215), (1.0, 20, 70, 150),
], dtype="float64")


def transform_of(x: np.ndarray, y: np.ndarray):
    dx = float(abs(x[1] - x[0]))
    dy = float(abs(y[1] - y[0]))
    return from_origin(float(x.min()) - dx / 2, float(y.max()) + dy / 2, dx, dy), dx, dy


def north_up(a: np.ndarray, y: np.ndarray) -> np.ndarray:
    return a if y[0] > y[-1] else a[::-1]


def write_geotiff(path: Path, a: np.ndarray, x: np.ndarray, y: np.ndarray, epsg: int, tags: dict | None = None) -> None:
    tr, _, _ = transform_of(x, y)
    data = north_up(a, y).astype("float32")
    with rasterio.open(path, "w", driver="GTiff", height=data.shape[0], width=data.shape[1], count=1,
                       dtype="float32", crs=f"EPSG:{epsg}", transform=tr, nodata=np.nan, compress="deflate") as dst:
        dst.write(data, 1)
        if tags:
            dst.update_tags(**{k: str(v) for k, v in tags.items()})


def colourise(a: np.ndarray, limit: float) -> np.ndarray:
    """Float array -> RGBA. Values are clipped to [-limit, +limit]; NaN is transparent."""
    t = np.clip(a / limit, -1, 1)
    rgba = np.zeros(a.shape + (4,), "uint8")
    for ch in range(3):
        rgba[..., ch] = np.interp(np.nan_to_num(t), _RAMP[:, 0], _RAMP[:, ch + 1]).astype("uint8")
    rgba[..., 3] = np.where(np.isfinite(a), 215, 0)
    return rgba


def to_latlon(a: np.ndarray, x: np.ndarray, y: np.ndarray, epsg: int, step: int = 1):
    """Reproject a north-up projected grid to lat/lon. `step` > 1 coarsens it.

    Returns (array, [[south, west], [north, east]]).
    """
    src_tr, _, _ = transform_of(x, y)
    data = north_up(a, y).astype("float32")
    h, w = data.shape
    left, top = src_tr.c, src_tr.f
    right, bottom = left + src_tr.a * w, top + src_tr.e * h
    dst_tr, dw, dh = calculate_default_transform(f"EPSG:{epsg}", "EPSG:4326", w, h, left, bottom, right, top)
    if step > 1:
        dst_tr = dst_tr @ dst_tr.scale(step, step)
        dw, dh = -(-dw // step), -(-dh // step)
    out = np.full((dh, dw), np.nan, "float32")
    reproject(data, out, src_transform=src_tr, src_crs=f"EPSG:{epsg}", dst_transform=dst_tr, dst_crs="EPSG:4326",
              resampling=Resampling.nearest, src_nodata=np.nan, dst_nodata=np.nan)
    west, north = dst_tr.c, dst_tr.f
    east, south = west + dst_tr.a * dw, north + dst_tr.e * dh
    return out, [[round(south, 6), round(west, 6)], [round(north, 6), round(east, 6)]]


def write_overlay(path: Path, a: np.ndarray, x: np.ndarray, y: np.ndarray, epsg: int, limit: float) -> list[list[float]]:
    """Reproject to lat/lon and save a PNG. Returns [[south, west], [north, east]]."""
    out, bounds = to_latlon(a, x, y, epsg)
    Image.fromarray(colourise(out, limit), "RGBA").save(path, optimize=True)
    return bounds


def write_grid(path: Path, layers: dict[str, np.ndarray], x: np.ndarray, y: np.ndarray, epsg: int, step: int = 2) -> dict:
    """Save layers as a compact lat/lon grid the web app can read point values from.

    Each layer is int16 in tenths of a millimetre (or of a unit), base64-encoded,
    with -32768 for no data. At step 2 the cells are about 160 m.
    """
    import base64
    meta = None
    data = {}
    for name, arr in layers.items():
        out, bounds = to_latlon(arr, x, y, epsg, step)
        q = np.where(np.isfinite(out), np.clip(np.round(out * 10), -32767, 32767), -32768).astype("<i2")
        data[name] = base64.b64encode(q.tobytes()).decode("ascii")
        meta = {"rows": int(out.shape[0]), "cols": int(out.shape[1]), "bounds": bounds}
    grid = {**meta, "scale": 0.1, "nodata": -32768, "dtype": "int16-le", "layers": data}
    path.write_text(json.dumps(grid))
    return meta


def sample_location(lon: float, lat: float, x: np.ndarray, y: np.ndarray, epsg: int, layers: dict[str, np.ndarray],
                    radius_m: float) -> dict:
    """Median of each layer inside a circle around a point. None when no data."""
    xs, ys = transform("EPSG:4326", f"EPSG:{epsg}", [lon], [lat])
    xx, yy = np.meshgrid(x, y)
    inside = (xx - xs[0]) ** 2 + (yy - ys[0]) ** 2 <= radius_m ** 2
    total = int(inside.sum())
    if total == 0:
        return {"in_raster": False}
    out = {"in_raster": True, "pixels_in_circle": total}
    main = layers["cumulative_mm"][inside]
    good = np.isfinite(main)
    out["valid_fraction"] = round(float(good.mean()), 3)
    if not good.any():
        out["cumulative_mm"] = None
        return out
    for key, arr in layers.items():
        v = arr[inside][good]
        out[key] = round(float(np.nanmedian(v)), 2)
    out["spread_mm"] = round(float(np.nanstd(main[good])), 2)
    return out
