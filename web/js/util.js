// Small helpers shared by the views and the map.

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function loadJSON(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

// Ray casting. ring = [[lon, lat], ...]
export function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[j];
    if ((y1 > lat) !== (y2 > lat) && lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

export const fmtDate = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// Working threshold below which a 4-month stack cannot support a claim of
// movement. Not a calibrated figure: see the Limitations page.
export const NOISE_FLOOR_MM = 15;

// Plain-language reading of one sampled location. Returns { headline, text }.
export function interpret(manifest, sample) {
  const r = interpretRaw(manifest, sample);
  if (manifest.status !== "nisar" || !manifest.analyst_note || sample?.cumulative_mm == null) return r;
  r.note = manifest.analyst_note;
  if (r.headline.startsWith("Signal above")) {
    r.headline = "Above the noise estimate, likely atmospheric";
    r.text = "The value is larger than the working noise threshold, but across the whole basin the pattern follows elevation, so read it as air, not ground, until the troposphere is corrected.";
  }
  return r;
}

function interpretRaw(manifest, sample) {
  if (manifest.status === "none") return { headline: "Not processed yet", text: "No NISAR interferograms have been run through the AMBLAS pipeline, so there is no value to show for this place." };
  if (!sample || !sample.in_raster) return { headline: "Outside the processed raster", text: "This place is not covered by the processed frame." };
  if (sample.cumulative_mm == null) return { headline: "No reliable pixels", text: "Every pixel near this place failed the quality mask (low coherence or unreliable unwrapping). No value is reported." };
  if (manifest.status === "simulated") return { headline: "Simulated value", text: "This number comes from an artificial test pattern used to check the software. It says nothing about the ground here." };
  const d = sample.cumulative_mm, limit = Math.max(NOISE_FLOOR_MM, 2 * (sample.sigma_mm || 0));
  const twoSig = 2 * (sample.sigma_mm || 0);
  const why = twoSig > NOISE_FLOOR_MM
    ? `${limit.toFixed(0)} mm, twice this value's own uncertainty (2\u03c3; the fixed noise floor of ${NOISE_FLOOR_MM} mm is lower here)`
    : `${limit.toFixed(0)} mm, the noise floor below which atmospheric delay alone can explain it`;
  if (Math.abs(d) < limit) return { headline: "Within expected noise", text: `The value is smaller than ${why}. No movement can be claimed from this stack.` };
  const dir = d < 0 ? "away from the satellite, the direction subsidence would produce" : "toward the satellite";
  return { headline: "Signal above the noise estimate", text: `The ground here appears to have moved ${dir}, relative to the reference area. This is a line-of-sight change over a short window, not a vertical rate, and the sign convention still needs checking against the product specification.` };
}
