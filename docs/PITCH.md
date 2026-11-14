# AMBLAS: pitch, demo and submission pack

Lines marked **[A]** apply if real NISAR data has been processed. Lines marked **[B]** apply if it has not. Say only the one that is true on the day.

## Project abstract (submission, about 130 words)

Parts of the Bandung Basin, home to millions, have been sinking for decades according to published GPS and radar studies. That knowledge sits in journal papers most residents will never read. AMBLAS takes Level-2 unwrapped interferograms from the NASA-ISRO NISAR mission, first released in July 2026, and turns them into an open web map of line-of-sight ground motion. A reproducible Python pipeline masks unreliable pixels, removes the ionospheric phase screen, converts phase to millimetres and stacks consecutive 12-day pairs. The app sets each result beside earlier research for Gedebage, Rancaekek, Dayeuhkolot and Cimahi, and states plainly what a four-month radar record can and cannot show. **[A]** It presents a first experimental NISAR result for the basin. **[B]** The pipeline is verified on synthetic data and ready for the 18 real pairs NASA's catalogue lists over Bandung.

## Problem statement

Land subsidence in the Bandung Basin is documented in the scientific literature and is hard for the public to see. Existing maps are static figures in papers, tied to satellites that have stopped operating (ENVISAT, ALOS) and to study periods that ended years ago. There is no open, updatable view built on current data.

## Innovation statement

1. **New data.** Among the first open applications of NISAR L-band interferograms to the Bandung Basin. The public record began on 19 June 2026.
2. **Honesty as a feature.** The app separates measured, referenced and simulated content, shows nothing where it has nothing, and explains line of sight versus vertical in plain language.
3. **Reusable.** Changing one search box points the same pipeline at Jakarta, Semarang or any other sinking city.

## Use of NASA data

- NISAR L2 GUNW from the Alaska Satellite Facility DAAC: unwrapped phase, coherence, connected components, ionospheric phase screen.
- NASA Common Metadata Repository: granule search and frame footprints.
- The data is the core. Without the interferograms there is no product, only a list of references.

## Impact

Residents can find their district and read what is known. Researchers get a scripted starting point for NISAR time series over the basin. Local government gets a common reference for where closer monitoring may be worthwhile. AMBLAS informs decisions. It does not prevent floods or stop subsidence.

## Limitations (say these before a judge asks)

Line of sight, not vertical. Four months of data. No tropospheric correction. Relative to the basin median. Provisional product. Sign convention unverified. No ground truth.

## Future development

Ascending plus descending decomposition into vertical motion · tropospheric correction from weather models · monthly automatic updates as NISAR passes accumulate · comparison with GPS and monitoring wells · a Bahasa Indonesia interface.

## Two-minute pitch (English)

"Bandung is sinking. That is not our claim. GPS surveys in the early 2000s found sites that dropped seventy centimetres in five years, and radar studies have mapped it since. But try to find out what is happening under your own neighbourhood today, and you hit a paywalled paper about a satellite that died in 2011.

In July, NASA and ISRO opened the data from NISAR, a radar satellite that passes over Bandung every twelve days and sees through cloud. We asked a simple question: can a student team turn that into something a resident can read?

This is AMBLAS. We found thirty-four NISAR interferograms over the basin in NASA's catalogue. Two tracks cover Gedebage, Rancaekek, Dayeuhkolot and Cimahi from opposite sides. Our pipeline masks bad pixels, removes the ionosphere, converts radar phase to millimetres and stacks the pairs.

**[A]** Tonight we ran it on three real NISAR pairs over Bandung, nineteenth of June to twenty-fifth of July. It works end to end. And the first map taught us something: the colours follow the mountains, not the neighbourhoods. That is water vapour in the air between two dates, not the ground moving. So we are not claiming subsidence from thirty-six days of data, and the app tells you exactly why.
**[B]** We have verified the pipeline on synthetic data with a known answer. We have not yet processed the real granules, so the map shows no displacement. We would rather show you an empty layer than an invented one.

What we are proudest of is what the app refuses to say. It reports line-of-sight change, not subsidence. It tells you four months is too short for a yearly rate. It labels every limit.

From space-based radar observations to local ground movement awareness. That is AMBLAS."

## Pitch dua menit (Bahasa Indonesia)

"Bandung sedang turun. Itu bukan klaim kami. Survei GPS awal 2000-an menemukan titik yang turun sekitar tujuh puluh sentimeter dalam lima tahun, dan penelitian radar memetakannya sejak itu. Tetapi kalau warga ingin tahu apa yang terjadi di bawah lingkungannya hari ini, yang tersedia hanya jurnal berbayar tentang satelit yang sudah mati sejak 2011.

Juli lalu NASA dan ISRO membuka data NISAR, satelit radar yang melintasi Bandung setiap dua belas hari dan menembus awan. Pertanyaan kami sederhana: bisakah tim mahasiswa mengubahnya menjadi sesuatu yang bisa dibaca warga?

Ini AMBLAS. Kami menemukan tiga puluh empat interferogram NISAR di atas Cekungan Bandung dalam katalog NASA. Dua lintasan mencakup Gedebage, Rancaekek, Dayeuhkolot, dan Cimahi dari dua arah pandang. Pipeline kami membuang piksel yang tidak andal, mengoreksi ionosfer, mengubah fase radar menjadi milimeter, lalu menumpuk pasangan citranya.

**[A]** Malam ini kami menjalankannya pada tiga pasangan NISAR asli di atas Bandung, 19 Juni sampai 25 Juli. Pipeline-nya berjalan dari awal sampai akhir. Dan peta pertamanya mengajari kami sesuatu: warnanya mengikuti pegunungan, bukan permukiman. Itu jejak uap air di atmosfer antara dua tanggal, bukan gerak tanah. Jadi kami tidak mengklaim penurunan tanah dari data 36 hari, dan aplikasi menjelaskan alasannya.
**[B]** Pipeline sudah kami verifikasi dengan data sintetis yang jawabannya diketahui. Granule asli belum kami proses, jadi peta belum menampilkan displacement. Kami memilih menunjukkan layer kosong daripada angka karangan.

Yang paling kami banggakan justru apa yang tidak diklaim aplikasi ini. Yang dilaporkan adalah perubahan searah pandang satelit, bukan penurunan tanah vertikal. Empat bulan data belum cukup untuk laju tahunan. Setiap keterbatasan ditulis terang.

Dari pengamatan radar di orbit, menuju kesadaran akan gerak tanah di sekitar kita. Itulah AMBLAS."

## Three-minute demo script

| Time | Screen | Say |
|---|---|---|
| 0:00 | Overview | The problem in one sentence. Point at the four numbers: 34 interferograms, 2 full tracks, 120 days, 80 m. |
| 0:25 | Overview, status list | "Here is exactly where we stand." Read the DONE and PENDING rows. |
| 0:45 | Explore map | The search box, the four focus areas. Tick "NISAR frame footprints" to show the real frames. |
| 1:10 | Click Gedebage | Walk down the panel: tracks overhead, value or its absence, interpretation, earlier research with DOI, limits. |
| 1:40 | Methodology | The eight steps. Stop on the LOS-versus-vertical row of the table. |
| 2:05 | Research | The comparison table. Say "spatial consistency, not validation". |
| 2:25 | Limitations | "Twelve things we will not claim." Pick two. |
| 2:45 | Data sources | The inventory is downloadable and the query is one link. Close with the tagline. |

Backup: the app runs offline from `python -m http.server`. Keep screenshots of each step on the laptop. If the venue network is down the basemap becomes a coordinate grid and everything else works.

## Likely judge questions

**Your map is blue in the basin and orange on the mountains. Isn't that just atmosphere?**
Yes, that is our reading too. The stack of a connected chain equals the last pass minus the first, so the water vapour of 19 June and 25 July stays in it, and vapour delay scales with height. That is why the app attaches this note to every value and claims no subsidence. The fix is a tropospheric correction from a weather model, or fitting phase against elevation, plus more pairs.

**Why are all four values positive if these areas are known to sink?**
Most likely the atmosphere: a vapour difference between the two end dates shifts the whole basin floor together. We also checked our sign against MintPy, the standard open InSAR toolbox: it reads NISAR phase the same way and uses the same convention, so a reversed sign is less likely. It is still not checked against GPS.

**You only used 3 of 9 pairs. Why?**
Download size: each granule is about 2.2 GB. The remaining six pairs of track 082 are listed in the app and the pipeline takes them without changes.

**Is four months enough?**
Not for an annual rate, and we do not give one. It is enough to see fast-moving areas if historical rates still hold: ten centimetres a year would be about three centimetres in our window, above our noise threshold. Slower areas stay hidden.

**How do you separate atmosphere from ground motion?**
We do not, yet. We remove the ionospheric screen NASA supplies. The troposphere remains, which is why anything under 15 mm is labelled noise. Weather-model correction is the next step.

**Why not Sentinel-1, which has ten years of data?**
Sentinel-1 is the better tool for long-term rates and we would add it as a comparison layer. NISAR's L-band keeps coherence over vegetation better than C-band, and this challenge asks what NISAR can do.

**Is this subsidence?**
We measure line-of-sight change. Du et al. (2018) found vertical motion dominates in Bandung, which makes subsidence the likely reading, but confirming it needs both viewing directions. Both are available (tracks 082 and 090) and combining them is planned.

**How was it validated?**
The software is validated against synthetic data with a known answer. The result is not validated. We compare locations with published studies and call that a consistency check.

**What did AI do in this project?**
State it accurately for your team. Space Apps asks teams to disclose AI use in the submission: list the tools and what they produced (code scaffolding, text drafts), and what the team checked itself.

**Who would use this?**
Residents checking their district, researchers wanting a scripted NISAR starting point, and agencies deciding where ground surveys are worth the cost.

## Before submitting: checklist

- [ ] Read the full "Dancing with the SARs" statement on spaceappschallenge.org and confirm AMBLAS answers it.
- [ ] Push the code to a public repository and link it.
- [ ] Declare AI use as the submission form requires.
- [ ] Remove any claim in the abstract that is not true at submission time ([A] or [B]).
- [ ] Have one team member read at least Ge et al. 2014 in full.
