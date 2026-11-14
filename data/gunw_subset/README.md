# NISAR GUNW subsets (Bandung Basin window)

Real NISAR L2 GUNW pairs, cropped to the AMBLAS search box (107.35–107.95°E, 6.75–7.15°S).
Each file keeps the original HDF5 paths for the layers the pipeline reads: unwrapped phase,
coherence, connected components, ionospheric phase screen, coordinates, projection and
centre frequency. Everything else in the granule is dropped. The files are stored with Git LFS.

The full granules (about 2.2 GB each) are **not** in this repository. GitHub rejects files
over 2 GB, and the originals are permanently available from the Alaska Satellite Facility DAAC.

## Files

| Track | Pair | Grid (rows × cols, 80 m) | Subset of granule |
|---|---|---|---|
| 082 A, frame 174 | 2026-06-19 → 2026-07-01 | 559 × 833 | `NISAR_L2_PR_GUNW_023_082_A_174_024_4000_SH_20260619T223102_20260619T223137_20260701T223102_20260701T223136_P05023_N_F_J_001` |
| 082 A, frame 174 | 2026-07-01 → 2026-07-13 | 559 × 833 | `NISAR_L2_PR_GUNW_024_082_A_174_025_4000_SH_20260701T223102_20260701T223136_20260713T223101_20260713T223136_P05023_N_F_J_001` |
| 082 A, frame 174 | 2026-07-13 → 2026-07-25 | 559 × 833 | `NISAR_L2_PR_GUNW_025_082_A_174_026_4000_SH_20260713T223101_20260713T223136_20260725T223100_20260725T223135_P05023_N_F_J_001` |

## Getting the full granules

Search https://search.asf.alaska.edu (dataset NISAR, product GUNW) for the granule names above,
or run `python -m amblas fetch --track 082 --mode download` with an Earthdata Login.
Put them in `data/gunw/track_082/` and check them against these SHA-256 sums:

```
ed5337ab830f374177172f191856a62aa8c57127da59cbdbfa7e8497d3afdb37  NISAR_L2_PR_GUNW_023_082_A_174_024_4000_SH_20260619T223102_20260619T223137_20260701T223102_20260701T223136_P05023_N_F_J_001.h5
c838e4bd298253a94408cb46b4aff42f59384a6f5a460ca3f94f94aacc38dd36  NISAR_L2_PR_GUNW_024_082_A_174_025_4000_SH_20260701T223102_20260701T223136_20260713T223101_20260713T223136_P05023_N_F_J_001.h5
27aa7246f67f692cbeff2fe3872d0c12f64d88818381d4a7216051d7335809b3  NISAR_L2_PR_GUNW_025_082_A_174_026_4000_SH_20260713T223101_20260713T223136_20260725T223100_20260725T223135_P05023_N_F_J_001.h5
```

To rebuild these subsets from the full granules:

```bash
cd pipeline
python -m amblas subset --input ../data/gunw/track_082 --out ../data/gunw_subset/track_082
```

## Credit

NISAR data courtesy of NASA and ISRO, distributed by the Alaska Satellite Facility DAAC.
