"""Put a digital elevation model on the same grid as the interferograms.

Any DEM GeoTIFF(s) covering the AOI will do. The Copernicus GLO-30 tiles for
the Bandung Basin are free and need no login:
  https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S07_00_E107_00_DEM/Copernicus_DSM_COG_10_S07_00_E107_00_DEM.tif
  https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S08_00_E107_00_DEM/Copernicus_DSM_COG_10_S08_00_E107_00_DEM.tif
(Copernicus DEM, (c) DLR e.V. 2010-2014 and (c) Airbus Defence and Space GmbH
2014-2018, provided under COPERNICUS by the European Union and ESA.)
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import rasterio
from rasterio.merge import merge
from rasterio.warp import Resampling, reproject

from .raster import north_up, transform_of


def height_on_grid(dem_files: list[Path], x: np.ndarray, y: np.ndarray, epsg: int) -> np.ndarray:
    """Average the DEM into each 80 m cell. Returned in the same row order as `y`."""
    srcs = [rasterio.open(f) for f in dem_files]
    try:
        mosaic, tr = merge(srcs)
        crs, nodata = srcs[0].crs, srcs[0].nodata
    finally:
        for s in srcs:
            s.close()
    dst_tr, _, _ = transform_of(x, y)
    out = np.full((y.size, x.size), np.nan, "float32")
    reproject(mosaic[0].astype("float32"), out, src_transform=tr, src_crs=crs, src_nodata=nodata,
              dst_transform=dst_tr, dst_crs=f"EPSG:{epsg}", dst_nodata=np.nan, resampling=Resampling.average)
    out = north_up(out, y)            # transform_of describes a north-up grid
    if not np.isfinite(out).any():
        raise ValueError("the DEM does not cover the interferogram grid")
    return out if y[0] > y[-1] else out[::-1]


def circles_mask(points_lonlat: list[tuple[float, float]], x: np.ndarray, y: np.ndarray, epsg: int,
                 radius_m: float) -> np.ndarray:
    """True inside any circle: used to keep known deformation areas out of the elevation fit."""
    from rasterio.warp import transform
    xs, ys = transform("EPSG:4326", f"EPSG:{epsg}", [p[0] for p in points_lonlat], [p[1] for p in points_lonlat])
    xx, yy = np.meshgrid(x, y)
    m = np.zeros(xx.shape, bool)
    for cx, cy in zip(xs, ys):
        m |= (xx - cx) ** 2 + (yy - cy) ** 2 <= radius_m ** 2
    return m
