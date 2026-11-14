"""The science steps: mask, correct, convert phase to line-of-sight, stack.

Each function does one thing so it can be tested on its own.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from . import config
from .gunw import Pair


def valid_mask(pair: Pair, coh_min: float = config.COH_MIN) -> np.ndarray:
    """True where a pixel is usable: finite, coherent, and unwrapped reliably."""
    ok = np.isfinite(pair.phase) & np.isfinite(pair.coherence) & (pair.coherence >= coh_min)
    if pair.conncomp is not None:
        ok &= pair.conncomp > 0      # component 0 = not reliably unwrapped
    return ok


def remove_ionosphere(pair: Pair) -> np.ndarray:
    """Subtract the ionospheric phase screen shipped with the product.

    The GUNW documentation states the screen is provided but NOT applied.
    """
    if pair.iono is None:
        return pair.phase
    iono = np.where(np.isfinite(pair.iono), pair.iono, 0.0)
    return pair.phase - iono


def phase_to_los_mm(phase: np.ndarray, wavelength_m: float, sign: float = config.LOS_SIGN) -> np.ndarray:
    """Radians of two-way phase -> millimetres along the radar line of sight."""
    return sign * wavelength_m / (4.0 * np.pi) * phase * 1000.0


def reference(d: np.ndarray, ok: np.ndarray, ref_mask: np.ndarray | None = None) -> np.ndarray:
    """Make the measurement relative to a reference area.

    InSAR is relative: every interferogram has an unknown constant offset.
    We remove the median over `ref_mask` (or over all valid pixels when none
    is given). Results therefore mean "relative to the reference area".
    """
    sel = ok if ref_mask is None else (ok & ref_mask)
    if not sel.any():
        return d
    return d - np.nanmedian(d[sel])


@dataclass
class Stack:
    cumulative_mm: np.ndarray    # LOS change over the whole window, relative
    sigma_mm: np.ndarray         # spread-based uncertainty of that value
    n_pairs: np.ndarray          # valid pairs behind each pixel
    mean_coherence: np.ndarray
    span_days: int
    first_date: str
    last_date: str
    connected: bool


def stack_pairs(pairs: list[Pair], coh_min: float = config.COH_MIN, min_pairs: int = config.MIN_PAIRS,
                ref_mask: np.ndarray | None = None, apply_iono: bool = True) -> Stack:
    """Average the rate of many short pairs, then scale to the full window.

    rate = sum(d_i) / sum(dt_i) over the valid pairs of each pixel.
    Pixels with fewer than `min_pairs` valid pairs are left empty (NaN).
    """
    pairs = sorted(pairs, key=lambda p: p.ref_date)
    shape = pairs[0].phase.shape
    for p in pairs:
        if p.phase.shape != shape or not (np.allclose(p.x, pairs[0].x) and np.allclose(p.y, pairs[0].y)):
            raise ValueError(f"{p.name} is on a different grid; stack one track/frame at a time")

    sum_d = np.zeros(shape, "float64")
    sum_t = np.zeros(shape, "float64")
    sum_r = np.zeros(shape, "float64")
    sum_r2 = np.zeros(shape, "float64")
    sum_c = np.zeros(shape, "float64")
    n = np.zeros(shape, "int16")

    for p in pairs:
        ok = valid_mask(p, coh_min)
        ph = remove_ionosphere(p) if apply_iono else p.phase
        d = reference(phase_to_los_mm(ph, p.wavelength_m), ok, ref_mask)
        d = np.where(ok, d, 0.0)
        rate = d / p.baseline_days
        sum_d += d
        sum_t += np.where(ok, p.baseline_days, 0)
        sum_r += rate
        sum_r2 += rate ** 2
        sum_c += np.where(ok, p.coherence, 0.0)
        n += ok

    enough = n >= min_pairs
    with np.errstate(invalid="ignore", divide="ignore"):
        rate = np.where(enough, sum_d / sum_t, np.nan)                 # mm / day
        var = np.where(n > 1, (sum_r2 - sum_r ** 2 / n) / (n - 1), np.nan)
        sem = np.sqrt(np.clip(var, 0, None) / n)                       # mm / day
        mean_c = np.where(n > 0, sum_c / n, np.nan)

    d0 = np.datetime64(pairs[0].ref_date)
    d1 = np.datetime64(max(p.sec_date for p in pairs))
    span = int((d1 - d0) / np.timedelta64(1, "D"))
    connected = all(a.sec_date == b.ref_date for a, b in zip(pairs, pairs[1:]))
    return Stack(cumulative_mm=(rate * span).astype("float32"),
                 sigma_mm=np.where(enough, sem * span, np.nan).astype("float32"),
                 n_pairs=n, mean_coherence=mean_c.astype("float32"), span_days=span,
                 first_date=pairs[0].ref_date, last_date=str(d1), connected=connected)
