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

# Sign of the phase -> line-of-sight conversion.
#   d_LOS = LOS_SIGN * wavelength / (4*pi) * phase
# With -1, a positive result means motion TOWARD the satellite and a negative
# result means motion AWAY from it (which is what subsidence looks like).
# This follows the common "phase grows with range" convention. It has NOT been
# checked against a real NISAR granule: confirm it in the product spec
# (JPL D-102272) or on a known deforming site before interpreting direction.
LOS_SIGN = -1.0

SPEED_OF_LIGHT = 299_792_458.0
