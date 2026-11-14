# AMBLAS: final submission text (state on the night of 14 November 2026)

This is the **[B] version**: real NISAR granules over Bandung have **not** been processed. If that changes before the deadline, switch to the [A] lines in `PITCH.md` and update the status table in `README.md` first.

Field names below follow the Space Apps project form as used in recent years. Check them against the 2026 form; paste each block into the matching field.

---

## Project name
AMBLAS

## Challenge
Dancing with the SARs

## Links
- Live app: https://dhatawa.github.io/amblas/
- Source code: https://github.com/dhatawa/amblas

## High-level summary (about 120 words)

Parts of the Bandung Basin in Indonesia have been sinking for decades, according to published GPS and radar studies, yet that knowledge sits in journal papers residents rarely see. AMBLAS is an open web map and a reproducible Python pipeline that turns NASA-ISRO NISAR Level-2 unwrapped interferograms into relative line-of-sight ground-motion maps. We found 34 NISAR interferograms over the basin in NASA's catalogue; two tracks view our four focus areas from opposite sides. The pipeline masks unreliable pixels, removes the ionospheric phase screen, converts phase to millimetres and stacks consecutive 12-day pairs. It is verified on synthetic data with a known answer; the real Bandung granules are not yet processed, so the map deliberately shows no displacement rather than an invented one.

## Project details

**What it does.** AMBLAS answers one question for anyone in the Bandung Basin: what does satellite radar say about the ground here, and how far can that be trusted? The app shows where NISAR observes the basin, what earlier research reported for Gedebage, Rancaekek, Dayeuhkolot and Cimahi, and, once data is processed, a line-of-sight displacement layer with its uncertainty.

**How it works.** NASA CMR search → NISAR L2 GUNW HDF5 (ASF DAAC) → read only the basin window → mask (coherence ≥ 0.30, unwrapping component ≠ 0) → subtract the ionospheric phase screen supplied with the product → convert phase to millimetres along the line of sight → reference to the basin median → stack the pairs of one track → GeoTIFF, map overlay and per-location summaries → static web app (HTML, JavaScript, Leaflet). No server is needed; the demo also runs offline.

**Where it stands.**
- Done: data inventory (34 granules, tracks 082 and 090 cover all four areas, 19 Jun to 18 Oct 2026).
- Done: pipeline with 9 automated tests on synthetic data, including recovery of a known displacement patch.
- Done: the file reader was checked on a real NISAR GUNW granule and found the interferogram group, coordinates and projection. That granule lay outside Bandung.
- Not done: processing real granules over Bandung; ascending/descending decomposition into vertical motion; tropospheric correction; comparison with ground measurements.

**What it does not claim.** It reports relative line-of-sight change, not vertical subsidence. Four months of data cannot give an annual rate. It attributes no cause and makes no forecast. Values under 15 mm are treated as noise because tropospheric delay is not corrected.

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
- Chaussard et al. 2013, Remote Sensing of Environment 128, 150-161. doi:10.1016/j.rse.2012.10.015 (details still to be confirmed)

## Use of AI (fill in honestly, edit before submitting)

We used Claude (Anthropic) as a coding and writing assistant: to search NASA's catalogue and the literature, scaffold the Python pipeline and web app, write tests, and draft documentation and pitch text. The team [describe what you did yourselves: chose the problem and the challenge, reviewed the code, ran the pipeline locally, checked the real NISAR file, edited the text, ...]. Scientific claims were limited to what the cited abstracts and NASA documentation state. No AI-generated images or data are presented as observations; simulated test data is labelled as such in the app.

## Tags
SAR, InSAR, NISAR, land subsidence, Bandung, Indonesia, groundwater, open data, web map
