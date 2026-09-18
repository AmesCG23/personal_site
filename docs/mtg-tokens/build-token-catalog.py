#!/usr/bin/env python3
"""
build-token-catalog.py — turn the Cockatrice community token database into the
compact JSON catalog the token app ships with.

Source (open data, updated by volunteers, served from GitHub so it works even
from sandboxes that block scryfall.com):
    https://raw.githubusercontent.com/Cockatrice/Magic-Token/master/tokens.xml

What it produces (next to this script, or wherever --out points):
    tokens.json   — one record per distinct token "shape" (name + type line +
                    P/T + colours + rules text), sorted by popularity (how
                    many real Magic cards create that token), plus every
                    printing of that token with its Scryfall id. Image URLs
                    are NOT stored; derive them from the id:
                      https://cards.scryfall.io/<size>/front/<id[0]>/<id[1]>/<id>.jpg
                      size = small | normal | large | art_crop | border_crop The app reads this file to (a) know that "Goblin"
                    means a 1/1 red Goblin creature, and (b) offer a gallery
                    of official art for that token without a live API call.

Usage:
    python3 build-token-catalog.py                # downloads tokens.xml, writes tokens.json
    python3 build-token-catalog.py --xml tokens.xml --out ../../sandbox/data/tokens.json
    python3 build-token-catalog.py --min-makers 3  # only tokens created by >=3 cards

No third-party dependencies. Python 3.8+.
"""
import argparse, json, re, sys, urllib.request, datetime
import xml.etree.ElementTree as ET

SRC = "https://raw.githubusercontent.com/Cockatrice/Magic-Token/master/tokens.xml"

# Cockatrice colour letters -> Magic colour words, in the canonical WUBRG order.
COLOR_ORDER = "WUBRG"
KEYWORD_RE = re.compile(r"^(Flying|Vigilance|Trample|Haste|Lifelink|Deathtouch|Menace|First strike|Double strike|Reach|Defender|Hexproof|Indestructible|Flash|Toxic \d|Decayed|Changeling|Prowess|Ward \{\d\})\b", re.I)

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def scryfall_id_from_pic(url):
    m = re.search(r"/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png)", url or "")
    return m.group(1) if m else None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--xml", help="local tokens.xml (default: download)")
    ap.add_argument("--out", default="tokens.json")
    ap.add_argument("--min-makers", type=int, default=1,
                    help="drop tokens created by fewer than this many cards (default 1 = keep all)")
    ap.add_argument("--only-tokens", action="store_true", default=True,
                    help="skip emblems, counters, dungeons, helper cards (default on)")
    args = ap.parse_args()

    if args.xml:
        xml_bytes = open(args.xml, "rb").read()
    else:
        req = urllib.request.Request(SRC, headers={"User-Agent": "amesgrawert-token-catalog/1.0"})
        xml_bytes = urllib.request.urlopen(req, timeout=60).read()

    root = ET.fromstring(xml_bytes)
    source_version = root.findtext("info/sourceVersion")
    records = []
    for card in root.find("cards").findall("card"):
        name_raw = card.findtext("name") or ""
        name = name_raw.strip()                     # Cockatrice disambiguates variants with trailing spaces
        prop = card.find("prop")
        type_line = (prop.findtext("type") or "").strip()
        is_token = (card.findtext("token") == "1") and type_line.startswith("Token")
        if args.only_tokens and not is_token:
            continue
        pt = (prop.findtext("pt") or "").strip()
        power, toughness = (pt.split("/", 1) + [None])[:2] if "/" in pt else (None, None)
        colors_raw = (prop.findtext("colors") or "").strip()
        colors = [c for c in COLOR_ORDER if c in colors_raw]
        text = (card.findtext("text") or "").strip()
        makers = list(dict.fromkeys(rr.text for rr in card.findall("reverse-related") if rr.text))
        printings = []
        for s in card.findall("set"):
            sid = s.get("uuid") or scryfall_id_from_pic(s.get("picURL"))
            printings.append({
                "set": (s.text or "").strip().lower(),
                "cn": s.get("num"),
                "id": sid,                    # Scryfall card id; image URL is derived from it (see README)
                "artist": None,               # filled later by enrich-from-scryfall.mjs (needs live API)
            })
        # Display name: Cockatrice says "Goblin Token"; Scryfall and players say "Goblin".
        display = re.sub(r"\s+Token$", "", name)
        subtypes = type_line.split("—", 1)[1].strip().split() if "—" in type_line else []
        supertypes_types = type_line.split("—", 1)[0].replace("Token", "").split()
        keywords = [ln.strip() for ln in text.split("\n") if KEYWORD_RE.match(ln.strip())]
        records.append({
            "id": slug(f"{display}-{'-'.join(colors) or 'c'}-{pt or 'x'}-{len(records)}"),
            "name": display,
            "type_line": type_line,
            "types": supertypes_types,
            "subtypes": subtypes,
            "is_creature": "Creature" in supertypes_types,
            "is_artifact": "Artifact" in supertypes_types,
            "power": power, "toughness": toughness,
            "colors": colors,
            "text": text,
            "keywords": keywords,
            "makers_count": len(makers),
            "makers_sample": makers[:8],
            "printings_count": len(printings),
            "printings": printings,
        })

    records = [r for r in records if r["makers_count"] >= args.min_makers]
    records.sort(key=lambda r: (-r["makers_count"], r["name"]))
    out = {
        "generated_at": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "source": SRC,
        "source_version": source_version,
        "license_note": "Token metadata from the Cockatrice Magic-Token project (community-maintained). Images are Scryfall CDN links to Wizards of the Coast card art; non-commercial use under the Wizards Fan Content Policy. Show artist credit next to any art crop.",
        "count": len(records),
        "tokens": records,
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {args.out}: {len(records)} tokens, source version {source_version}", file=sys.stderr)

if __name__ == "__main__":
    main()
