// The interactive map and the location panel.
import { esc, fmtDate, inRing, interpret } from "./util.js";

let map, state, layers = {}, markers = {}, pin;
const $ = (id) => document.getElementById(id);

const coverage = (lon, lat) => state.footprints.features
  .filter((f) => inRing(lon, lat, f.geometry.coordinates[0]))
  .map((f) => `${f.properties.track} ${f.properties.direction}`);

function sourceLine(m) {
  if (m.status === "none") return "None loaded";
  if (m.status === "simulated") return "Synthetic test files (not satellite data)";
  return `NISAR L2 GUNW, track ${esc(m.track)} ${esc(m.direction)}, ${esc(m.polarisation)}`;
}

function valueBlock(m, smp) {
  if (m.status === "none") return `<p class="value empty">No value. Real NISAR data has not been processed yet.</p>`;
  if (!smp || !smp.in_raster) return `<p class="value empty">Outside the processed raster.</p>`;
  if (smp.cumulative_mm == null) return `<p class="value empty">No reliable pixels here.</p>`;
  const tag = m.status === "simulated" ? `<small> SIMULATED</small>` : "";
  return `<p class="value">${smp.cumulative_mm > 0 ? "+" : ""}${smp.cumulative_mm.toFixed(1)} <small>&plusmn; ${smp.sigma_mm.toFixed(1)} mm LOS</small>${tag}</p>
  <dl class="kv"><dt>Unit</dt><dd>millimetres along the line of sight, relative to the reference</dd>
  <dt>Valid pixels</dt><dd>${Math.round(smp.valid_fraction * 100)}% within ${m.settings.sample_radius_m} m</dd>
  <dt>Pairs used</dt><dd>${smp.n_pairs} of ${m.pairs_used.length}</dd>
  <dt>Mean coherence</dt><dd>${smp.mean_coherence}</dd>
  <dt>Local spread</dt><dd>${smp.spread_mm} mm</dd></dl>`;
}

function showLocation(loc) {
  const m = state.manifest, smp = m.locations?.[loc.id], read = interpret(m, smp);
  const period = m.status === "none" ? "Not applicable" : `${fmtDate(m.first_date)} to ${fmtDate(m.last_date)} (${m.span_days} days)`;
  const studies = loc.reported_in.map((id) => state.studies.studies.find((t) => t.id === id)).filter(Boolean);
  $("panel").innerHTML = `
    <h2>${esc(loc.name)}</h2><p>${esc(loc.admin)}</p>
    <dl class="kv"><dt>Coordinates</dt><dd>${loc.lat.toFixed(3)}, ${loc.lon.toFixed(3)} (approx.)</dd>
    <dt>Observation period</dt><dd>${period}</dd><dt>Data source</dt><dd>${sourceLine(m)}</dd>
    <dt>NISAR tracks overhead</dt><dd>${coverage(loc.lon, loc.lat).join(", ") || "none"}</dd></dl>
    <h3>AMBLAS displacement</h3>${valueBlock(m, smp)}
    <h3>Interpretation</h3><p><b>${esc(read.headline)}.</b> ${esc(read.text)}</p>
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
  $("panel").innerHTML = `<h2>Selected point</h2>
    <dl class="kv"><dt>Coordinates</dt><dd>${lat.toFixed(4)}, ${lon.toFixed(4)}</dd><dt>NISAR tracks overhead</dt><dd>${cov.join(", ") || "none in the inventory"}</dd></dl>
    <p>Values are summarised for the four focus areas only. For any other point, open the GeoTIFF in QGIS.</p>${defaultHint()}`;
}

function defaultHint() {
  return `<h3>Focus areas</h3><div class="chips">${state.locations.locations.map((l) => `<button data-loc="${l.id}">${esc(l.name)}</button>`).join("")}</div>`;
}

function intro() {
  const m = state.manifest;
  const dl = m.status === "nisar" ? `<h3>Downloads</h3><p>${m.downloads.map((f) => `<a href="data/results/${f}" download>${f}</a>`).join("<br>")}</p>` : "";
  $("panel").innerHTML = `<h2>Bandung Basin</h2><p>Select a focus area or click anywhere on the map.</p>
    <dl class="kv"><dt>Displacement layer</dt><dd>${sourceLine(m)}</dd>
    ${m.status !== "none" ? `<dt>Window</dt><dd>${fmtDate(m.first_date)} to ${fmtDate(m.last_date)}</dd><dt>Reference</dt><dd>${esc(m.reference)}</dd><dt>Valid pixels</dt><dd>${Math.round(m.stats.valid_pixel_fraction * 100)}%</dd>` : ""}</dl>
    ${m.status === "none" ? `<p>The displacement layer is empty on purpose. AMBLAS shows no pattern until real NISAR interferograms have been processed.</p>` : ""}
    ${defaultHint()}${dl}`;
}

function legend() {
  const m = state.manifest;
  if (m.status === "none") { $("legend").innerHTML = "No displacement layer loaded."; $("rasterstate").textContent = "(none)"; return; }
  const lim = m.overlay.colour_limit_mm;
  $("rasterstate").textContent = m.status === "simulated" ? "(simulated)" : "(NISAR)";
  $("legend").innerHTML = `LOS change, mm, ${fmtDate(m.first_date)} to ${fmtDate(m.last_date)}
    <div class="bar"></div><div class="ends"><span>-${lim}</span><span>0</span><span>+${lim}</span></div>
    <div class="dir"><span>away from satellite</span><span>toward</span></div>`;
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
  const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
  let failed = 0;
  tiles.on("tileerror", () => { if (++failed === 3) { $("offline").hidden = false; graticule().addTo(map); } });
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
  legend();
  intro();
}

export function focus(id) {
  const loc = state.locations.locations.find((l) => l.id === id);
  if (!loc) return;
  map.setView([loc.lat, loc.lon], 13);
  showLocation(loc);
}

export const refresh = () => map && map.invalidateSize();
