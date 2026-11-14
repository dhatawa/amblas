"""End-to-end checks on synthetic data with a known answer.

Run from the repo root:  python -m pytest pipeline/tests -q
"""
import json
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from amblas import config, inventory, insar, process, simulate  # noqa: E402
from amblas.gunw import read_pair  # noqa: E402


@pytest.fixture(scope="module")
def sim_dir(tmp_path_factory):
    d = tmp_path_factory.mktemp("sim")
    simulate.write_files(d)
    return d


def test_granule_name_fields():
    g = inventory.parse_granule_name(
        "NISAR_L2_PR_GUNW_023_082_A_174_024_4000_SH_20260619T223102_20260619T223137_20260701T223102_20260701T223136_P05023_N_F_J_001")
    assert (g["track"], g["direction"], g["frame"]) == ("082", "ascending", "174")
    assert (g["ref_date"], g["sec_date"], g["baseline_days"]) == ("2026-06-19", "2026-07-01", 12)


def test_inventory_snapshot_counts_and_coverage():
    inv = inventory.build()
    assert inv["granule_count"] == 34
    by = {t["track"]: t for t in inv["tracks"]}
    assert by["082"]["pairs"] == 9 and by["090"]["pairs"] == 9
    assert set(by["082"]["covers"]) == {"gedebage", "rancaekek", "dayeuhkolot", "cimahi"}
    assert set(by["090"]["covers"]) == {"gedebage", "rancaekek", "dayeuhkolot", "cimahi"}
    assert "gedebage" not in by["018"]["covers"]
    assert by["082"]["connected_chain"]


def test_phase_conversion_is_half_wavelength_per_cycle():
    # one full fringe (2*pi) of two-way phase = half a wavelength of range change
    mm = insar.phase_to_los_mm(np.array([2 * np.pi]), 0.24, sign=-1.0)
    assert mm[0] == pytest.approx(-120.0)


def test_reader_crops_to_aoi_and_flags_simulation(sim_dir):
    p = read_pair(sorted(sim_dir.glob("*.h5"))[0])
    assert p.simulated and p.pol == "HH" and p.epsg == 32748
    assert p.phase.shape == (p.y.size, p.x.size)
    assert p.baseline_days == 12


def test_mask_rejects_low_coherence(sim_dir):
    p = read_pair(sorted(sim_dir.glob("*.h5"))[0])
    ok = insar.valid_mask(p, 0.3)
    assert not ok[:, 0].any() and ok[:, -1].all()


def test_stack_recovers_known_patch(sim_dir):
    pairs = [read_pair(f) for f in sorted(sim_dir.glob("*.h5"))]
    st = insar.stack_pairs(pairs)
    patch = simulate.patch_mask(pairs[0].x, pairs[0].y)
    expected = simulate.PATCH_MM_PER_DAY * st.span_days
    assert st.span_days == 72 and st.connected
    assert np.nanmedian(st.cumulative_mm[patch]) == pytest.approx(expected, abs=0.5)
    background = np.isfinite(st.cumulative_mm) & ~patch
    assert abs(np.nanmedian(st.cumulative_mm[background])) < 0.2   # offset and ionosphere removed


def test_process_publishes_labelled_manifest(sim_dir, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "RESULTS", tmp_path / "results")
    m = process.run(sim_dir)
    assert m["status"] == "simulated" and "SIMULATED" in m["label"]
    assert (tmp_path / "results" / "los_cumulative.png").exists()
    assert (tmp_path / "results" / "los_cumulative_mm.tif").exists()
    (s, w), (n, e) = m["overlay"]["bounds"]
    assert s < -6.9 < n and w < 107.6 < e
    assert set(m["locations"]) == {"gedebage", "rancaekek", "dayeuhkolot", "cimahi"}
    assert all(v["in_raster"] for v in m["locations"].values())
    json.dumps(m)   # must be serialisable


def test_mixed_tracks_are_refused(sim_dir, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "RESULTS", tmp_path / "r")
    d = tmp_path / "mixed"
    d.mkdir()
    files = sorted(sim_dir.glob("*.h5"))
    (d / files[0].name).write_bytes(files[0].read_bytes())
    (d / files[1].name.replace("_999_A_", "_998_A_")).write_bytes(files[1].read_bytes())
    with pytest.raises(SystemExit):
        process.run(d)
