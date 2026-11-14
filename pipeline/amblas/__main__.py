"""Command line entry point:  python -m amblas <command>"""
from __future__ import annotations

import argparse
from pathlib import Path

from . import config, gunw, inventory, process, simulate


def main() -> None:
    ap = argparse.ArgumentParser(prog="amblas", description="AMBLAS: NISAR GUNW to ground-motion map")
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("inventory", help="rebuild web/data/inventory.json")
    s.add_argument("--live", action="store_true", help="query NASA CMR now instead of the saved snapshot")

    s = sub.add_parser("fetch", help="get real GUNW data for one track (needs Earthdata Login)")
    s.add_argument("--track", required=True, help="e.g. 082 (ascending) or 090 (descending)")
    s.add_argument("--out", type=Path, default=config.ROOT / "data" / "gunw")
    s.add_argument("--mode", choices=["subset", "download"], default="subset")

    s = sub.add_parser("inspect", help="print the dataset tree of a GUNW file")
    s.add_argument("file", type=Path)

    s = sub.add_parser("process", help="stack a folder of GUNW files and publish to the web app")
    s.add_argument("--input", type=Path, required=True)
    s.add_argument("--coh-min", type=float, default=config.COH_MIN)
    s.add_argument("--min-pairs", type=int, default=config.MIN_PAIRS)
    s.add_argument("--limit-mm", type=float, default=None, help="colour scale limit; default: from the data")

    s = sub.add_parser("simulate", help="write labelled synthetic files to test the chain")
    s.add_argument("--out", type=Path, default=config.ROOT / "data" / "simulated")

    sub.add_parser("clear", help="remove published results from the web app")

    a = ap.parse_args()
    if a.cmd == "inventory":
        inv = inventory.build(live=a.live)
        print(f"{inv['granule_count']} granules ({inv['source']})")
        for t in inv["tracks"]:
            print(f"  track {t['track']} {t['direction']:<10} {t['pairs']} pairs  {t['first_date']} -> {t['last_date']}  covers: {', '.join(t['covers']) or '-'}")
    elif a.cmd == "fetch":
        from . import fetch
        for p in fetch.run(a.track, a.out / f"track_{a.track}", a.mode):
            print("saved", p)
    elif a.cmd == "inspect":
        print("\n".join(gunw.describe(a.file)))
    elif a.cmd == "process":
        m = process.run(a.input, a.coh_min, a.min_pairs, a.limit_mm)
        print(m["label"])
        print(f"track {m['track']} | {m['first_date']} -> {m['last_date']} | {len(m['pairs_used'])} pairs | valid {m['stats']['valid_pixel_fraction']:.0%}")
        for k, v in m["locations"].items():
            print(f"  {k:<12} {v}")
    elif a.cmd == "simulate":
        for p in simulate.write_files(a.out):
            print("wrote", p.name)
    elif a.cmd == "clear":
        process.clear()
        print("results cleared")


if __name__ == "__main__":
    main()
