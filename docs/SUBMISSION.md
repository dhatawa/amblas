# AMBLAS: final submission text (state on the night of 14 November 2026)

This is the **[A] version**: three real NISAR pairs over Bandung (track 082, 19 Jun to 25 Jul 2026) have been processed. The result is dominated by atmosphere, and the text says so.

Field names below follow the Space Apps project form as used in recent years. Check them against the 2026 form; paste each block into the matching field.

---

## Project name
AMBLAS

## Challenge
Dancing with the SARs

## Links
- Live app: https://dhatawa.github.io/amblas/
- Source code: https://github.com/dhatawa/amblas

## High-level summary (about 130 words)

Parts of the Bandung Basin in Indonesia have been sinking for decades, according to published GPS and radar studies, yet that knowledge sits in journal papers residents rarely see. AMBLAS is an open web map and a reproducible Python pipeline that turns NASA-ISRO NISAR Level-2 unwrapped interferograms into relative line-of-sight ground-motion maps. We found 34 NISAR interferograms over the basin and processed the first three real pairs (19 June to 25 July 2026). The pipeline works end to end on real data. The first map followed the mountains around the basin, the signature of atmospheric water vapour. A per-pair elevation correction removed that pattern; what remains sits within the noise, so we claim no subsidence yet. The app lets you switch between both maps, play the change date by date and read the value at any point.

## Project details

**What it does.** AMBLAS answers one question for anyone in the Bandung Basin: what does satellite radar say about the ground here, and how far can that be trusted? The app shows where NISAR observes the basin, what earlier research reported for Gedebage, Rancaekek, Dayeuhkolot and Cimahi, and, once data is processed, a line-of-sight displacement layer with its uncertainty.

**How it works.** NASA CMR search → NISAR L2 GUNW HDF5 (ASF DAAC) → read only the basin window → mask (coherence ≥ 0.30, unwrapping component ≠ 0) → subtract the ionospheric phase screen supplied with the product → convert phase to millimetres along the line of sight → reference to the basin median → stack the pairs of one track → GeoTIFF, map overlay and per-location summaries → static web app (HTML, JavaScript, Leaflet). No server is needed; the demo also runs offline.

**Where it stands.**
- Done: data inventory (34 granules, tracks 082 and 090 cover all four areas, 19 Jun to 18 Oct 2026).
- Done: pipeline with 9 automated tests on synthetic data, including recovery of a known displacement patch.
- Done: first real run, track 082, three 12-day pairs, 19 Jun to 25 Jul 2026. Wavelength 24.2 cm read from the files, ionospheric screen removed, 86% of pixels valid.
- Finding: uncorrected, the line-of-sight change followed topography (basin floor toward the satellite, volcanoes away). A per-pair phase-elevation fit (−6.7, −12.8, −41.1 mm per km of height) removed that pattern. The four focus areas now read −5.9 to +9.2 mm, all within the noise. A broad north-south gradient of about 25 mm remains. No subsidence is claimed: at Bandung's published average rate, 36 days would give only about 7 mm.
- Not done: weather-model correction of the remaining atmosphere; the other six track-082 pairs; the descending track 090 and decomposition into vertical motion; comparison with ground measurements.

**What it does not claim.** It reports relative line-of-sight change, not vertical subsidence. Four months of data cannot give an annual rate. It attributes no cause and makes no forecast. Values under 15 mm, or under twice their own uncertainty, are treated as noise because only the terrain-following part of the atmosphere is corrected.

**Why it matters.** It points the newest open L-band radar data at a documented local problem and states every limit in plain language, so residents, researchers and local government can read the same map and know how far to trust it.

**Tools.** Python (numpy, h5py, rasterio, Pillow, pytest), optional earthaccess; HTML, CSS, JavaScript, Leaflet 1.9.4; GitHub Pages.

## NASA data
- NISAR L2 Geocoded Unwrapped Interferogram (GUNW), collection `NISAR_L2_GUNW_PROVISIONAL_V1`, distributed by the Alaska Satellite Facility DAAC: https://search.asf.alaska.edu/
- NASA Common Metadata Repository (granule search, frame footprints): https://cmr.earthdata.nasa.gov/
- NISAR Data User Guide: https://nisar-docs.asf.alaska.edu/
- NISAR mission: https://science.nasa.gov/mission/nisar/

## Other data and references
- Basemap © OpenStreetMap contributors.
- Ge et al. 2014, Remote Sensing of Environment 154, 46-60. doi:10.1016/j.rse.2014.08.004
- Abidin et al. 2008, Journal of Applied Geodesy 2(3). doi:10.1515/JAG.2008.019
- Du et al. 2018, Int. J. Applied Earth Observation and Geoinformation 67, 54-68. doi:10.1016/j.jag.2018.01.001
- Rygus et al. 2025, Journal of Hydrology: Regional Studies 57, 102129. doi:10.1016/j.ejrh.2024.102129
- Chaussard et al. 2013, Remote Sensing of Environment 128, 150-161. doi:10.1016/j.rse.2012.10.015

## Use of AI (fill in honestly, edit before submitting)

We used Claude (Anthropic) as a coding and writing assistant: to search NASA's catalogue and the literature, scaffold the Python pipeline and web app, write tests, draft documentation and pitch text, and help read the first result. The team [describe what you did yourselves: chose the problem and the challenge, reviewed the code, downloaded the NISAR granules, ran the pipeline locally, edited the text, ...]. Scientific claims were limited to what the cited abstracts and NASA documentation state. No AI-generated images or data are presented as observations; simulated test data is labelled as such in the app.

## Tags
SAR, InSAR, NISAR, land subsidence, Bandung, Indonesia, groundwater, open data, web map
