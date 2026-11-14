# AMBLAS

**Seeing the ground beneath Bandung, from orbit.**
An open map of ground motion over the Bandung Basin, Indonesia, built from NASA-ISRO NISAR radar interferograms.

Team 404 Reika Not Found · NASA Space Apps Challenge 2026 (Bandung) · Challenge: Dancing with the SARs

> Independent student project. Not affiliated with or endorsed by NASA or ISRO.

## Status on 14 November 2026

| Part | State |
|---|---|
| NISAR data located | **Done.** 34 L2 GUNW granules over the basin, 19 Jun to 18 Oct 2026 (NASA CMR). |
| Processing pipeline | **Done, tested on synthetic data only.** 8 automated tests pass. |
| Real NISAR granules processed | **Not yet.** Needs an Earthdata Login. `fetch.py` has never touched the live archive. |
| Web app | **Done.** Tested in headless Chrome in the no-data and simulated states, desktop and phone width. |
| Phase sign convention | **Unverified.** See `pipeline/amblas/config.py`. |

The app shows no displacement value until real data has been processed. That is intentional.

## Quick start

```bash
pip install -r requirements.txt

# 1. Look at the app (no data needed)
cd web && python -m http.server 8000        # open http://localhost:8000

# 2. Check the software end to end with labelled synthetic data (new terminal, from the repo root)
cd pipeline
python -m pytest tests -q
python -m amblas simulate
python -m amblas process --input ../data/simulated   # app now shows a SIMULATED banner
python -m amblas clear                               # back to the empty state

# Optional: rebuild web/data/inventory.json from the saved CMR snapshot (add --live to query NASA CMR now)
python -m amblas inventory
```

## Running on real NISAR data

1. Create a free account at https://urs.earthdata.nasa.gov and set the credentials in your shell. Never commit them.
   ```bash
   export EARTHDATA_USERNAME=...   EARTHDATA_PASSWORD=...
   pip install earthaccess
   ```
2. Fetch one track. Track 082 (ascending) and track 090 (descending) each cover all four focus areas.
   ```bash
   cd pipeline
   python -m amblas fetch --track 082                  # streams and keeps only the basin window
   python -m amblas fetch --track 082 --mode download  # alternative: full granules, about 2.2 GB each
   ```
3. Confirm the file layout on the first granule before trusting anything.
   ```bash
   python -m amblas inspect ../data/gunw/track_082/<file>.h5
   ```
4. Optional: crop the full granules to the basin so they can be committed (Git LFS).
   ```bash
   python -m amblas subset --input ../data/gunw/track_082 --out ../data/gunw_subset/track_082
   ```
5. Process and publish to the app.
   ```bash
   python -m amblas process --input ../data/gunw/track_082
   ```

If `fetch` fails, download the granules by hand from https://search.asf.alaska.edu (dataset NISAR, product GUNW, draw a box over Bandung), put them in one folder per track and run step 4.

## Architecture

```
NASA CMR (search) ──► inventory.py ──► web/data/inventory.json, footprints.geojson
ASF DAAC (GUNW HDF5) ─► fetch.py ──► data/gunw/track_XXX/*.h5      (basin window only)
                                          │
                     gunw.py   read phase, coherence, components, ionosphere, grid
                     insar.py  mask ► remove ionosphere ► phase→LOS mm ► reference ► stack
                     raster.py GeoTIFF + PNG overlay + per-location samples
                                          │
                     process.py ──► web/data/results/manifest.json + rasters
                                          │
                     web/ (static: HTML + ES modules + Leaflet) reads the JSON and draws it
```

There is no backend server. The pipeline writes files and the web app reads them, so the demo runs from any static host or from a laptop without internet (the basemap falls back to a coordinate grid).

| Folder | Contents |
|---|---|
| `pipeline/amblas/` | Python package. One module per step. |
| `pipeline/tests/` | End-to-end tests on synthetic data with a known answer. |
| `data/inventory/` | CMR snapshot the inventory was built from. |
| `web/` | The application. `web/data/` holds reference data and published results. |
| `data/gunw_subset/` | Real NISAR pairs (track 082, 19 Jun to 25 Jul 2026) cropped to the basin, a few MB each, stored with Git LFS. Sources and checksums in its `README.md`. |
| `data/gunw/` | Full granules, about 2.2 GB each. Not committed: GitHub rejects files over 2 GB. |
| `data/simulated/` | Labelled synthetic GUNW files written by `amblas simulate` (not committed). |
| `docs/` | `METHODOLOGY.md`: data, processing steps, limits. `PITCH.md`: submission text, pitch (EN/ID), demo script, judge Q&A, checklist. |

## Dependencies

Python 3.10+: `numpy`, `h5py`, `rasterio`, `pillow`, `pytest`. Optional: `earthaccess` for downloads. The web app has no build step. Leaflet 1.9.4 is vendored in `web/vendor/` (BSD-2-Clause).

ISCE3 and MintPy are not used. NASA already delivers unwrapped, geocoded interferograms, so SLC-level processing would add days of work and no accuracy at this stage.

## What AMBLAS does not claim

It reports relative **line-of-sight** change, not vertical subsidence. It applies no tropospheric correction. Four months of data cannot give an annual rate. It attributes no cause and predicts nothing. Full list: the Limitations page in the app and `docs/METHODOLOGY.md`.

## Data and references

NISAR data courtesy of NASA and ISRO, distributed by the Alaska Satellite Facility DAAC. Basemap © OpenStreetMap contributors. Papers consulted are listed with DOIs in `web/data/studies.json` and on the Research page. They were checked at abstract level only.

## Licence

MIT. See `LICENSE`.
