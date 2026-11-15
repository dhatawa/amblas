// The interactive map and the location panel.
import { esc, fmtDate, inRing, interpret, NOISE_FLOOR_MM } from "./util.js";

let map, state, layers = {}, markers = {}, pin, grid = null, view = { epoch: null, raw: false }, selected = null;
const $ = (id) => document.getElementById(id);

const coverage = (lon, lat) => state.footprints.features
  .filter((f) => inRing(lon, lat, f.geometry.coordinates[0]))
  .map((f) => `${f.properties.track} ${f.properties.direction}`);

// Point values come from grid.json: int16 tenths of a unit, lat/lon cells.
async function loadGrid(m) {
  if (!m.grid) return null;
  try {
    const g = await (await fetch(`data/results/${m.grid.file}?v=${encodeURIComponent(m.generated_utc)}`)).json();
    const layers = {};
    for (const [k, b64] of Object.entries(g.layers)) {
      const bin = atob(b64), buf = new ArrayBuffer(bin.length), u8 = new Uint8Array(buf);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      layers[k] = new Int16Array(buf);
    }
    return { ...g, layers };
  } catch { return null; }
}

// Median of the valid cells in a 3x3 window around the point (about 500 m).
function gridValue(lat, lon, key) {
  if (!grid || !grid.layers[key]) return undefined;
  const [[s, w], [n, e]] = grid.bounds;
  if (lat < s || lat > n || lon < w || lon > e) return undefined;
  const r = Math.floor(((n - lat) / (n - s)) * grid.rows), c = Math.floor(((lon - w) / (e - w)) * grid.cols);
  const vals = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || cc < 0 || rr >= grid.rows || cc >= grid.cols) continue;
    const v = grid.layers[key][rr * grid.cols + cc];
    if (v !== grid.nodata) vals.push(v * grid.scale);
  }
  if (!vals.length) return null;
  vals.sort((a, b) => a - b);
  return vals[Math.floor(vals.length / 2)];
}

// Small line chart of a location's running LOS change, with the noise band.
function chart(series, noise) {
  const pts = series.filter((p) => p.mm != null);
  if (pts.length < 2) return "";
  const W = 300, H = 120, L = 34, R = 22, T = 8, B = 22;
  const t0 = Date.parse(series[0].date), t1 = Date.parse(series[series.length - 1].date);
  const lim = Math.max(noise * 1.5, ...pts.map((p) => Math.abs(p.mm))) * 1.1;
  const X = (d) => L + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (W - L - R);
  const Y = (v) => T + ((lim - v) / (2 * lim)) * (H - T - B);
  const line = pts.map((p) => `${X(p.date).toFixed(1)},${Y(p.mm).toFixed(1)}`).join(" ");
  const ticks = series.map((p) => `<text x="${X(p.date)}" y="${H - 6}" text-anchor="middle">${new Date(p.date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</text>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Running line-of-sight change by date">
    <rect x="${L}" y="${Y(noise)}" width="${W - L - R}" height="${Y(-noise) - Y(noise)}" fill="rgba(157,176,194,.12)"/>
    <line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#26384b"/>
    <text x="${L - 4}" y="${Y(noise) + 3}" text-anchor="end">+${noise}</text><text x="${L - 4}" y="${Y(-noise) + 3}" text-anchor="end">-${noise}</text>
    <polyline points="${line}" fill="none" stroke="#3fd0e0" stroke-width="2"/>
    ${pts.map((p) => `<circle cx="${X(p.date)}" cy="${Y(p.mm)}" r="3" fill="#3fd0e0"><title>${p.date}: ${p.mm.toFixed(1)} mm</title></circle>`).join("")}
    ${ticks}</svg>`;
}

function whyBlock(read) {
  return read.note ? `<details class="why"><summary>Why the map reads as atmosphere</summary><p>${esc(read.note)}</p></details>` : "";
}

function sourceLine(m) {
  if (m.status === "none") return "None loaded";
  if (m.status === "simulated") return "Synthetic test files (not satellite data)";
  return `NISAR L2 GUNW, track ${esc(m.track)} ${esc(m.direction)}, ${esc(m.polarisation)}`;
}

function rawSample(loc, smp) {
  const v = smp?.cumulative_mm_raw ?? gridValue(loc.lat, loc.lon, "los_raw");
  if (v == null) return null;
  return { ...smp, cumulative_mm: v, sigma_mm: smp?.sigma_mm_raw ?? null, raw: true };
}

function valueBlock(m, smp, loc) {
  const raw = view.raw && m.overlay?.raw_file && loc ? rawSample(loc, smp) : null;
  if (raw) {
    return `<p class="value">${raw.cumulative_mm > 0 ? "+" : ""}${raw.cumulative_mm.toFixed(1)} <small>${raw.sigma_mm != null ? `&plusmn; ${raw.sigma_mm.toFixed(1)} ` : ""}mm LOS, uncorrected</small></p>
    <p><small>Before the atmosphere correction. Corrected value: ${smp.cumulative_mm > 0 ? "+" : ""}${smp.cumulative_mm.toFixed(1)} &plusmn; ${smp.sigma_mm.toFixed(1)} mm.</small></p>`;
  }
  if (m.status === "none") return `<p class="value empty">No value. Real NISAR data has not been processed yet.</p>`;
  if (!smp || !smp.in_raster) return `<p class="value empty">Outside the processed raster.</p>`;
  if (smp.cumulative_mm == null) return `<p class="value empty">No reliable pixels here.</p>`;
  const tag = m.status === "simulated" ? `<small> SIMULATED</small>` : "";
  return `<p class="value">${smp.cumulative_mm > 0 ? "+" : ""}${smp.cumulative_mm.toFixed(1)} <small>&plusmn; ${smp.sigma_mm.toFixed(1)} mm LOS</small>${tag}</p>
  <dl class="kv"><dt>Unit</dt><dd>millimetres along the line of sight, relative to the reference</dd>
  <dt>Valid pixels</dt><dd>${Math.round(smp.valid_fraction * 100)}% within ${m.settings.sample_radius_m} m</dd>
  <dt>Pairs used</dt><dd>${smp.n_pairs} of ${m.pairs_used.length}</dd>
  <dt>Mean coherence</dt><dd>${smp.mean_coherence}</dd>
  <dt>Local spread</dt><dd>${smp.spread_mm} mm</dd>
  ${smp.height_m != null ? `<dt>Elevation</dt><dd>${Math.round(smp.height_m)} m</dd>` : ""}</dl>
  ${smp.series ? `<h3>Change through time${raw ? " (corrected)" : ""}</h3>${chart(smp.series, NOISE_FLOOR_MM)}<p><small>Running sum of the 12-day pairs at this place${m.overlay.raw_file ? ", after the atmosphere correction" : ""}. Shaded band: the &plusmn;${NOISE_FLOOR_MM} mm noise floor. Where a value's own uncertainty is larger, the reading below uses 2&sigma; instead.</small></p>` : ""}`;
}

function showLocation(loc) {
  selected = { loc };
  const m = state.manifest, smp = m.locations?.[loc.id];
  const read = interpret(m, view.raw && m.overlay?.raw_file ? (rawSample(loc, smp) || smp) : smp);
  const period = m.status === "none" ? "Not applicable" : `${fmtDate(m.first_date)} to ${fmtDate(m.last_date)} (${m.span_days} days)`;
  const studies = loc.reported_in.map((id) => state.studies.studies.find((t) => t.id === id)).filter(Boolean);
  $("panel").innerHTML = `
    <h2>${esc(loc.name)}</h2><p>${esc(loc.admin)}</p>
    <dl class="kv"><dt>Coordinates</dt><dd>${loc.lat.toFixed(3)}, ${loc.lon.toFixed(3)} (approx.)</dd>
    <dt>Observation period</dt><dd>${period}</dd><dt>Data source</dt><dd>${sourceLine(m)}</dd>
    <dt>NISAR tracks overhead</dt><dd>${coverage(loc.lon, loc.lat).join(", ") || "none"}</dd></dl>
    <h3>AMBLAS displacement${view.raw && m.overlay?.raw_file ? " (uncorrected)" : ""}</h3>${valueBlock(m, smp, loc)}
    <h3>Interpretation</h3><p><b>${esc(read.headline)}.</b> ${esc(read.text)}</p>${whyBlock(read)}
    <h3>Earlier research</h3><p>${esc(loc.literature)}</p>
    ${studies.map((t) => `<p><small>${esc(t.authors.split(",")[0])} et al. ${t.year}, ${esc(t.period)}. <a href="https://doi.org/${esc(t.doi)}" rel="noopener">doi:${esc(t.doi)}</a></small></p>`).join("")}
    <h3>Limits for this place</h3><p>${esc(state.locations.shared_caveat)}</p><p>${esc(state.locations.coordinate_note)}</p>`;
  Object.entries(markers).forEach(([id, mk]) => mk.getElement()?.classList.toggle("on", id === loc.id));
}

function showPoint(lat, lon) {
  const cov = coverage(lon, lat);
  if (pin) pin.remove();
  pin = L.marker([lat, lon], { icon: L.divIcon({ className: "pin", iconSize: [14, 14] }), keyboard: false }).addTo(map);
  Object.values(markers).forEach((mk) => mk.getElement()?.classList.remove("on"));
  selected = { lat, lon };
  const m = state.manifest, h = gridValue(lat, lon, "height");
  const useRaw = view.raw && m.overlay?.raw_file;
  const los = gridValue(lat, lon, useRaw ? "los_raw" : "los"), sig = gridValue(lat, lon, useRaw ? "sigma_raw" : "sigma");
  const raw = useRaw ? gridValue(lat, lon, "los") : gridValue(lat, lon, "los_raw");
  let body;
  if (m.status === "none") body = `<p class="value empty">No displacement layer has been processed yet.</p>`;
  else if (los === undefined) body = `<p class="value empty">${grid ? "Outside the processed area." : "Point values are not available for this result."}</p>`;
  else if (los === null) body = `<p class="value empty">No reliable pixels here (low coherence: water, paddy fields or dense vegetation).</p>`;
  else {
    const read = interpret(m, { in_raster: true, cumulative_mm: los, sigma_mm: sig ?? 0 });
    body = `<p class="value">${los > 0 ? "+" : ""}${los.toFixed(1)} <small>${sig != null ? `&plusmn; ${sig.toFixed(1)} ` : ""}mm LOS${useRaw ? ", uncorrected" : ""}${m.status === "simulated" ? " SIMULATED" : ""}</small></p>
      <dl class="kv"><dt>Period</dt><dd>${fmtDate(m.first_date)} to ${fmtDate(m.last_date)}</dd>
      ${h != null ? `<dt>Elevation</dt><dd>${Math.round(h * 10)} m</dd>` : ""}
      ${raw != null ? `<dt>${useRaw ? "After correction" : "Before correction"}</dt><dd>${raw > 0 ? "+" : ""}${raw.toFixed(1)} mm</dd>` : ""}
      <dt>Cell</dt><dd>median of about 500 m around the point</dd></dl>
      <h3>Interpretation</h3><p><b>${esc(read.headline)}.</b> ${esc(read.text)}</p>${whyBlock(read)}`;
  }
  $("panel").innerHTML = `<h2>Selected point</h2>
    <dl class="kv"><dt>Coordinates</dt><dd>${lat.toFixed(4)}, ${lon.toFixed(4)}</dd><dt>NISAR tracks overhead</dt><dd>${cov.join(", ") || "none in the inventory"}</dd></dl>
    <h3>AMBLAS displacement</h3>${body}${defaultHint()}`;
}

function defaultHint() {
  return `<h3>Focus areas</h3><div class="chips">${state.locations.locations.map((l) => `<button data-loc="${l.id}">${esc(l.name)}</button>`).join("")}</div>`;
}

function intro() {
  const m = state.manifest;
  const dl = m.status === "nisar" ? `<h3>Downloads</h3><p>${m.downloads.map((f) => `<a href="data/results/${f}" download>${f}</a>`).join("<br>")}</p>` : "";
  const tips = m.status === "none" ? "" : `<ul style="padding-left:1.1rem;margin:.2rem 0 .8rem">
      <li>Click anywhere to read the value at that point.</li>
      <li>Pick a focus area for its time series and earlier research.</li>
      ${m.epochs?.length > 1 ? "<li>Drag the date slider, or press Play, to watch the change build up pass by pass.</li>" : ""}
      ${m.overlay.raw_file ? "<li>Switch between uncorrected and corrected to see what the atmosphere correction removes.</li>" : ""}</ul>`;
  $("panel").innerHTML = `<h2>Bandung Basin</h2>${tips}
    <dl class="kv"><dt>Displacement layer</dt><dd>${sourceLine(m)}</dd>
    ${m.status !== "none" ? `<dt>Window</dt><dd>${fmtDate(m.first_date)} to ${fmtDate(m.last_date)}</dd><dt>Reference</dt><dd>${esc(m.reference)}</dd><dt>Valid pixels</dt><dd>${Math.round(m.stats.valid_pixel_fraction * 100)}%</dd>` : ""}</dl>
    ${m.status === "none" ? `<p>The displacement layer is empty on purpose. AMBLAS shows no pattern until real NISAR interferograms have been processed.</p>` : ""}
    ${whyBlock(interpret(m, { in_raster: true, cumulative_mm: 0, sigma_mm: 0 }))}
    ${defaultHint()}${dl}`;
}

function legend() {
  const m = state.manifest;
  if (m.status === "none") { $("legend").innerHTML = "No displacement layer loaded."; $("rasterstate").textContent = "(none)"; return; }
  const lim = m.overlay.colour_limit_mm;
  $("rasterstate").textContent = m.status === "simulated" ? "(simulated)" : "(NISAR)";
  const until = view.epoch != null && m.epochs ? m.epochs[view.epoch].date : m.last_date;
  $("legend").innerHTML = `LOS change, mm, ${fmtDate(m.first_date)} to ${fmtDate(until)}${view.raw ? " (uncorrected)" : ""}
    <div class="bar"></div><div class="ends"><span>-${lim}</span><span>0</span><span>+${lim}</span></div>
    <div class="dir"><span>away from satellite</span><span>toward</span></div>`;
}

function repanel() {
  if (selected?.loc) showLocation(selected.loc);
  else if (selected) showPoint(selected.lat, selected.lon);
}

function overlayUrl() {
  const m = state.manifest;
  let f = m.overlay.file;
  if (view.raw && m.overlay.raw_file) f = m.overlay.raw_file;
  else if (view.epoch != null && m.epochs && view.epoch < m.epochs.length - 1) f = m.epochs[view.epoch].file;
  return `data/results/${f}?v=${encodeURIComponent(m.generated_utc)}`;
}

function redraw() {
  layers.raster?.setUrl(overlayUrl());
  legend();
}

function timeControls(m) {
  if (m.overlay.raw_file) {
    $("before").hidden = false;
    $("before").innerHTML = `<div class="seg" role="group" aria-label="Atmosphere correction"><button aria-pressed="false" data-raw="1">Uncorrected</button><button aria-pressed="true" data-raw="0">Corrected</button></div>`;
    $("before").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      view.raw = b.dataset.raw === "1";
      if (view.raw) setEpoch(m.epochs.length - 1, false);
      $("before").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      redraw();
      repanel();
    });
  }
  if (!m.epochs || m.epochs.length < 2) return;
  const last = m.epochs.length - 1;
  $("timebox").hidden = false;
  $("timebox").innerHTML = `<div class="row"><button id="play" aria-label="Play through the dates">Play</button>
    <input type="range" id="epoch" min="0" max="${last}" value="${last}" step="1" aria-label="Date"></div>
    <div class="when" id="when"></div>`;
  let timer = null;
  const stop = () => { clearInterval(timer); timer = null; $("play").textContent = "Play"; };
  $("epoch").addEventListener("input", (e) => { stop(); setEpoch(+e.target.value); });
  $("play").addEventListener("click", () => {
    if (timer) return stop();
    $("play").textContent = "Pause";
    let i = view.epoch >= last ? 0 : view.epoch + 1;
    setEpoch(i);
    timer = setInterval(() => { i += 1; if (i > last) return stop(); setEpoch(i); }, 1100);
  });
  setEpoch(last, false);
}

function setEpoch(i, draw = true) {
  const m = state.manifest;
  view.epoch = i;
  if ($("epoch")) $("epoch").value = i;
  if ($("when")) $("when").textContent = i === 0 ? `${fmtDate(m.epochs[0].date)}: reference pass (zero)` : `${fmtDate(m.epochs[0].date)} to ${fmtDate(m.epochs[i].date)}, ${i} of ${m.epochs.length - 1} pairs`;
  if (draw && view.raw && i < m.epochs.length - 1) {
    view.raw = false;
    $("before").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.raw === "0")));
    repanel();
  }
  if (draw) redraw();
}

// Coordinate grid drawn only when the basemap cannot load, so an offline demo
// still has spatial context.
function graticule() {
  const g = L.layerGroup(), style = { color: "#26384b", weight: 1, interactive: false };
  for (let i = 0; i <= 10; i++) {
    const lon = 107.2 + i * 0.1, lat = -7.3 + i * 0.1;
    L.polyline([[-7.4, lon], [-6.2, lon]], style).addTo(g);
    L.polyline([[lat, 107.1], [lat, 108.3]], style).addTo(g);
    L.marker([-7.14, lon], { interactive: false, icon: L.divIcon({ className: "gridlabel", html: lon.toFixed(1) + "&deg;E", iconSize: [50, 12] }) }).addTo(g);
    L.marker([lat, 107.94], { interactive: false, icon: L.divIcon({ className: "gridlabel", html: Math.abs(lat).toFixed(1) + "&deg;S", iconSize: [50, 12] }) }).addTo(g);
  }
  return g;
}

export function init(s) {
  state = s;
  const a = s.inventory.aoi;
  const wide = innerWidth > 860;
  if (!wide) $("layerbox").open = false;
  map = L.map("map", { zoomControl: false, minZoom: 7, maxZoom: 16 });
  L.control.zoom({ position: "topright" }).addTo(map);
  map.fitBounds([[a.south, a.west], [a.north, a.east]], { paddingTopLeft: [wide ? 280 : 10, 10], paddingBottomRight: [10, 10] });
  const esriAttr = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community';
  const base = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 16, attribution: esriAttr }).addTo(map);
  const labels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 16, pane: "labels" });
  map.createPane("labels").style.zIndex = 450;          // above the radar overlay, below markers
  map.getPane("labels").style.pointerEvents = "none";
  labels.addTo(map);
  let failed = 0, fallback = null;
  base.on("tileerror", () => {
    if (++failed !== 4) return;
    base.remove(); labels.remove();
    fallback = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, className: "osm-dark",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    let osmFailed = 0;
    fallback.on("tileerror", () => { if (++osmFailed === 4) { fallback.remove(); $("offline").hidden = false; graticule().addTo(map); } });
  });
  L.control.scale({ imperial: false }).addTo(map);

  layers.aoi = L.rectangle([[a.south, a.west], [a.north, a.east]], { color: "#3fd0e0", weight: 1.5, dashArray: "6 5", fill: false, interactive: false })
    .bindTooltip("Search area (not the basin boundary)", { permanent: false }).addTo(map);
  layers.foot = L.geoJSON(s.footprints, { style: (f) => ({ color: f.properties.direction === "ascending" ? "#6fae7a" : "#f2b34a", weight: 1.5, fillOpacity: 0.04 }),
    onEachFeature: (f, l) => l.bindTooltip(`NISAR track ${f.properties.track}, ${f.properties.direction}, frame ${f.properties.frame}`, { sticky: true }) });

  const m = s.manifest;
  if (m.status !== "none") {
    layers.raster = L.imageOverlay(`data/results/${m.overlay.file}?v=${encodeURIComponent(m.generated_utc)}`, m.overlay.bounds, { opacity: 0.85, interactive: false }).addTo(map);
    $("simmark").hidden = m.status !== "simulated";
  }

  layers.spots = L.layerGroup().addTo(map);
  s.locations.locations.forEach((loc) => {
    markers[loc.id] = L.marker([loc.lat, loc.lon], { icon: L.divIcon({ className: "spot", iconSize: [16, 16] }), title: loc.name, alt: loc.name })
      .bindTooltip(loc.name, { permanent: true, direction: "right", offset: [10, 0], className: "spotlabel" })
      .on("click", (e) => { L.DomEvent.stopPropagation(e); showLocation(loc); }).addTo(layers.spots);
  });

  map.on("click", (e) => showPoint(e.latlng.lat, e.latlng.lng));
  document.querySelectorAll("[data-layer]").forEach((box) => box.addEventListener("change", () => {
    const l = layers[box.dataset.layer];
    if (!l) return;
    box.checked ? l.addTo(map) : l.remove();
    if (box.dataset.layer === "foot" && box.checked) map.fitBounds(l.getBounds(), { padding: [20, 20] });
    if (box.dataset.layer === "raster") $("simmark").hidden = !(box.checked && m.status === "simulated");
  }));
  $("opacity").addEventListener("input", (e) => layers.raster?.setOpacity(e.target.value / 100));
  $("panel").addEventListener("click", (e) => { const id = e.target.dataset?.loc; if (id) focus(id); });

  $("places").innerHTML = s.locations.locations.map((l) => `<option value="${esc(l.name)}">`).join("");
  $("search").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("q").value.trim(), loc = s.locations.locations.find((l) => l.name.toLowerCase() === q.toLowerCase());
    const c = q.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
    if (loc) focus(loc.id);
    else if (c && Math.abs(+c[1]) <= 90 && Math.abs(+c[2]) <= 180) { map.setView([+c[1], +c[2]], 13); showPoint(+c[1], +c[2]); }
    else $("panel").innerHTML = `<h2>Not found</h2><p>Search knows the four focus areas and coordinates written as <span class="num">-6.95, 107.70</span>.</p>${defaultHint()}`;
  });
  timeControls(m);
  legend();
  intro();
  loadGrid(m).then((g) => { grid = g; });
}

export function focus(id) {
  const loc = state.locations.locations.find((l) => l.id === id);
  if (!loc) return;
  map.setView([loc.lat, loc.lon], 13);
  showLocation(loc);
}

export const refresh = () => map && map.invalidateSize();
