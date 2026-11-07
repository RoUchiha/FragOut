"""Build the checked-in catalog from three licensed data downloads and reviewed references."""
import argparse
import csv
import json
import re
import unicodedata
from collections import defaultdict
from datetime import date
from pathlib import Path
from urllib.parse import urlencode, urlsplit


ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "catalog"
IDENTITY = json.loads((CATALOG / "identity.json").read_text(encoding="utf-8"))
LINKS = json.loads((CATALOG / "links.json").read_text(encoding="utf-8"))
PHOTOS = json.loads((CATALOG / "photos.json").read_text(encoding="utf-8"))
CC_BY = {"name": "CC BY 4.0", "url": "https://creativecommons.org/licenses/by/4.0/"}
STAGES = ("top", "heart", "base")
SOURCE_STAGES = (*STAGES, "listed")
CONCENTRATIONS = {
    "eau de toilette": "EDT", "edt": "EDT", "eau de parfum": "EDP",
    "edp": "EDP", "parfum": "PARFUM", "elixir": "ELIXIR", "oil": "OIL",
}
THROW_STARS = {
    "intimate": 1, "soft intimate": 1.5, "soft": 2, "soft moderate": 2.5,
    "moderate": 3, "moderate strong": 3.5, "strong": 4, "very strong": 5, "enormous": 5,
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


def hour_band(value):
    band = re.search(r"(\d+)\s*[-–]\s*(\d+)\s*h", value, re.IGNORECASE)
    if not band or not 0 < int(band[1]) <= int(band[2]) <= 48:
        return None
    return int(band[1]), int(band[2])


def hours(value):
    band = hour_band(value)
    return f"{band[0]}–{band[1]} h" if band else None


def wear_ratings(csv_row, index_row):
    ratings = []
    sources = (
        (csv_row, "mysecretcart", "typical_wear", "sillage"),
        (index_row, "gouttes", "longevity", "projection"),
    )
    for row, source, duration_key, throw_facet in sources:
        if not row:
            continue
        band = hour_band(row[duration_key])
        if band:
            # Two hours per star, in half-star steps with one- and five-star bounds.
            midpoint_hours = (band[0] + band[1] + 1) // 2
            ratings.append({"facet": "longevity", "sourceId": source, "kind": "estimate",
                            "score": min(5, max(1, midpoint_hours / 2)),
                            "basis": f"{band[0]}–{band[1]} h"})
        # The Gouttes index calls its projection assessment "sillage" in the JSON.
        throw = row["sillage"].strip()
        score = THROW_STARS.get(normalize(throw))
        if score:
            ratings.append({"facet": throw_facet, "sourceId": source, "kind": "estimate",
                            "score": score, "basis": throw.capitalize()})
    return ratings


def quick_links(profile_id, brand, name, concentration, sources):
    reviewed = LINKS.get(profile_id, {})
    links = []
    if reviewed.get("fragrantica"):
        url = reviewed["fragrantica"]
        parsed = urlsplit(url)
        if parsed.netloc != "www.fragrantica.com" or not parsed.path.startswith("/perfume/") or parsed.scheme != "https":
            raise ValueError(f"Invalid Fragrantica product page: {url}")
        links.append({"label": "View on Fragrantica", "url": url})
    jomashop = reviewed.get("jomashop")
    if jomashop:
        if not re.fullmatch(r"https://www\.jomashop\.com/[a-z0-9-]+\.html", jomashop):
            raise ValueError(f"Invalid Jomashop product page: {jomashop}")
        link = {"label": "View on Jomashop", "url": jomashop, "kind": "jomashop-listing"}
        if reviewed.get("jomashopBottleEdition"):
            link["bottleEdition"] = reviewed["jomashopBottleEdition"]
        links.append(link)
    else:
        query = urlencode({"q": f"{brand} {name} {concentration}"})
        links.append({"label": "Search Jomashop", "url": "https://www.jomashop.com/search?" + query})
    for source in sources:
        if source["id"] == "community":
            links.append({"label": f"View on {source['publisher']}", "url": source["url"]})
        if source["kind"] == "house":
            links.append({"label": "View official page", "url": source["url"]})
    return links


def profile_photos(profile_id, sources):
    photos = []
    files = set()
    for number, photo in enumerate(PHOTOS.get(profile_id, []), start=1):
        filename = photo["file"]
        belongs_to_edition = filename == profile_id or filename.startswith(f"{profile_id}-")
        if not belongs_to_edition or not re.fullmatch(r"[a-z0-9-]+", filename) or filename in files:
            raise ValueError(f"Invalid or duplicate photo name for {profile_id}: {filename}")
        files.add(filename)
        path = f"/catalog/bottles/{filename}.jpg"
        if not (ROOT / "public" / path.lstrip("/")).is_file():
            raise ValueError(f"Missing catalog photo: {path}")
        source_id = "photo" if number == 1 else f"photo-{number}"
        sources.append(make_source(source_id, photo.get("publisher", "Wikimedia Commons"), photo["url"], "photo",
                                   photo["license"], photo["credit"]))
        photos.append({"path": path, "caption": photo["caption"], "sourceId": source_id})
    return photos


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
    release = reviewed.get("release")
    if release:
        sources.append(make_source("release", release["publisher"], release["url"], "reference"))
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
    ratings = wear_ratings(csv_row, index_row)
    if any(rating["sourceId"] == "gouttes" for rating in ratings):
        sources.append(make_source("gouttes", "Gouttes Rares",
                                   "https://gouttesrares.com/pages/fragrance-longevity-sillage-index",
                                   "wear", CC_BY, "Gouttes Rares Longevity & Sillage Index, 2026. In-house wear assessments reformatted."))
    id_ = "-".join(key).replace(" ", "-").lower()
    photos = profile_photos(id_, sources)
    if reviewed.get("communityUrl"):
        sources.append(make_source("community", "Parfumo", reviewed["communityUrl"], "community"))
    if not (notes or performance or photos):
        return None
    brand = reviewed.get("brand") or scento["house"]
    name = reviewed.get("name") or scento["name"]
    entry = {"id": id_, "brand": brand, "name": name, "concentration": key[2], "checkedAt": checked_at,
             "notes": notes, "performance": performance, "ratings": ratings,
             "links": quick_links(id_, brand, name, key[2], sources), "sources": sources}
    years = {int(year) for year in [(release or {}).get("year"), (csv_row or {}).get("year"), (scento or {}).get("year")]
             if year and re.fullmatch(r"\d{4}", str(year))}
    if len(years) > 1:
        raise ValueError(f"Recheck conflicting launch years for {key}")
    if years:
        entry["releaseYear"] = years.pop()
    if photos:
        entry["photo"] = photos[0]
    if len(photos) > 1:
        entry["additionalPhotos"] = photos[1:]
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
    unused = (PHOTOS.keys() | LINKS.keys()) - {entry["id"] for entry in profiles}
    if unused:
        raise ValueError(f"References for unknown editions: {sorted(unused)}")
    output = "[\n" + ",\n".join("  " + json.dumps(row, ensure_ascii=False) for row in profiles) + "\n]\n"
    (CATALOG / "fragrances.json").write_text(output, encoding="utf-8", newline="\n")
    print(json.dumps({
        "editions": len(profiles), "with_notes": sum(bool(p["notes"]) for p in profiles),
        "with_performance": sum(bool(p["performance"]) for p in profiles),
        "with_photo": sum("photo" in p for p in profiles),
        "photos": sum(("photo" in p) + len(p.get("additionalPhotos", [])) for p in profiles),
        "with_official_reference": sum(any(s["kind"] == "house" for s in p["sources"]) for p in profiles),
        "with_ratings": sum(bool(p["ratings"]) for p in profiles),
        "with_fragrantica": sum(any(l["label"] == "View on Fragrantica" for l in p["links"]) for p in profiles),
        "with_jomashop_product": sum(any(l["label"] == "View on Jomashop" for l in p["links"]) for p in profiles),
    }))


if __name__ == "__main__":
    main()
