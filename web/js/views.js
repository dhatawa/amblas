// Text pages. Each function returns an HTML string built from the loaded data.
import { esc, fmtDate, interpret, NOISE_FLOOR_MM } from "./util.js";

const fullTracks = (inv) => inv.tracks.filter((t) => t.covers.length === 4);

const SVG_GEOMETRY = `<svg viewBox="0 0 320 150" role="img" aria-label="A satellite looks sideways at the ground along a slanted line of sight">
  <line x1="10" y1="128" x2="310" y2="128" stroke="#6fae7a" stroke-width="2"/>
  <rect x="44" y="14" width="26" height="12" rx="2" fill="#3fd0e0"/><rect x="24" y="17" width="18" height="6" fill="#9db0c2"/><rect x="72" y="17" width="18" height="6" fill="#9db0c2"/>
  <line x1="57" y1="26" x2="220" y2="128" stroke="#3fd0e0" stroke-width="2" stroke-dasharray="5 4"/>
  <line x1="57" y1="26" x2="57" y2="128" stroke="#9db0c2" stroke-width="1" stroke-dasharray="2 4"/>
  <path d="M57 62a36 36 0 0 0 30-17" fill="none" stroke="#f2b34a" stroke-width="1.5"/>
  <text x="66" y="76" fill="#f2b34a" font-size="11">look angle</text>
  <text x="150" y="70" fill="#3fd0e0" font-size="11">line of sight (LOS)</text>
  <circle cx="220" cy="128" r="4" fill="#f2f6f9"/><text x="228" y="144" fill="#f2f6f9" font-size="11">ground target</text>
</svg>`;

const SVG_PHASE = `<svg viewBox="0 0 320 150" role="img" aria-label="Two radar passes return waves that are shifted when the ground has moved">
  <text x="8" y="22" fill="#9db0c2" font-size="11">Pass 1</text>
  <path d="M60 18 q10 -14 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="#3fd0e0" stroke-width="2"/>
  <text x="8" y="62" fill="#9db0c2" font-size="11">Pass 2</text>
  <path d="M67 58 q10 -14 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="#6fae7a" stroke-width="2"/>
  <line x1="60" y1="8" x2="60" y2="72" stroke="#f2b34a" stroke-dasharray="3 3"/><line x1="67" y1="8" x2="67" y2="72" stroke="#f2b34a" stroke-dasharray="3 3"/>
  <text x="74" y="92" fill="#f2b34a" font-size="11">phase shift = change in distance</text>
  <text x="8" y="122" fill="#f2f6f9" font-size="11">One full cycle of shift = half a wavelength</text>
  <text x="8" y="138" fill="#9db0c2" font-size="11">(about 12 cm for L-band radar)</text>
</svg>`;

const SVG_LOS = `<svg viewBox="0 0 320 150" role="img" aria-label="Vertical sinking is only partly seen along the slanted line of sight">
  <line x1="20" y1="40" x2="300" y2="40" stroke="#6fae7a" stroke-width="2"/>
  <line x1="20" y1="110" x2="300" y2="110" stroke="#6fae7a" stroke-width="2" stroke-dasharray="4 4"/>
  <line x1="150" y1="40" x2="150" y2="110" stroke="#f2f6f9" stroke-width="2.5"/><text x="158" y="80" fill="#f2f6f9" font-size="11">true vertical drop</text>
  <line x1="150" y1="110" x2="96" y2="18" stroke="#3fd0e0" stroke-width="1.5" stroke-dasharray="5 4"/>
  <line x1="150" y1="110" x2="118" y2="56" stroke="#3fd0e0" stroke-width="3"/><text x="20" y="92" fill="#3fd0e0" font-size="11">what the radar</text><text x="20" y="105" fill="#3fd0e0" font-size="11">measures (LOS)</text>
  <text x="20" y="140" fill="#9db0c2" font-size="11">Sideways motion also leaks into LOS: one track cannot separate them.</text>
</svg>`;

export function overview(s) {
  const inv = s.inventory, full = fullTracks(inv), done = s.manifest.status === "nisar";
  const span = full[0] ? `${fmtDate(full[0].first_date)} to ${fmtDate(full[0].last_date)}` : "";
  return `
<section class="hero">
  <div>
    <span class="eyebrow">NASA Space Apps 2026 &middot; Dancing with the SARs</span>
    <h1>Seeing the ground beneath Bandung, from orbit</h1>
    <p class="lead">Parts of the Bandung Basin have been sinking for decades, according to published GPS and radar studies. AMBLAS takes the newest open radar data from the NASA-ISRO NISAR satellite and turns it into a map anyone can read, with every limit stated.</p>
    <a class="btn" href="#map">Open the map</a><a class="btn ghost" href="#method">How it works</a>
  </div>
  <div class="facts">
    <div><span class="num">${inv.granule_count}</span><span>NISAR interferograms found over the basin</span></div>
    <div><span class="num">${full.length}</span><span>tracks covering all four focus areas (${full.map((t) => t.track + " " + t.direction).join(", ")})</span></div>
    <div><span class="num">${full[0]?.span_days ?? "-"} d</span><span>observation window, ${span}</span></div>
    <div><span class="num">80 m</span><span>pixel spacing of the unwrapped phase</span></div>
  </div>
</section>

<h2>Where the project stands</h2>
<ul class="steps">
  <li><span class="tag done">DONE</span><span>NISAR data located in NASA's catalogue: ${inv.granule_count} geocoded unwrapped interferograms (GUNW), checked ${esc(inv.retrieved)}.</span></li>
  <li><span class="tag done">DONE</span><span>Processing pipeline written and tested on synthetic files with a known answer.</span></li>
  <li><span class="tag ${done ? "done" : "wait"}">${done ? "DONE" : "PENDING"}</span><span>Real NISAR granules processed for the basin. ${done ? `Track ${esc(s.manifest.track)}, ${s.manifest.pairs_used.length} pairs.` : "Needs an Earthdata Login and about 20 GB of downloads per track, or cloud subsetting."}</span></li>
  <li><span class="tag ${done ? "wait" : "plan"}">${done ? "CAUTION" : "NEXT"}</span><span>${done ? "First result reviewed: the pattern follows topography, which points to tropospheric delay rather than ground motion. No subsidence is claimed yet." : "Review the first real result for atmospheric artefacts before reading any value."}</span></li>
  <li><span class="tag plan">NEXT</span><span>Correct the troposphere and confirm the phase sign convention against the NISAR product specification.</span></li>
  <li><span class="tag plan">NEXT</span><span>Combine ascending and descending tracks to separate vertical from east-west motion.</span></li>
  <li><span class="tag plan">NEXT</span><span>Compare against ground measurements (GPS, levelling, monitoring wells).</span></li>
</ul>

<h2>The story in six questions</h2>
<div class="grid">
  <div class="card"><span class="q">1 &middot; What is happening?</span><h3>The basin floor is not standing still</h3>
    <p>GPS surveys from 2000 to 2005 found a few sites that dropped by about 70 cm. Radar studies covering 2002 to 2011 mapped displacement around Cimahi, Dayeuhkolot, Rancaekek, Solokan Jeruk and Gedebage.</p><p><a href="#research">See the sources</a></p></div>
  <div class="card"><span class="q">2 &middot; Why care?</span><h3>Slow change, lasting consequences</h3>
    <p>Sinking ground can raise flood exposure, strain buildings and pipes, and alter how water drains. A modelling study estimates that part of the aquifer's storage is lost for good. AMBLAS does not measure these impacts. It maps the motion that may contribute to them.</p></div>
  <div class="card"><span class="q">3 &middot; How does radar see it?</span><h3>A sideways look, repeated</h3>${SVG_GEOMETRY}
    <p>The satellite sends microwaves at an angle and records the echo. It works at night and through cloud, which matters in the humid tropics.</p></div>
  <div class="card"><span class="q">3 &middot; continued</span><h3>Interferometry: comparing two passes</h3>${SVG_PHASE}
    <p>If the ground moved between two passes, the returning wave arrives slightly shifted. That shift, the phase, encodes the change in distance.</p></div>
  <div class="card"><span class="q">4 &middot; What can NISAR tell us?</span><h3>Line-of-sight change, every 12 days</h3>${SVG_LOS}
    <p>NISAR's L-band radar keeps its signal over vegetation better than shorter wavelengths. It measures change along its slanted view, which is not the same as vertical sinking.</p></div>
  <div class="card"><span class="q">5 &middot; Where to look?</span><h3>Four focus areas</h3>
    <p>${s.locations.locations.map((l) => esc(l.name)).join(", ")}. They were chosen because earlier research names them. They are not assumed to move at the same rate, and the map shows no rate for them until real data has been processed.</p><p><a href="#map">Go to the map</a></p></div>
  <div class="card"><span class="q">6 &middot; What is it for?</span><h3>Information, not prevention</h3>
    <p>AMBLAS cannot stop subsidence or prevent floods. It offers an open, repeatable view of ground motion that residents, researchers and local government can check, question and build on.</p></div>
  <div class="card"><span class="q">On causes</span><h3>Groundwater is part of the picture</h3>
    <p>Studies link the motion to groundwater extraction and to soil compaction under surface loads. One study found that industrial pumping is not always the main factor. AMBLAS observes motion only and makes no claim about its cause.</p></div>
</div>`;
}

export function method() {
  return `
<h1>Methodology</h1>
<p>AMBLAS starts from NISAR Level-2 GUNW products: interferograms that NASA has already co-registered, flattened, unwrapped and geocoded. That removes the heaviest processing and lets a small team work reproducibly in plain Python.</p>

<h2>Six quantities that are easy to confuse</h2>
<div class="tablewrap"><table>
<tr><th>Term</th><th>What it is</th><th>Does AMBLAS show it?</th></tr>
<tr><td>Radar backscatter</td><td>How strongly the surface returns the signal. Describes the surface, not motion.</td><td>No</td></tr>
<tr><td>Interferometric phase</td><td>Shift between two passes, in radians. Contains motion plus atmosphere, orbit and noise.</td><td>Input</td></tr>
<tr><td>Coherence</td><td>0 to 1 score of how alike the two passes are. Low over water, crops and dense vegetation.</td><td>Used as a quality mask</td></tr>
<tr><td>Line-of-sight (LOS) displacement</td><td>Change in distance between satellite and ground along the slanted view.</td><td><b>Yes, this is the map layer</b></td></tr>
<tr><td>Vertical displacement</td><td>Up or down motion. Needs two viewing directions or an assumption.</td><td>Not yet</td></tr>
<tr><td>Subsidence velocity</td><td>Vertical rate, usually per year. Needs a long, validated time series.</td><td>No. Four months is too short</td></tr>
</table></div>

<h2>Processing chain</h2>
<ul class="steps">
<li><span class="tag done">1 FIND</span><span>Query NASA's Common Metadata Repository for GUNW granules over the search area and group them by track and frame.</span></li>
<li><span class="tag done">2 READ</span><span>Open each HDF5 file and read only the window over the basin: unwrapped phase, coherence, connected components, ionosphere screen.</span></li>
<li><span class="tag done">3 MASK</span><span>Drop pixels with coherence below 0.30, pixels not reliably unwrapped (component 0) and invalid values.</span></li>
<li><span class="tag done">4 CORRECT</span><span>Subtract the ionospheric phase screen, which the product supplies but does not apply.</span></li>
<li><span class="tag done">5 CONVERT</span><span>Turn phase into millimetres along the line of sight.</span></li>
<li><span class="tag done">6 REFERENCE</span><span>Subtract the median of all valid pixels. Every value then means "relative to the basin-wide median".</span></li>
<li><span class="tag done">7 STACK</span><span>Average the rate across all pairs of one track, keep pixels with at least three valid pairs, scale to the full window.</span></li>
<li><span class="tag done">8 PUBLISH</span><span>Write GeoTIFFs, a map overlay, per-location summaries and a manifest recording every setting.</span></li>
</ul>
<div class="formula">d_LOS [mm] = -( wavelength / 4&pi; ) &times; phase &times; 1000<br>rate = &Sigma; d_i / &Sigma; &Delta;t_i &nbsp;&nbsp; cumulative = rate &times; window length</div>
<p>The wavelength is read from each file. The minus sign follows the common convention in which negative means motion away from the satellite. It has not been checked on a real NISAR granule yet.</p>

<h2>What the chain does not do</h2>
<div class="note"><p><b>No tropospheric correction.</b> Water vapour delays the signal by amounts that can reach centimetres in the tropics. For a connected chain of pairs the sum collapses to the last pass minus the first, so the atmosphere of those two dates stays in the result. AMBLAS treats anything under ${NOISE_FLOOR_MM} mm as indistinguishable from noise. That threshold is a working choice, not a calibrated figure.</p></div>
<p>The chain also performs no decomposition into vertical and horizontal motion, no correction for elevation-dependent delay and no check against ground instruments. Each is listed under <a href="#limits">Limitations</a>.</p>

<h2>Reading the map</h2>
<p>Orange means the distance to the satellite grew, which is what sinking ground produces. Blue means it shrank. Pale tones are close to zero. Blank areas failed the quality mask. A single track sees the ground from one side only, so strong horizontal motion could also appear as colour.</p>`;
}

export function data(s) {
  const inv = s.inventory;
  const rows = (track) => inv.granules.filter((g) => !track || g.track === track).map((g) => `<tr><td class="n">${g.ref_date}</td><td class="n">${g.sec_date}</td><td class="n">${g.baseline_days}</td><td class="n">${g.track} ${g.direction_code}</td><td class="n">${g.frame}</td><td class="n">${g.pol_code}</td><td class="n">${g.size_mb ? (g.size_mb / 1024).toFixed(2) + " GB" : "-"}</td><td>In NASA catalogue</td></tr>`).join("");
  return `
<h1>Data sources</h1>
<p>Everything AMBLAS uses is open. The inventory below was read from NASA's Common Metadata Repository on ${esc(inv.retrieved)} for the box ${inv.aoi.west}&deg;E to ${inv.aoi.east}&deg;E, ${Math.abs(inv.aoi.north)}&deg;S to ${Math.abs(inv.aoi.south)}&deg;S.</p>

<h2>NISAR coverage by track</h2>
<div class="tablewrap"><table>
<tr><th>Track</th><th>Direction</th><th>Frame</th><th>Pairs</th><th>First pass</th><th>Last pass</th><th>Chain unbroken</th><th>Focus areas inside the frame</th></tr>
${inv.tracks.map((t) => `<tr><td class="n">${t.track}</td><td>${t.direction}</td><td class="n">${t.frame}</td><td class="n">${t.pairs}</td><td class="n">${t.first_date}</td><td class="n">${t.last_date}</td><td>${t.connected_chain ? "Yes" : "No"}</td><td>${t.covers.length === 4 ? "All four" : t.covers.join(", ") || "None"}</td></tr>`).join("")}
</table></div>
<p>Tracks 082 and 090 are the ones to process: both contain all four focus areas and view them from opposite sides. Most pairs span 12 days. One pair per track spans 24 days because a pass in early August is absent from the catalogue.</p>

<h2>Granule inventory</h2>
<div class="filters" id="trackfilter"><button aria-pressed="true" data-track="">All ${inv.granule_count}</button>${inv.tracks.map((t) => `<button aria-pressed="false" data-track="${t.track}">Track ${t.track}</button>`).join("")}</div>
<div class="tablewrap"><table id="granules">
<thead><tr><th>Reference pass</th><th>Secondary pass</th><th>Days</th><th>Track</th><th>Frame</th><th>Pol. code</th><th>Size</th><th>Availability</th></tr></thead>
<tbody data-all='1'>${rows("")}</tbody></table></div>
<p>Product: ${esc(inv.collection)}. ${esc(inv.product_note)} Polarisation code SH denotes a single-polarisation acquisition. "Data quality" per granule is not listed because the catalogue does not expose it: coherence must be read from each file.</p>
<p><a class="btn ghost" href="data/inventory.json" download>Download inventory (JSON)</a></p>

<h2>Where each piece comes from</h2>
<div class="tablewrap"><table>
<tr><th>Item</th><th>Source</th><th>Used for</th></tr>
<tr><td>NISAR L2 GUNW</td><td><a href="https://search.asf.alaska.edu/" rel="noopener">Alaska Satellite Facility DAAC</a> via <a href="https://www.earthdata.nasa.gov/" rel="noopener">NASA Earthdata</a></td><td>Unwrapped phase, coherence, ionosphere screen</td></tr>
<tr><td>Granule search</td><td><a href="https://cmr.earthdata.nasa.gov/search/granules.csv?short_name=${esc(inv.collection)}&bounding_box=${inv.aoi.west},${inv.aoi.south},${inv.aoi.east},${inv.aoi.north}&page_size=500" rel="noopener">NASA CMR query</a></td><td>This inventory and the frame footprints</td></tr>
<tr><td>Product documentation</td><td><a href="https://nisar-docs.asf.alaska.edu/gunw/" rel="noopener">NISAR Data User Guide</a>, <a href="https://science.nasa.gov/mission/nisar/" rel="noopener">NISAR mission</a></td><td>Layer definitions, quality level</td></tr>
<tr><td>Earlier findings</td><td>Peer-reviewed papers, see <a href="#research">Research</a></td><td>Historical comparison only</td></tr>
<tr><td>Basemap</td><td>&copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a> contributors</td><td>Orientation</td></tr>
</table></div>
<p>Sentinel-1 is not used in this version. If it is added as a comparison it will appear as its own layer under its own name.</p>`;
}

export function research(s) {
  const m = s.manifest;
  const cmp = (loc) => {
    const smp = m.locations?.[loc.id];
    if (m.status === "none") return ["Not processed", "Nothing to compare yet"];
    if (m.status === "simulated") return ["Simulated test value, not shown", "No comparison: software test only"];
    if (!smp || smp.cumulative_mm == null) return ["No reliable pixels", "Cannot compare"];
    const r = interpret(m, smp);
    return [`${smp.cumulative_mm} &plusmn; ${smp.sigma_mm} mm LOS, ${m.first_date} to ${m.last_date}`, `${r.headline}. Spatial consistency check only: different sensor, period, reference and method.`];
  };
  return `
<h1>Research and references</h1>
<p>AMBLAS does not claim to discover subsidence in Bandung. Others measured it first. This page lists what they reported and how an AMBLAS result may, and may not, be set beside it.</p>

<h2>Historical comparison</h2>
<div class="tablewrap"><table>
<tr><th>Location</th><th>Previous research</th><th>Previous observation</th><th>AMBLAS result</th><th>Comparison</th></tr>
${s.locations.locations.map((l) => { const [a, b] = cmp(l); return `<tr><td><b>${esc(l.name)}</b><br><small>${esc(l.admin)}</small></td><td>Ge et al. 2014</td><td>${esc(l.literature)}</td><td>${a}</td><td>${b}</td></tr>`; }).join("")}
</table></div>
<div class="note"><p>${esc(s.locations.shared_caveat)} A match in location would be a <b>spatial consistency assessment</b>. It would not be a quantitative or independent validation, which needs ground data from the same period.</p></div>

<h2>Studies consulted</h2>
<p>${esc(s.studies.scope_note)}</p>
<div class="grid">
${s.studies.studies.map((t) => `<div class="card"><span class="q">${t.year} &middot; ${esc(t.satellites)}</span><h3>${esc(t.title)}</h3>
<p>${esc(t.authors)}. <i>${esc(t.venue)}</i>. <a href="https://doi.org/${esc(t.doi)}" rel="noopener">doi:${esc(t.doi)}</a></p>
<dl class="kv"><dt>Period</dt><dd>${esc(t.period)}</dd><dt>Method</dt><dd>${esc(t.method)}</dd></dl>
<p><b>Reported.</b> ${esc(t.reported)}</p><p><b>Limits.</b> ${esc(t.limitations)}</p><p><small>Checked against: ${esc(t.check)}</small></p></div>`).join("")}
</div>`;
}

export function limits() {
  return `
<h1>Limitations and disclaimer</h1>
<p>Read this page before quoting anything from AMBLAS.</p>
<div class="grid">
<div class="card"><h3>Line of sight is not vertical</h3><p>The radar measures change along a slanted view. Calling it subsidence assumes the motion is purely vertical. AMBLAS does not make that assumption and reports LOS only.</p></div>
<div class="card"><h3>Four months is a short record</h3><p>The public NISAR record over Bandung starts on 19 June 2026. No annual rate can be derived responsibly from it. Results are labelled preliminary displacement indicators.</p></div>
<div class="card"><h3>The atmosphere is not removed</h3><p>Tropospheric delay can reach centimetres over a humid mountain basin. Values under ${NOISE_FLOOR_MM} mm are treated as noise. The threshold is a working choice.</p></div>
<div class="card"><h3>Everything is relative</h3><p>Values are relative to the median of the valid pixels in the search box. If much of the basin moves together, that shared motion is hidden.</p></div>
<div class="card"><h3>Provisional data</h3><p>NASA labels these products provisional: calibrated, partially validated, with processing still improving.</p></div>
<div class="card"><h3>Sign convention unverified</h3><p>Whether negative means away from the satellite has been set by convention in the code and still has to be confirmed in the product specification.</p></div>
<div class="card"><h3>Gaps in coverage</h3><p>Paddy fields, water and dense vegetation lose coherence and are left blank. Blank does not mean stable.</p></div>
<div class="card"><h3>Unwrapping errors</h3><p>Phase unwrapping can jump by whole cycles of about 12 cm, especially across low-coherence gaps. The mask reduces this risk and cannot remove it.</p></div>
<div class="card"><h3>No ground truth</h3><p>No GPS, levelling or well data from 2026 has been compared. Agreement with older maps is a consistency check, not validation.</p></div>
<div class="card"><h3>Approximate places</h3><p>Markers sit at district centres for navigation. The search rectangle is not the geological boundary of the basin.</p></div>
<div class="card"><h3>No causes, no forecasts</h3><p>AMBLAS observes motion. It does not attribute it to groundwater pumping or anything else, and it predicts nothing.</p></div>
<div class="card"><h3>Not for engineering decisions</h3><p>This is a student prototype. Do not use it to judge the safety of a building, a property purchase or an evacuation.</p></div>
</div>`;
}

export function about() {
  return `
<h1>About AMBLAS</h1>
<p><i>Amblas</i> is the Indonesian word for ground that gives way. The project was built by team <b>404 Reika Not Found</b> at the Bandung local event of the 2026 NASA Space Apps Challenge, for the challenge <b>Dancing with the SARs</b>.</p>
<p>The aim is modest: take radar observations from space and make local ground movement visible to people who are not remote-sensing specialists, without overstating what the data can support.</p>
<div class="grid">
<div class="card"><h3>Scientific credibility</h3><p>Every layer carries its source, dates, method and limits. Simulated data is always labelled. Missing data is shown as missing.</p></div>
<div class="card"><h3>Public accessibility</h3><p>Plain language first, formulas second. One click on a place returns what is known, what is not, and why.</p></div>
<div class="card"><h3>Local relevance</h3><p>Built in Bandung, about Bandung, with a pipeline any other sinking city could reuse by changing one search box.</p></div>
</div>
<h2>Reproduce it</h2>
<div class="formula">pip install -r requirements.txt<br>cd pipeline<br>python -m amblas inventory --live<br>python -m amblas fetch --track 082<br>python -m amblas process --input ../data/gunw/track_082</div>
<p>Source code is open. NISAR data courtesy of NASA and ISRO, distributed by the Alaska Satellite Facility. This project is independent and is not affiliated with or endorsed by NASA or ISRO.</p>`;
}
