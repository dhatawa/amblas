# AMBLAS methodology

## 1. Data

| Property | Value | Source |
|---|---|---|
| Product | NISAR L2 GUNW, collection `NISAR_L2_GUNW_PROVISIONAL_V1` | NASA CMR |
| Content | Unwrapped phase and coherence at 80 m, connected components, ionospheric phase screen | NISAR Data User Guide |
| Pairing | Nearest-neighbour pairs, 12 days (one 24-day pair per track) | Granule names |
| Quality level | Provisional: calibrated, partially validated | Collection description |
| Coverage of the basin | 4 track/frames, 34 granules, 19 Jun to 18 Oct 2026 | CMR query, 14 Nov 2026 |

Tracks that contain all four focus areas:

| Track | Direction | Frame | Pairs | Window | Chain |
|---|---|---|---|---|---|
| 082 | ascending | 174 | 9 | 19 Jun to 17 Oct 2026 | unbroken |
| 090 | descending | 092 | 9 | 20 Jun to 18 Oct 2026 | unbroken |

Tracks 010 and 018 only clip the western edge of the basin. Coverage was computed by testing each focus-area coordinate against the frame polygons returned by CMR.

HDF5 paths used (as listed by CMR for this collection):

```
/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/unwrappedPhase
/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/coherenceMagnitude
/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/connectedComponents
/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/ionospherePhaseScreen
```

`xCoordinates`, `yCoordinates`, `projection` and `centerFrequency` are located by name. Their position was not confirmed on a real file: run `python -m amblas inspect` first.

## 2. Steps and the reason for each

1. **Window.** Read only the pixels over the search box (107.35–107.95°E, 6.75–7.15°S).
2. **Mask.** Keep a pixel when coherence ≥ 0.30, connected component ≠ 0 and the phase is finite. Coherence 0.30 is a common starting value, not a tuned one. Report it if you change it.
3. **Ionosphere.** Subtract the ionospheric phase screen. The product documentation says the screen is supplied and not applied. L-band is far more sensitive to the ionosphere than C-band, especially near the equator.
4. **Convert.** `d_LOS = −λ/(4π) · φ`. One full cycle equals λ/2, about 12 cm. λ comes from `centerFrequency` in each file. The code refuses to guess it.
5. **Reference.** Subtract the median of the valid pixels. Interferograms carry an unknown constant, so all values are relative.
6. **Stack.** `rate = Σd / ΣΔt` over the valid pairs of a pixel, at least three pairs required. Cumulative change = rate × window length. Uncertainty = standard error of the per-pair rates × window length.
7. **Summarise.** Median within 500 m of each focus-area coordinate, with valid-pixel fraction and local spread.

## 3. What limits the result

**Troposphere.** Not corrected. For an unbroken chain the sum of pairs equals (last pass − first pass), so the delay of those two dates stays in the cumulative value in full. The stated uncertainty measures pair-to-pair scatter and does not capture this. The app therefore treats |d| < 15 mm as noise. Fifteen millimetres is a working threshold chosen from the general size of tropical water-vapour delay, not measured for this site.

**Expected signal.** Published rates reach roughly 10 to 20 cm/yr at the fastest sites, which would be about 3 to 7 cm in four months if those rates still hold. Slower areas will sit inside the noise. A null result at a location is therefore not evidence of stability.

**Geometry.** One track gives one line of sight. With ascending (082) and descending (090) results on a common grid and the incidence angles from the product metadata, vertical and east-west motion can be separated:

```
d_asc  = u·cosθa − e·sinθa·cos(αa) ...   (two equations, two unknowns: up u, east e)
d_desc = u·cosθd − e·sinθd·cos(αd) ...
```

The exact coefficients depend on the LOS unit vectors stored in each file. This step is not implemented. Until it is, do not call the result subsidence.

**Sign.** `LOS_SIGN = −1` in `config.py` (positive = toward the satellite) matches MintPy, whose NISAR reader (`prep_nisar.py`) loads `unwrappedPhase` without a sign change and converts with −λ/4π. That is consistency with a widely used tool, not a ground check. Confirm on a site with known motion (GNSS).

**Other.** Unwrapping errors (whole-cycle jumps), decorrelation over paddy fields and water, relative referencing that hides basin-wide motion, provisional product quality, no ground truth from 2026.

## 4. Wording rules used in the app

| Say | Do not say |
|---|---|
| preliminary LOS displacement indicator | subsidence rate |
| experimental InSAR result | measured sinking |
| spatial consistency with earlier studies | validated against earlier studies |
| associated in the literature with groundwater extraction | caused by groundwater extraction |
| supports monitoring and decisions | prevents floods |

## 5. Verification done so far

- Unit and end-to-end tests on synthetic files: the stack recovers a known −0.25 mm/day patch to within 0.5 mm, removes a constant ionosphere and an arbitrary offset, masks a low-coherence strip, and refuses to mix tracks.
- Inventory test: 34 granules, 9 pairs on tracks 082 and 090, coverage as stated above.
- Web app opened in headless Chrome in the empty and simulated states: all seven sections, track filter, place and coordinate search, layer toggles, 390 px width, no script errors.
- Real-file check (14 Nov 2026): a real GUNW granule from track 141 was opened. The reader located the unwrapped-interferogram group, a polarisation group containing `unwrappedPhase`, `xCoordinates`, `yCoordinates` and `projection`, then correctly reported that the frame does not overlap the Bandung AOI.
- First Bandung run (14 Nov 2026): three track-082 pairs, 19 Jun to 25 Jul 2026. All layers read from the real files, including `centerFrequency` (wavelength 24.2 cm) and the ionospheric screen. Valid pixels 86%; 2nd to 98th percentile of the LOS change −57 to +34 mm; median pair-scatter uncertainty 19 mm.

  | Location | LOS (mm) | ± (mm) | Valid pixels | Mean coherence |
  |---|---|---|---|---|
  | Gedebage | +7.7 | 9.2 | 91% | 0.59 |
  | Rancaekek | +22.4 | 19.1 | 82% | 0.66 |
  | Dayeuhkolot | +15.6 | 3.7 | 96% | 0.78 |
  | Cimahi | +1.8 | 10.3 | 98% | 0.78 |

  Reading: the map is dominated by a pattern that follows topography, blue (toward) over the basin floor and orange (away) over the surrounding volcanoes and highlands. Because the stack of an unbroken chain equals the last pass minus the first, this is most simply explained by a difference in tropospheric water vapour between 19 June and 25 July. A reversed sign convention would also make known subsidence areas look positive. Neither can be separated from ground motion with this data, so no subsidence is claimed. Next tests: correct the troposphere (weather model, or a fit of phase against elevation), add the remaining six track-082 pairs and the descending track 090, and check the sign on a site with independent GPS.
- Not verified: any live download through `fetch.py`; the phase sign convention.
