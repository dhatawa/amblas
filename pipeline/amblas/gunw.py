"""Read the layers AMBLAS needs from a NISAR L2 GUNW HDF5 file.

Dataset names come from the NASA CMR variable list for
NISAR_L2_GUNW_PROVISIONAL_V1. Coordinate and metadata datasets are located by
name instead of by a fixed path, because their exact position has moved
between product versions. Run `python -m amblas inspect FILE` on a real
granule before trusting a full run.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import h5py
import numpy as np
from rasterio.warp import transform_bounds

from . import config
from .inventory import parse_granule_name


@dataclass
class Pair:
    name: str
    ref_date: str
    sec_date: str
    baseline_days: int
    pol: str
    phase: np.ndarray            # unwrapped phase, radians
    coherence: np.ndarray
    conncomp: np.ndarray | None
    iono: np.ndarray | None      # ionospheric phase screen, radians
    x: np.ndarray                # easting of pixel centres, metres
    y: np.ndarray                # northing of pixel centres, metres
    epsg: int
    wavelength_m: float
    simulated: bool = False
    notes: list[str] = field(default_factory=list)


def _find(group: h5py.Group, name: str):
    """First dataset called `name` anywhere below `group`, or None."""
    hit = []

    def visit(path, obj):
        if isinstance(obj, h5py.Dataset) and path.split("/")[-1] == name and not hit:
            hit.append(obj)

    group.visititems(visit)
    return hit[0] if hit else None


def _epsg(ds: h5py.Dataset) -> int:
    for key in ("epsg_code", "epsg"):
        if key in ds.attrs:
            return int(np.asarray(ds.attrs[key]).ravel()[0])
    return int(np.asarray(ds[()]).ravel()[0])


def describe(path: str | Path) -> list[str]:
    """Human-readable tree of a GUNW file: use it to confirm the layout."""
    lines = []
    with h5py.File(path, "r") as h5:
        def visit(p, obj):
            if isinstance(obj, h5py.Dataset):
                lines.append(f"/{p}  shape={obj.shape} dtype={obj.dtype}")
        h5.visititems(visit)
    return lines


def read_pair(source, aoi: dict | None = None, name: str | None = None) -> Pair:
    """Read one interferometric pair, cropped to the AOI.

    `source` is a path or an open file-like object (for cloud streaming).
    Only the AOI window is read from disk, so a 2 GB granule costs little RAM.
    """
    aoi = aoi or config.AOI
    name = name or Path(str(source)).name
    info = parse_granule_name(name)
    notes: list[str] = []
    with h5py.File(source, "r") as h5:
        if config.GUNW_BASE not in h5:
            raise KeyError(f"{config.GUNW_BASE} not found in {name}. Run 'inspect' to see the layout.")
        base = h5[config.GUNW_BASE]
        pols = [k for k in base.keys() if isinstance(base[k], h5py.Group) and "unwrappedPhase" in base[k]]
        if not pols:
            raise KeyError(f"no polarisation group with unwrappedPhase under {config.GUNW_BASE}")
        pol = "HH" if "HH" in pols else pols[0]
        g = base[pol]

        xds = _find(base, "xCoordinates")
        yds = _find(base, "yCoordinates")
        pds = _find(base, "projection")
        if xds is None or yds is None or pds is None:
            raise KeyError("xCoordinates / yCoordinates / projection not found under the unwrapped interferogram group")
        x_all, y_all, epsg = xds[()], yds[()], _epsg(pds)

        w, s, e, n = transform_bounds("EPSG:4326", f"EPSG:{epsg}", aoi["west"], aoi["south"], aoi["east"], aoi["north"])
        cols = np.where((x_all >= w) & (x_all <= e))[0]
        rows = np.where((y_all >= s) & (y_all <= n))[0]
        if cols.size == 0 or rows.size == 0:
            raise ValueError(f"{name} does not overlap the AOI")
        r0, r1, c0, c1 = rows.min(), rows.max() + 1, cols.min(), cols.max() + 1

        def win(key):
            return g[key][r0:r1, c0:c1] if key in g else None

        phase = win("unwrappedPhase").astype("float32")
        coh = win("coherenceMagnitude").astype("float32")
        cc = win("connectedComponents")
        iono = win("ionospherePhaseScreen")
        if cc is None:
            notes.append("connectedComponents layer missing: unwrapping-quality mask not applied")
        if iono is None:
            notes.append("ionospherePhaseScreen layer missing: no ionospheric correction")

        fds = _find(h5["/science/LSAR/GUNW/grids/frequencyA"], "centerFrequency") or _find(h5, "centerFrequency")
        if fds is None:
            raise KeyError("centerFrequency not found: the radar wavelength cannot be derived, refusing to guess")
        wavelength = config.SPEED_OF_LIGHT / float(np.asarray(fds[()]).ravel()[0])
        simulated = bool(h5.attrs.get("amblas_simulated", 0))

    return Pair(name=info["granule"], ref_date=info["ref_date"], sec_date=info["sec_date"],
                baseline_days=info["baseline_days"], pol=pol, phase=phase, coherence=coh,
                conncomp=cc, iono=None if iono is None else iono.astype("float32"),
                x=x_all[c0:c1].astype("float64"), y=y_all[r0:r1].astype("float64"), epsg=epsg,
                wavelength_m=wavelength, simulated=simulated, notes=notes)
