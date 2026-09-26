"""Build a reproducible, compressed locality snapshot from downloaded LGD CSVs.

No network or database writes. See docs/DIGITAL_FPOS.md for archive provenance.
"""
import argparse
import collections
import csv
import datetime
import gzip
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KEY = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
# IGOD uses these alternate English district spellings. No fuzzy matching.
ODISHA = dict(zip(
    ["Angul", "Balasore", "Bargarh", "Cuttack", "Deogarh", "Kandhamal",
     "Kendrapara", "Keonjhar", "Nayagarh", "Sonepur", "Sundargarh"],
    ["Anugola", "Baleshwar", "Baragada", "Kataka", "Debagada", "Kandhamala",
     "Kendrapada", "Kendujhar", "Nayagada", "Subarnapur", "Sundaragada"]))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--date", default="31May2026")
    args = parser.parse_args()
    snapshot_date = datetime.datetime.strptime(args.date, "%d%b%Y").date()
    catalogue = json.loads((ROOT / "data/fpo-districts.json").read_text())["districts"]
    parents = {(KEY(d["state"]), KEY(d["district"])): d for d in catalogue}
    records = set()
    unresolved = collections.Counter()
    sources = []

    def add(state, district, kind, code, name):
        if not name.strip() or not code or code == "0":
            return
        state = state.removeprefix("The ") if state.startswith("The Dadra") else state
        district = ODISHA.get(district, district) if state == "Odisha" else district
        parent = parents.get((KEY(state), KEY(district)))
        if parent is None:
            unresolved[(state, district)] += 1
            return
        # Number-only ward labels do not identify a locality.
        if not any(c.isalpha() for c in name):
            return
        records.add((parent["state"], parent["district"], kind, code, name.strip()))

    for component in ["subdistricts", "villages", "statewise_ulbs_coverage"]:
        file = args.input / f"{component}.{args.date}.csv"
        sources.append({"file": file.name, "sha256": hashlib.sha256(file.read_bytes()).hexdigest()})
        with file.open(encoding="utf-8-sig", newline="") as stream:
            for row in csv.DictReader(stream):
                if component == "subdistricts":
                    add(row["State Name"], row["District Name"], "subdistrict",
                        row["Sub-district Code"], row["Sub-district Name"])
                elif component == "villages":
                    for field in ["Village Name (In English)", "Village Name (In Local)"]:
                        add(row["State Name(In English)"], row["District Name (In English)"],
                            "village", row["Village Code"], row[field])
                else:
                    add(row["State Name (In English)"], row["District Name (In English)"],
                        "town", row["Local Body Code"], row["Local Body Name (In English)"])
    if unresolved:
        raise SystemExit("Unmapped parents; review before generating: " + json.dumps(
            [[*pair, count] for pair, count in unresolved.items()]))
    expected = {d["state"] for d in catalogue}
    covered = {r[0] for r in records}
    if covered != expected:
        raise SystemExit("Missing State/UT coverage: " + repr(expected - covered))
    output = ROOT / "data/fpo-localities.jsonl.gz"
    with output.open("wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as zipped:
        for record in sorted(records):
            zipped.write((json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n").encode())
    report = {
        "snapshot_date": snapshot_date.isoformat(), "retrieved_at": datetime.date.today().isoformat(),
        "origin": "https://lgdirectory.gov.in/downloadDirectory.do",
        "mirror": "https://ramseraph.github.io/opendata/lgd/",
        "archive_base": "https://github.com/ramSeraph/opendata/releases/download/lgd-archive-extra1/",
        "archive_files": [f"{c}.{snapshot_date.strftime('%b%Y')}.7z" for c in ["subdistricts", "villages", "statewise_ulbs_coverage"]],
        "sources": sources, "records": len(records),
        "kinds": dict(collections.Counter(r[2] for r in records)),
        "states": dict(sorted(collections.Counter(r[0] for r in records).items())),
        "districts": len({r[:2] for r in records}),
        "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "limitations": "Dated mirrored LGD snapshot, not a live official feed. Includes recorded villages, subdistricts and urban local bodies; not every street, colony, hamlet or spelling. Boundary changes after the snapshot need review.",
        "district_alias_source": "https://odisha.gov.in/en/about-us/districts"
    }
    (ROOT / "data/fpo-localities-manifest.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({k: report[k] for k in ["records", "kinds", "districts", "states"]}, indent=2))

if __name__ == "__main__":
    main()
