"""Fold series that are really seasons of one show into a single record.

"A Record of A Mortal's Journey to Immortality" was stored as six separate
series (base, S02..S05, Special). To the recommender those are six distinct
works sharing every feature, so watching one made the other five surface as
near-identical recommendations — the repetition users notice on the home page.

This moves the sibling records' episodes onto the parent, stamping each with its
season number, then deletes the now-empty sibling. Specials and OVAs become
season 0, the convention TMDb and Plex use.

    python scripts/merge_seasons.py                # dry run
    python scripts/merge_seasons.py --report r.json
    python scripts/merge_seasons.py --apply

Episode numbering restarts per season, so (series_id, season_number,
episode_number) stays unique and no renumbering is needed.
"""
import argparse
import json
import os
import re
import sqlite3
import unicodedata
from collections import defaultdict

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "weifansub.db")

# Trailing season markers, matched one at a time from the end of the title.
SEASON_SUFFIX = re.compile(
    r"\s*[:\-–]?\s*(?:"
    r"\b(?:S|Season|Temporada|Part|Parte)\s*0*(\d{1,2})\b"
    r"|\b(\d{1,2})(?:st|nd|rd|th)\s+Season\b"
    r"|\b(Special|Specials|OVA|SP)\b"
    r")\s*$",
    re.I,
)
SPECIAL_SEASON = 0


def normalize(title: str) -> str:
    text = unicodedata.normalize("NFKD", title or "").encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-z0-9 ]", " ", text.lower())
    return re.sub(r"\s+", " ", text).strip()


def split_season(title: str):
    """(base title, season number or None) for one trailing marker."""
    match = SEASON_SUFFIX.search(title or "")
    if not match:
        return title, None
    base = title[: match.start()].strip()
    number, ordinal, special = match.group(1), match.group(2), match.group(3)
    if special:
        return base, SPECIAL_SEASON
    return base, int(number or ordinal)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--report", default="")
    args = parser.parse_args()

    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    rows = db.execute("select id, title, release_year from series").fetchall()

    families = defaultdict(list)
    for row in rows:
        base, season = split_season(row["title"])
        families[normalize(base)].append((row, season))

    plan = []
    for base_key, members in sorted(families.items()):
        if len(members) < 2 or not any(season is not None for _, season in members):
            continue

        # The parent is the record carrying no marker; failing that, the lowest
        # numbered season. Specials sort last so a family of [Special, S02] does
        # not elect the special as the parent. The parent's id is kept, so links
        # and bookmarks that already point at it stay valid.
        def parent_rank(member):
            _, season = member
            if season is None:
                return (0, 0)
            return (1, 999 if season == SPECIAL_SEASON else season)

        parent_row, parent_marker = min(
            members, key=lambda m: (*parent_rank(m), m[0]["id"])
        )
        parent_season = 1 if parent_marker is None else parent_marker

        siblings = [(r, s) for r, s in members if r["id"] != parent_row["id"]]
        base_title = split_season(parent_row["title"])[0]

        entry = {
            "parent": {"id": parent_row["id"], "title": parent_row["title"],
                       "new_title": base_title, "season": parent_season},
            "seasons": [],
        }
        for row, season in siblings:
            if season is None:
                # Same base title but no marker on either: not a season split.
                continue
            count = db.execute(
                "select count(*) from episodes where series_id = ?", (row["id"],)
            ).fetchone()[0]
            entry["seasons"].append(
                {"from_id": row["id"], "title": row["title"], "season": season, "episodes": count}
            )
        if not entry["seasons"]:
            continue
        plan.append(entry)

        if args.apply:
            db.execute(
                "update episodes set season_number = ? where series_id = ?",
                (parent_season, parent_row["id"]),
            )
            if base_title and base_title != parent_row["title"]:
                db.execute(
                    "update series set title = ? where id = ?", (base_title, parent_row["id"])
                )
            for season_entry in entry["seasons"]:
                db.execute(
                    "update episodes set series_id = ?, season_number = ? where series_id = ?",
                    (parent_row["id"], season_entry["season"], season_entry["from_id"]),
                )
                db.execute(
                    "update featured_config set manual_series_id = ? where manual_series_id = ?",
                    (parent_row["id"], season_entry["from_id"]),
                )
                db.execute("delete from series where id = ?", (season_entry["from_id"],))

    print(f"familias encontradas: {len(plan)}")
    print(f"registros a remover : {sum(len(e['seasons']) for e in plan)}")
    print()
    for entry in plan:
        parent = entry["parent"]
        print(f"  #{parent['id']:<5} {parent['new_title'][:46]:<46} (T{parent['season']})")
        for season_entry in sorted(entry["seasons"], key=lambda s: s["season"]):
            label = "Especiais" if season_entry["season"] == SPECIAL_SEASON else f"T{season_entry['season']}"
            print(f"        <- #{season_entry['from_id']:<5} {season_entry['title'][:44]:<44} "
                  f"vira {label} ({season_entry['episodes']} eps)")

    if args.report:
        json.dump(plan, open(args.report, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"\nrelatorio: {args.report}")

    if args.apply:
        db.commit()
        print("\naplicado.")
    else:
        print("\n(dry run — nada foi gravado; use --apply para gravar)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
