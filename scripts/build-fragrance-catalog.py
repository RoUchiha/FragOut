"""Build the checked-in catalog from three licensed data downloads and reviewed references."""
import argparse
import csv
import json
import re
import unicodedata
from collections import defaultdict
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "catalog"
IDENTITY = json.loads((CATALOG / "identity.json").read_text(encoding="utf-8"))
CC_BY = {"name": "CC BY 4.0", "url": "https://creativecommons.org/licenses/by/4.0/"}
STAGES = ("top", "heart", "base")
SOURCE_STAGES = (*STAGES, "listed")
CONCENTRATIONS = {
    "eau de toilette": "EDT", "edt": "EDT", "eau de parfum": "EDP",
    "edp": "EDP", "parfum": "PARFUM", "elixir": "ELIXIR", "oil": "OIL",
}
NOTE_ALIASES = {
    "calabrian bergamot": "bergamot", "sicilian lemon": "lemon",
    "black currant": "blackcurrant", "peppermint": "mint",
    "cedarwood": "cedar", "ambery cedar": "cedar",
    "australian sandalwood": "sandalwood", "new caledonian sandalwood": "sandalwood",
    "bourbon vanilla": "vanilla", "madagascar vanilla": "vanilla",
    "papua new guinean vanilla extract": "vanilla", "vanilla absolute": "vanilla",
    "jasmine sambac": "jasmine", "moroccan jasmine": "jasmine",
    "may rose": "rose", "tobacco leaf": "tobacco", "woody patchouli": "patchouli",
    "spicy notes": "spice", "blond leather": "leather", "blood mandarin": "mandarin",
    "mandarin orange": "mandarin", "white musk": "musk", "guaiacwood": "guaiac wood",
    "lotus blossom": "lotus", "black orchid": "orchid", "liquid amber": "amber",
    "black violet": "violet",
}


def normalize(text):
    unaccented = "".join(c for c in unicodedata.normalize("NFKD", text.lower())
                         if not unicodedata.category(c).startswith("M"))
    return re.sub(r"[\W_]+", " ", re.sub("[’ʼ']", "", unaccented).replace("&", " and ")).strip()


def identity_key(brand, name, concentration):
    input_house = normalize(brand)
    house = IDENTITY["houseAliases"].get(input_house, input_house)
    release = normalize(name)
    prefixes = [house, *(alias for alias, canonical in IDENTITY["houseAliases"].items()
                         if canonical == house)]
    for prefix in sorted(prefixes, key=len, reverse=True):
        if release.startswith(prefix + " "):
            release = release[len(prefix) + 1:]
            break
    for suffix in IDENTITY["suffixes"].get(concentration, []):
        if release.endswith(" " + suffix):
            release = release[:-len(suffix) - 1]
            break
    return (house, release, concentration)


def unique_rows(rows, brand_field):
    matches = defaultdict(list)
    for row in rows:
        concentration = CONCENTRATIONS.get(normalize(row["concentration"]))
        if concentration:
            matches[identity_key(row[brand_field], row["name"], concentration)].append(row)
    return {key: group[0] for key, group in matches.items() if len(group) == 1}


def make_source(id_, publisher, url, kind, license_=None, credit=None):
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError(f"Invalid source URL: {url}")
    source = {"id": id_, "publisher": publisher, "url": url, "kind": kind}
    if license_:
        source["license"] = license_
    if credit:
        source["credit"] = credit
    return source


def checked_notes(lists):
    evidence = defaultdict(lambda: defaultdict(set))
    for source, stages in lists.items():
        for stage, notes in stages.items():
            for note in notes:
                label = normalize(note)
                key = NOTE_ALIASES.get(label, label)
                if key:
                    evidence[key][source].add(stage)
    checked = []
    for name, sources in evidence.items():
        # The house page corroborates published note names from a licensed list.
        if len(sources) < 2 or not {"scento", "mysecretcart"}.intersection(sources):
            continue
        stages = [stage for declared in sources.values() for stage in declared if stage in STAGES]
        stage = stages[0] if len(stages) >= 2 and len(set(stages)) == 1 else "listed"
        checked.append({"name": name.capitalize(), "stage": stage, "sourceIds": list(sources)})
    return sorted(checked, key=lambda note: SOURCE_STAGES.index(note["stage"]))


def hours(value):
    band = re.search(r"(\d+)\s*[-–]\s*(\d+)\s*h", value, re.IGNORECASE)
    if not band or not 0 < int(band[1]) <= int(band[2]) <= 48:
        return None
    return f"{band[1]}–{band[2]} h"


def wear_reports(csv_row, index_row):
    if not csv_row or not index_row:
        return []
    performance = []
    for kind, values in (
        ("longevity", (hours(csv_row["typical_wear"]), hours(index_row["longevity"]))),
        ("sillage", (csv_row["sillage"].strip().capitalize(), index_row["sillage"].strip().capitalize())),
    ):
        if all(values):
            performance.append({"kind": kind, "reports": [
                {"sourceId": id_, "value": value}
                for id_, value in zip(("mysecretcart", "gouttes"), values, strict=True)
            ]})
    return performance


def build_entry(key, scento, csv_row, reviewed, index_row, checked_at):
    lists, sources = {}, []
    if reviewed:
        sources.append(make_source("house", reviewed["brand"], reviewed["url"], "house"))
        lists["house"] = reviewed["notes"]
    if scento:
        sources.append(make_source("scento", "Scento", scento["url"], "reference", CC_BY,
                                   "Scento — Perfume Database. Matching notes selected and standardized."))
        staged = {stage: scento[f"{stage}_notes"] for stage in STAGES}
        positioned = {note for notes in staged.values() for note in notes}
        lists["scento"] = {**staged, "listed": [note for note in scento["notes"] if note not in positioned]}
    if csv_row:
        sources.append(make_source("mysecretcart", "MySecretCart", "https://mysecretcart.com/fragrance-study",
                                   "reference", CC_BY, "MySecretCart — Fragrance Study. Selected notes and typical wear estimates reformatted."))
        lists["mysecretcart"] = {stage: csv_row[f"{stage}_notes"].split(";") for stage in STAGES}
    notes = checked_notes(lists)
    performance = wear_reports(csv_row, index_row)
    if performance:
        sources.append(make_source("gouttes", "Gouttes Rares",
                                   "https://gouttesrares.com/pages/fragrance-longevity-sillage-index",
                                   "wear", CC_BY, "Gouttes Rares Longevity & Sillage Index, 2026. In-house wear assessments reformatted."))
    photo = reviewed.get("photo")
    if photo:
        filename = photo["file"]
        if not re.fullmatch(r"[a-z0-9-]+", filename):
            raise ValueError(f"Invalid photo name: {filename}")
        path = f"/catalog/bottles/{filename}.jpg"
        if not (ROOT / "public" / path.lstrip("/")).is_file():
            raise ValueError(f"Missing catalog photo: {path}")
        sources.append(make_source("photo", photo.get("publisher", "Wikimedia Commons"), photo["url"], "photo",
                                   photo["license"], photo["credit"]))
    if reviewed.get("communityUrl"):
        sources.append(make_source("community", "Parfumo", reviewed["communityUrl"], "community"))
    if not (notes or performance or photo):
        return None
    brand = reviewed.get("brand") or scento["house"]
    name = reviewed.get("name") or scento["name"]
    id_ = "-".join(key).replace(" ", "-").lower()
    entry = {"id": id_, "brand": brand, "name": name, "concentration": key[2], "checkedAt": checked_at,
             "notes": notes, "performance": performance, "sources": sources}
    if photo:
        entry["photo"] = {"path": path, "caption": photo["caption"], "sourceId": "photo"}
    if reviewed.get("aliases"):
        entry["aliases"] = reviewed["aliases"]
    return entry


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scento_jsonl", type=Path)
    parser.add_argument("mysecretcart_csv", type=Path)
    parser.add_argument("gouttes_json", type=Path)
    parser.add_argument("--checked-at", type=date.fromisoformat, required=True)
    args = parser.parse_args()
    reviewed = {identity_key(r["brand"], r["name"], r["concentration"]): r
                for r in json.loads((CATALOG / "reviewed.json").read_text(encoding="utf-8"))}
    scento = unique_rows((json.loads(line) for line in args.scento_jsonl.read_text(encoding="utf-8").splitlines()
                          if line), "house")
    with args.mysecretcart_csv.open(encoding="utf-8-sig", newline="") as rows:
        csv_rows = unique_rows(csv.DictReader(rows), "house")
    index = json.loads(args.gouttes_json.read_text(encoding="utf-8"))
    if index["license"] != CC_BY["url"]:
        raise ValueError("Review the updated performance dataset license.")
    wear = {r["product_url"]: r for r in index["records"]}
    profiles = []
    for key in sorted(scento.keys() & csv_rows.keys() | reviewed.keys()):
        review = reviewed.get(key, {})
        note_row, csv_row = scento.get(key), csv_rows.get(key)
        if note_row and csv_row and note_row["year"] and csv_row["year"] and str(note_row["year"]) != csv_row["year"]:
            raise ValueError(f"Recheck conflicting launch years for {key}")
        reference = review.get("wear")
        index_row = None
        if reference:
            index_row = wear.get(reference["url"])
            if not index_row or not reference["editionEvidence"] or not reference["editionUrl"].startswith("https://") or (
                    identity_key(index_row["house"], index_row["fragrance"], reference["concentration"]) != key):
                raise ValueError(f"Recheck the exact edition of wear reference: {reference['url']}")
        entry = build_entry(key, note_row, csv_row, review, index_row, args.checked_at.isoformat())
        if entry:
            profiles.append(entry)
    output = "[\n" + ",\n".join("  " + json.dumps(row, ensure_ascii=False) for row in profiles) + "\n]\n"
    (CATALOG / "fragrances.json").write_text(output, encoding="utf-8", newline="\n")
    print(json.dumps({
        "editions": len(profiles), "with_notes": sum(bool(p["notes"]) for p in profiles),
        "with_performance": sum(bool(p["performance"]) for p in profiles),
        "with_photo": sum("photo" in p for p in profiles),
        "with_official_reference": sum(any(s["kind"] == "house" for s in p["sources"]) for p in profiles),
    }))


if __name__ == "__main__":
    main()
