// App entry: load data, route between sections, show the global data status.
import { esc, fmtDate, loadJSON } from "./util.js";
import * as views from "./views.js";
import * as mapview from "./map.js";

const pages = { overview: views.overview, method: views.method, data: views.data, research: views.research, limits: views.limits, about: views.about };
const view = document.getElementById("view"), mapEl = document.getElementById("mapview");
let state, mapReady = false;

function status(m) {
  const el = document.getElementById("status");
  el.className = `status ${m.status}`;
  if (m.status === "none") el.innerHTML = `<b>NO RASTER PROCESSED</b><span>The map shows data availability and earlier research only. No displacement values are displayed.</span>`;
  else if (m.status === "simulated") el.innerHTML = `<b>SIMULATED DATA</b><span>The displacement layer is an artificial test pattern for checking the software. It is not a satellite measurement.</span>`;
  else el.innerHTML = `<b>EXPERIMENTAL NISAR RESULT</b><span>Preliminary line-of-sight displacement indicator, track ${esc(m.track)}, ${fmtDate(m.first_date)} to ${fmtDate(m.last_date)}. Not validated. See Limitations.${m.analyst_note ? ` <b>READ FIRST</b> ${esc(m.analyst_note)}` : ""}</span>`;
}

function route() {
  const id = location.hash.slice(1) || "overview";
  const isMap = id === "map";
  document.querySelectorAll("#nav a").forEach((a) => a.getAttribute("href") === `#${isMap ? "map" : pages[id] ? id : "overview"}` ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  mapEl.hidden = !isMap;
  view.hidden = isMap;
  if (isMap) {
    if (!mapReady) { mapview.init(state); mapReady = true; }
    mapview.refresh();
    window.scrollTo(0, 0);
  } else {
    view.innerHTML = (pages[id] || pages.overview)(state);
    if (id === "data") wireFilter();
    window.scrollTo(0, 0);
  }
}

function wireFilter() {
  const body = document.querySelector("#granules tbody"), all = [...body.rows];
  document.getElementById("trackfilter").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    document.querySelectorAll("#trackfilter button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    all.forEach((r) => { r.hidden = !!b.dataset.track && !r.cells[3].textContent.startsWith(b.dataset.track); });
  });
}

try {
  const [inventory, locations, studies, footprints, manifest] = await Promise.all(
    ["inventory", "locations", "studies", "footprints.geojson", "results/manifest"].map((n) => loadJSON(`data/${n}${n.includes(".") ? "" : ".json"}`)));
  state = { inventory, locations, studies, footprints, manifest };
  status(manifest);
  addEventListener("hashchange", route);
  route();
} catch (err) {
  view.innerHTML = `<h1>AMBLAS could not load its data</h1><p>${esc(err.message)}</p><p>Open the app through a local web server, not by double-clicking the file:</p><div class="formula">cd web &amp;&amp; python -m http.server 8000</div>`;
}
