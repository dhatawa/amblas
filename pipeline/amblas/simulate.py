"""Write synthetic files with the same internal layout as a NISAR GUNW.

Purpose: test the pipeline and the web app end to end without real data.
Every file carries the attribute amblas_simulated = 1, which the pipeline
propagates to the manifest and the web app turns into a SIMULATED banner.

The pattern is deliberately artificial (a flat field plus one square test
patch in the north-east corner of the AOI). It is NOT modelled on any
published subsidence map and must never be presented as a measurement.
"""
from __future__ import annotations

from pathlib import Path

import h5py
import numpy as np
from rasterio.warp import transform_bounds

from . import config

EPSG = 32748                       # UTM zone 48S
CENTRE_FREQ_HZ = 1.25e9            # arbitrary L-band test value, not a NISAR mode
PATCH_MM_PER_DAY = -0.25           # known answer the tests look for
CHAIN = ["20260619", "20260701", "20260713", "20260725", "20260818", "20260830"]


def patch_mask(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Square test patch, fixed in map coordinates (north-east of the AOI)."""
    a = config.AOI
    w, s, e, n = transform_bounds("EPSG:4326", f"EPSG:{EPSG}", a["west"], a["south"], a["east"], a["north"])
    xx, yy = np.meshgrid(x, y)
    x0 = w + 0.80 * (e - w)
    y0 = s + 0.85 * (n - s)
    return (np.abs(xx - x0) < 2500) & (np.abs(yy - y0) < 2500)


def write_files(out_dir: Path, seed: int = 7, noise_rad: float = 0.05) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(seed)
    a = config.AOI
    w, s, e, n = transform_bounds("EPSG:4326", f"EPSG:{EPSG}", a["west"] - 0.05, a["south"] - 0.05, a["east"] + 0.05, a["north"] + 0.05)
    x = np.arange(w, e, 80.0)
    y = np.arange(n, s, -80.0)
    patch = patch_mask(x, y)
    wavelength = config.SPEED_OF_LIGHT / CENTRE_FREQ_HZ
    paths = []
    for i, (d0, d1) in enumerate(zip(CHAIN, CHAIN[1:])):
        days = (np.datetime64(f"{d1[:4]}-{d1[4:6]}-{d1[6:]}") - np.datetime64(f"{d0[:4]}-{d0[4:6]}-{d0[6:]}")) / np.timedelta64(1, "D")
        los_mm = np.where(patch, PATCH_MM_PER_DAY * float(days), 0.0)
        phase = los_mm / 1000.0 * 4 * np.pi / wavelength / config.LOS_SIGN
        iono = np.full(phase.shape, 0.3, "float32")              # constant screen, must be removed
        phase = phase + iono + 1.7 + rng.normal(0, noise_rad, phase.shape)   # 1.7 rad = arbitrary offset
        coh = np.full(phase.shape, 0.7, "float32")
        coh[:, : phase.shape[1] // 6] = 0.1                       # a low-coherence strip to exercise masking
        cc = np.ones(phase.shape, "uint16")
        name = (f"NISAR_L2_PR_GUNW_{23 + i:03d}_999_A_999_{24 + i:03d}_4000_SH_{d0}T223102_{d0}T223137_"
                f"{d1}T223102_{d1}T223136_SIMULATED_N_F_J_001.h5")
        path = out_dir / name
        with h5py.File(path, "w") as h5:
            h5.attrs["amblas_simulated"] = 1
            base = h5.create_group(config.GUNW_BASE)
            base["xCoordinates"] = x
            base["yCoordinates"] = y
            proj = base.create_dataset("projection", data=np.uint32(EPSG))
            proj.attrs["epsg_code"] = EPSG
            g = base.create_group("HH")
            g.create_dataset("unwrappedPhase", data=phase.astype("float32"), compression="gzip")
            g.create_dataset("coherenceMagnitude", data=coh, compression="gzip")
            g.create_dataset("connectedComponents", data=cc, compression="gzip")
            g.create_dataset("ionospherePhaseScreen", data=iono, compression="gzip")
            h5["/science/LSAR/GUNW/grids/frequencyA/centerFrequency"] = CENTRE_FREQ_HZ
        paths.append(path)
    return paths
