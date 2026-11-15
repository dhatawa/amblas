# AMBLAS

**Seeing the ground beneath Bandung, from orbit.**
An open map of ground motion over the Bandung Basin, Indonesia, built from NASA-ISRO NISAR radar interferograms.

Team 404 Reika Not Found · NASA Space Apps Challenge 2026 (Bandung) · Challenge: Dancing with the SARs

> Independent student project. Not affiliated with or endorsed by NASA or ISRO.

Live app: https://dhatawa.github.io/amblas/

## Status on 14 November 2026

| Part | State |
|---|---|
| NISAR data located | **Done.** 34 L2 GUNW granules over the basin, 19 Jun to 18 Oct 2026 (NASA CMR). |
| Processing pipeline | **Done.** 9 automated tests pass on synthetic data. |
| Real NISAR granules processed for Bandung | **Done, experimental.** Track 082, 3 pairs, 19 Jun to 25 Jul 2026 (36 days). Wavelength read from the files: 24.2 cm. 86% of pixels valid. Granules downloaded by hand from ASF; `fetch.py` has still never touched the live archive. |
| What the result shows | **Atmosphere first, no subsidence claim yet.** Uncorrected, the pattern followed topography (basin floor toward the satellite, mountains away). A per-pair phase-elevation fit (−6.7, −12.8, −41.1 mm/km, Copernicus GLO-30 DEM) removed it. What remains is a broad north-south gradient of about 25 mm, and all four focus areas sit within the noise: Gedebage −5.9 ± 8.0, Rancaekek +9.2 ± 16.1, Dayeuhkolot +2.0 ± 8.8, Cimahi −8.3 ± 13.4 mm. |
| Web app | **Done.** Live on GitHub Pages; shows the result with its analyst note. |
| Phase sign convention | **Consistent with MintPy, not yet checked on the ground.** MintPy's NISAR reader uses the phase as delivered with −λ/4π, positive = toward the satellite, the same as AMBLAS. A GNSS comparison is still needed. |

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
3. Check that every file covers Bandung, then confirm the layout on the first one.
   ```bash
   python -m amblas check ../data/gunw/track_082/*.h5
   python -m amblas inspect ../data/gunw/track_082/NISAR_L2_PR_GUNW_023_082_A_174_024_4000_SH_20260619T223102_20260619T223137_20260701T223102_20260701T223136_P05023_N_F_J_001.h5
   ```
   On Windows PowerShell, `*.h5` is not expanded for you: pass the file names, or use
   `python -m amblas check (Get-ChildItem ..\data\gunw\track_082\*.h5).FullName`.
4. Optional: crop the full granules to the basin so they can be committed (Git LFS).
   ```bash
   python -m amblas subset --input ../data/gunw/track_082 --out ../data/gunw_subset/track_082
   ```
5. Process and publish to the app. With a DEM, each pair also gets a phase-versus-elevation (troposphere) correction, and the app shows a before/after switch.
   ```bash
   python -m amblas process --input ../data/gunw/track_082 --dem ../data/dem/*.tif
   ```
   Free DEM tiles for the basin (Copernicus GLO-30, no login):
   - https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S07_00_E107_00_DEM/Copernicus_DSM_COG_10_S07_00_E107_00_DEM.tif
   - https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S08_00_E107_00_DEM/Copernicus_DSM_COG_10_S08_00_E107_00_DEM.tif

   Every run also writes one map per acquisition date (date slider and per-location charts in the app) and `grid.json`, which lets the app show the value at any clicked point. Results include PNGs that `.gitignore` skips: publish with `git add -f web/data/results`.
6. Already have results but no `grid.json`? `python -m amblas grid` rebuilds it from the published GeoTIFFs.

If `fetch` fails, download the granules by hand from https://search.asf.alaska.edu (dataset NISAR, product GUNW, draw a box over Bandung), put them in one folder per track and run step 5.

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
| `docs/` | `SUBMISSION.md`: final text to paste into the Space Apps form. `METHODOLOGY.md`: data, processing steps, limits. `PITCH.md`: submission text, pitch (EN/ID), demo script, judge Q&A, checklist. |

## Dependencies

Python 3.10+: `numpy`, `h5py`, `rasterio`, `pillow`, `pytest`. Optional: `earthaccess` for downloads. The web app has no build step. Leaflet 1.9.4 is vendored in `web/vendor/` (BSD-2-Clause).

ISCE3 and MintPy are not used. NASA already delivers unwrapped, geocoded interferograms, so SLC-level processing would add days of work and no accuracy at this stage.

## What AMBLAS does not claim

It reports relative **line-of-sight** change, not vertical subsidence. It applies no tropospheric correction. Four months of data cannot give an annual rate. It attributes no cause and predicts nothing. Full list: the Limitations page in the app and `docs/METHODOLOGY.md`.

## Data and references

NISAR data courtesy of NASA and ISRO, distributed by the Alaska Satellite Facility DAAC. Basemap © OpenStreetMap contributors. Papers consulted are listed with DOIs in `web/data/studies.json` and on the Research page. They were checked at abstract level only.

## Licence

MIT. See `LICENSE`.
