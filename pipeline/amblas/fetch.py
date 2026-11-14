"""Get real NISAR GUNW data from NASA Earthdata (ASF DAAC).

Needs a free Earthdata Login: https://urs.earthdata.nasa.gov
Credentials are read from the environment (EARTHDATA_USERNAME /
EARTHDATA_PASSWORD) or ~/.netrc. Never put them in the source code.

Two modes:
  subset   (default) stream each granule and save only the AOI window as a
           small HDF5 with the same internal paths (a few MB instead of ~2 GB)
  download save the full granules

NOT YET TESTED against the live archive: this module was written without
network access to ASF. Expect to adjust it on first contact.
"""
from __future__ import annotations

from pathlib import Path

import h5py
import numpy as np

from . import config
from .gunw import read_pair


def _earthaccess():
    try:
        import earthaccess
    except ImportError as exc:
        raise SystemExit("Install the optional dependency first:  pip install earthaccess") from exc
    earthaccess.login(strategy="environment") or earthaccess.login(strategy="netrc") or earthaccess.login()
    return earthaccess


def search(track: str, start: str = "2026-06-01", end: str = "2026-12-31"):
    ea = _earthaccess()
    a = config.AOI
    results = ea.search_data(short_name=config.COLLECTION,
                             bounding_box=(a["west"], a["south"], a["east"], a["north"]),
                             temporal=(start, end))
    keep = [g for g in results if f"_{track}_" in g["meta"]["native-id"]]
    return ea, keep


def write_subset(pair, path: Path) -> None:
    """Save a cropped pair using the same dataset paths as the original."""
    with h5py.File(path, "w") as h5:
        base = h5.create_group(config.GUNW_BASE)
        base["xCoordinates"] = pair.x
        base["yCoordinates"] = pair.y
        proj = base.create_dataset("projection", data=np.uint32(pair.epsg))
        proj.attrs["epsg_code"] = pair.epsg
        g = base.create_group(pair.pol)
        g.create_dataset("unwrappedPhase", data=pair.phase, compression="gzip")
        g.create_dataset("coherenceMagnitude", data=pair.coherence, compression="gzip")
        if pair.conncomp is not None:
            g.create_dataset("connectedComponents", data=pair.conncomp, compression="gzip")
        if pair.iono is not None:
            g.create_dataset("ionospherePhaseScreen", data=pair.iono, compression="gzip")
        h5["/science/LSAR/GUNW/grids/frequencyA/centerFrequency"] = config.SPEED_OF_LIGHT / pair.wavelength_m
        h5.attrs["amblas_subset_of"] = pair.name
        h5.attrs["amblas_simulated"] = 0


def run(track: str, out_dir: Path, mode: str = "subset") -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    ea, granules = search(track)
    if not granules:
        raise SystemExit(f"No GUNW granules found for track {track}")
    print(f"{len(granules)} granules on track {track}")
    if mode == "download":
        return [Path(p) for p in ea.download(granules, str(out_dir))]
    saved = []
    for g, fobj in zip(granules, ea.open(granules)):
        name = g["meta"]["native-id"]
        target = out_dir / f"{name}.h5"
        if target.exists():
            print("skip (exists):", target.name)
        else:
            print("subsetting:", name)
            write_subset(read_pair(fobj, name=name), target)
        saved.append(target)
    return saved
