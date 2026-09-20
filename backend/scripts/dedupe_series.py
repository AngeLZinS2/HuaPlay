"""Merge duplicate series records created by re-running the scraper.

The catalog holds 46 titles twice, differing only in capitalisation. They are
not identical copies: one "Chọc Tức Vợ Yêu" carries 11 Pixeldrain links and the
other 25, so simply deleting one loses playable episodes.

Strategy: keep the most complete record, copy into it any link the duplicate has
and it lacks, then delete the duplicate. Series-level fields (poster, synopsis,
trailer) are filled the same way — only where the keeper is empty, never
overwriting what it already has.

    python scripts/dedupe_series.py                # dry run
    python scripts/dedupe_series.py --report r.json
    python scripts/dedupe_series.py --apply        # merge and delete

Note: likes / my-list / watch history live in Firestore keyed by series id, so
any document pointing at a deleted id is orphaned. The report lists every
removed id for that reason.
"""
import argparse
import json
import os
import re
import sqlite3
import unicodedata
from collections import defaultdict

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "weifansub.db")

LINK_FIELDS = [
    "embed_url_1", "embed_url_2", "youtube_link", "drive_link",
    "pixeldrain_link", "mega_link", "mediafire_link", "download_link",
    "external_link",
]
SERIES_FIELDS = [
    "cover_image", "banner_image", "description", "trailer_url", "cast",
    "genre", "country", "status", "release_year",
]


def normalize(title: str) -> str:
    text = unicodedata.normalize("NFKD", title or "").encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-z0-9 ]", " ", text.lower())
    return re.sub(r"\s+", " ", text).strip()


def filled(value) -> bool:
    return value is not None and str(value).strip() != ""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="write changes (default is a dry run)")
    parser.add_argument("--report", default="", help="write the plan as JSON here")
    args = parser.parse_args()

    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row

    rows = db.execute("select * from series").fetchall()

    def episode_count(series_id: int) -> int:
        return db.execute(
            "select count(*) from episodes where series_id = ?", (series_id,)
        ).fetchone()[0]

    # A shared title alone is not proof: two different shows can carry one. The
    # release year is the corroborating signal — except when one record is a stub
    # from a partial scrape, which also got its year wrong. Those merge anyway.
    STUB_EPISODES = 3
    by_title = defaultdict(list)
    for row in rows:
        by_title[normalize(row["title"])].append(row)

    groups = defaultdict(list)
    for title_key, candidates in by_title.items():
        stubs = [r for r in candidates if episode_count(r["id"]) < STUB_EPISODES]
        full = [r for r in candidates if episode_count(r["id"]) >= STUB_EPISODES]
        if len(full) == 1 and stubs:
            groups[(title_key, full[0]["release_year"])].extend(full + stubs)
            continue
        for row in candidates:
            groups[(title_key, row["release_year"])].append(row)
    duplicates = {key: group for key, group in groups.items() if len(group) > 1}

    link_condition = " or ".join(f"({f} is not null and trim({f}) <> '')" for f in LINK_FIELDS)

    def completeness(series_id: int):
        with_link = db.execute(
            f"select count(*) from episodes where series_id = ? and ({link_condition})",
            (series_id,),
        ).fetchone()[0]
        total = db.execute(
            "select count(*) from episodes where series_id = ?", (series_id,)
        ).fetchone()[0]
        return with_link, total

    plan = []
    for (title_key, year), group in sorted(duplicates.items()):
        ranked = sorted(
            group,
            # Most playable episodes first; the lowest id breaks ties because it
            # is the record any existing reference is most likely pointing at.
            key=lambda r: (-completeness(r["id"])[0], -completeness(r["id"])[1], r["id"]),
        )
        keeper, losers = ranked[0], ranked[1:]
        entry = {
            "keep": {"id": keeper["id"], "title": keeper["title"],
                     "episodes_with_link": completeness(keeper["id"])[0]},
            "remove": [{"id": l["id"], "title": l["title"],
                        "episodes_with_link": completeness(l["id"])[0]} for l in losers],
            "year": year,
            "link_fills": 0,
            "field_fills": [],
        }

        for loser in losers:
            # --- series-level fields, only where the keeper is empty ---
            for field in SERIES_FIELDS:
                if not filled(keeper[field]) and filled(loser[field]):
                    entry["field_fills"].append(field)
                    if args.apply:
                        db.execute(
                            f"update series set {field} = ? where id = ?",
                            (loser[field], keeper["id"]),
                        )

            # --- episode links, matched by episode number ---
            keeper_eps = {
                e["episode_number"]: e
                for e in db.execute(
                    "select * from episodes where series_id = ?", (keeper["id"],)
                ).fetchall()
            }
            for loser_ep in db.execute(
                "select * from episodes where series_id = ?", (loser["id"],)
            ).fetchall():
                target = keeper_eps.get(loser_ep["episode_number"])
                if target is None:
                    # The keeper is missing this episode entirely: move it over.
                    entry["link_fills"] += 1
                    if args.apply:
                        db.execute(
                            "update episodes set series_id = ? where id = ?",
                            (keeper["id"], loser_ep["id"]),
                        )
                    continue
                for field in LINK_FIELDS:
                    if not filled(target[field]) and filled(loser_ep[field]):
                        entry["link_fills"] += 1
                        if args.apply:
                            db.execute(
                                f"update episodes set {field} = ? where id = ?",
                                (loser_ep[field], target["id"]),
                            )

            if args.apply:
                # featured_config may point at the record about to disappear.
                db.execute(
                    "update featured_config set manual_series_id = ? where manual_series_id = ?",
                    (keeper["id"], loser["id"]),
                )
                db.execute("delete from episodes where series_id = ?", (loser["id"],))
                db.execute("delete from series where id = ?", (loser["id"],))

        plan.append(entry)

    removed = [r["id"] for e in plan for r in e["remove"]]
    total_link_fills = sum(e["link_fills"] for e in plan)

    print(f"grupos duplicados : {len(plan)}")
    print(f"registros a remover: {len(removed)}")
    print(f"links recuperados  : {total_link_fills}")
    print(f"campos preenchidos : {sum(len(e['field_fills']) for e in plan)}")
    print()
    for entry in plan[:12]:
        keep = entry["keep"]
        gone = ", ".join(f"#{r['id']} ({r['episodes_with_link']} eps)" for r in entry["remove"])
        print(f"  manter #{keep['id']:<5} {keep['title'][:38]:<38} "
              f"({keep['episodes_with_link']} eps) <- remover {gone}"
              + (f"  [+{entry['link_fills']} links]" if entry["link_fills"] else ""))
    if len(plan) > 12:
        print(f"  ... e mais {len(plan) - 12} grupos")

    if args.report:
        json.dump(plan, open(args.report, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"\nrelatorio: {args.report}")

    if args.apply:
        db.commit()
        print(f"\naplicado. ids removidos: {removed}")
    else:
        print("\n(dry run — nada foi gravado; use --apply para gravar)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
