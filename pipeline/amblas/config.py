"""Shared settings for the AMBLAS pipeline. Everything tunable lives here."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB_DATA = ROOT / "web" / "data"
RESULTS = WEB_DATA / "results"
INVENTORY_DIR = ROOT / "data" / "inventory"

# Search box used for NASA CMR queries and for cropping rasters.
# This is a working rectangle, NOT the hydrogeological boundary of the basin.
AOI = {"west": 107.35, "south": -7.15, "east": 107.95, "north": -6.75}

COLLECTION = "NISAR_L2_GUNW_PROVISIONAL_V1"
CMR_GRANULES = "https://cmr.earthdata.nasa.gov/search/granules"

# HDF5 layout. Dataset names are the ones NASA CMR lists for this collection.
GUNW_BASE = "/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram"

# --- processing choices (documented in docs/METHODOLOGY.md) ---
COH_MIN = 0.30          # pixels below this coherence are discarded
MIN_PAIRS = 3           # a pixel needs at least this many valid pairs
SAMPLE_RADIUS_M = 500   # radius used when summarising a named location
TREND_EXCLUDE_RADIUS_M = 3000   # focus areas left out of the elevation fit

# Sign of the phase -> line-of-sight conversion.
#   d_LOS = LOS_SIGN * wavelength / (4*pi) * phase
# With -1, a positive result means motion TOWARD the satellite and a negative
# result means motion AWAY from it (which is what subsidence looks like).
# This matches MintPy, whose NISAR reader (prep_nisar.py) loads unwrappedPhase
# without a sign change and uses -wavelength/(4*pi), positive = toward the
# satellite. Checked against MintPy's code on 14 Nov 2026, not against GNSS:
# confirm on a site with known motion before interpreting direction.
LOS_SIGN = -1.0

SPEED_OF_LIGHT = 299_792_458.0
