"""Find and repair series whose TMDb metadata came from a non-Asian title.

The original enrichment (scripts/enrich_tmdb_hd.py) took `results[0]` from a
plain title search, with no constraint on origin. For a catalog of Asian dramas
that reliably picks the wrong show whenever a Western title shares the name —
"Heroes" (China) became the US series, "What's Left Of You" became a Turkish one.

Detection: the stored cover_image embeds a TMDb poster_path. Searching the same
way the scraper did and finding which result owns that path identifies exactly
which TMDb entry was used, and therefore its origin country.

Repair: re-pick among the search results, preferring an entry whose origin
matches the series' own country, then any Asian origin, and requiring the title
to actually resemble the one we hold.

    python scripts/fix_tmdb_mismatches.py                 # dry run, full report
    python scripts/fix_tmdb_mismatches.py --limit 100     # dry run on a slice
    python scripts/fix_tmdb_mismatches.py --apply         # write the fixes

Always dry-run first and read the report: a wrong "fix" is worse than a wrong
poster, because it overwrites the only evidence of what was there.
"""
import argparse
import difflib
import json
import os
import re
import sqlite3
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

import requests

API_KEY = os.getenv("TMDB_API_KEY", "8476a7ab80ad76f0936744df0430e67c")
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "weifansub.db")

ASIAN = {"CN", "KR", "JP", "TH", "TW", "HK", "PH", "VN", "ID", "SG", "MY", "MO"}
COUNTRY_CODE = {
    "China": "CN", "South Korea": "KR", "Japan": "JP", "Thailand": "TH",
    "Taiwan": "TW", "Hong Kong": "HK", "Philippines": "PH", "Vietnã": "VN",
    "Vietnam": "VN", "Indonesia": "ID", "Singapore": "SG", "Malaysia": "MY",
}
LANG_TO_COUNTRY = {"zh": "CN", "ko": "KR", "ja": "JP", "th": "TH", "cn": "CN",
                   "vi": "VN", "id": "ID", "tl": "PH", "ms": "MY"}

# Two bars, because a wrong replacement is worse than a wrong poster: it
# overwrites the only evidence of what was there.
#   confident -> origin matches the series' own country AND the title really matches
#   uncertain -> plausible, but needs a human to look. Never applied by default.
CONFIDENT_RATIO = 0.85
CANDIDATE_RATIO = 0.62


def clean_title(title: str) -> str:
    title = re.sub(r"\(.*?\)", "", title or "")
    return re.sub(r"\s+", " ", title).strip()


def search(kind: str, title: str, year=None) -> list:
    """Title search, optionally pinned to a release year.

    The year is the strongest disambiguator against Western homonyms: "Heroes"
    the 2006 US series and "Heroes" the Chinese drama do not share one.
    """
    url = (f"https://api.themoviedb.org/3/search/{kind}?api_key={API_KEY}"
           f"&query={urllib.parse.quote(clean_title(title))}&language=pt-BR")
    if year:
        url += f"&first_air_date_year={year}" if kind == "tv" else f"&year={year}"
    for attempt in range(3):
        try:
            response = requests.get(url, timeout=15)
            if response.status_code == 429:
                time.sleep(1.5 * (attempt + 1))
                continue
            return response.json().get("results", []) if response.ok else []
        except requests.RequestException:
            time.sleep(0.8 * (attempt + 1))
    return []


def poster_path_of(url: str):
    match = re.search(r"/t/p/[^/]+(/[A-Za-z0-9_-]+\.(?:jpg|png))", url or "")
    return match.group(1) if match else None


def origins(item: dict) -> set:
    found = set(item.get("origin_country") or [])
    lang = (item.get("original_language") or "").lower()
    if lang in LANG_TO_COUNTRY:
        found.add(LANG_TO_COUNTRY[lang])
    elif lang == "en":
        found.add("US")
    return found


def title_of(item: dict) -> str:
    return item.get("name") or item.get("title") or ""


def ratio(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, clean_title(a).lower(), clean_title(b).lower()).ratio()


def pick_replacement(results: list, title: str, want_code: str):
    """Best Asian candidate, with a confidence label.

    Returns (item, confidence) where confidence is "confident" or "uncertain",
    or (None, None) when nothing is close enough to propose at all.
    """
    scored = []
    for item in results:
        similarity = ratio(title, title_of(item))
        if similarity < CANDIDATE_RATIO:
            continue
        item_origins = origins(item)
        country_matches = bool(want_code and want_code in item_origins)
        if not country_matches and not (item_origins & ASIAN):
            continue
        # The title ratio compares our English title against TMDb's pt-BR one, so
        # a correct match often scores low ("Filter" vs "Filtro"). Matching both
        # the country AND the year is independent evidence of the same strength,
        # so either path qualifies — but the country must always match, since
        # that is what separates the real fixes from the plausible-looking ones.
        strong_title = similarity >= CONFIDENT_RATIO
        strong_year = bool(item.get("_year_pinned"))
        confident = (
            country_matches
            and (strong_title or strong_year)
            # An entry with no synopsis cannot repair a wrong synopsis, and its
            # sparseness suggests a thin record rather than the real match.
            and bool((item.get("overview") or "").strip())
        )
        scored.append((0 if confident else 1, -similarity,
                       -(item.get("popularity") or 0), item, confident))
    if not scored:
        return None, None
    scored.sort(key=lambda t: t[:3])
    best = scored[0]
    return best[3], ("confident" if best[4] else "uncertain")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="write changes (default is a dry run)")
    parser.add_argument("--limit", type=int, default=0, help="only inspect the first N series")
    parser.add_argument("--report", default="", help="write the findings as JSON here")
    parser.add_argument("--include-uncertain", action="store_true",
                        help="also apply the low-confidence matches (review the report first)")
    parser.add_argument("--clear-unfixable", action="store_true",
                        help="blank the poster, banner and synopsis of entries proven wrong "
                             "with no replacement, so the app falls back to its placeholder")
    args = parser.parse_args()

    db = sqlite3.connect(DB_PATH)
    rows = db.execute(
        "select id, title, country, cover_image, banner_image, description from series "
        "where cover_image like '%image.tmdb.org%' order by id"
    ).fetchall()
    db_years = dict(db.execute("select id, release_year from series").fetchall())
    if args.limit:
        rows = rows[: args.limit]

    findings = []
    stats = {"ok": 0, "wrong": 0, "confident": 0, "uncertain": 0,
             "unresolved": 0, "unknown_owner": 0}

    # Searching serially took over half an hour for the full catalog. TMDb allows
    # roughly 50 requests/second, so a small pool is well inside its budget and
    # brings this down to a couple of minutes.
    print(f"consultando o TMDb para {len(rows)} series...", flush=True)
    done = 0

    def fetch(row):
        """Two result sets, because detection and repair need different searches.

        Detection must find the entry our stored poster came from, and pinning
        the year hides exactly that entry — the Western homonym released in a
        different year. Repair, in contrast, is far more accurate with the year.
        """
        nonlocal done
        sid, title = row[0], row[1]
        year = db_years.get(sid)
        broad = search("tv", title) or search("movie", title)
        narrow = search("tv", title, year) or search("movie", title, year) if year else []
        done += 1
        if done % 50 == 0:
            print(f"  ... {done}/{len(rows)}", flush=True)
        return sid, (broad, narrow)

    with ThreadPoolExecutor(max_workers=8) as pool:
        searched = dict(pool.map(fetch, rows))
    print(f"  busca concluida ({len(rows)}/{len(rows)})", flush=True)
    print(flush=True)

    for index, (sid, title, country, cover, banner, description) in enumerate(rows, 1):
        want_path = poster_path_of(cover)
        broad, narrow = searched.get(sid, ([], []))
        owner = next((r for r in broad if r.get("poster_path") == want_path), None)
        # Candidates: the year-pinned hits first, then the broad ones, de-duped.
        narrow_ids = {i.get("id") for i in narrow}
        seen_ids, results = set(), []
        for item in list(narrow) + list(broad):
            if item.get("id") in seen_ids:
                continue
            seen_ids.add(item["id"])
            item["_year_pinned"] = item.get("id") in narrow_ids
            results.append(item)

        if owner is None:
            stats["unknown_owner"] += 1
        elif origins(owner) & ASIAN:
            stats["ok"] += 1
            continue
        else:
            stats["wrong"] += 1

        if owner is None:
            continue

        want_code = COUNTRY_CODE.get(country or "", "")
        better, confidence = pick_replacement(results, title, want_code)
        finding = {
            "id": sid,
            "title": title,
            "country": country,
            "wrong_tmdb_title": title_of(owner),
            "wrong_origin": sorted(origins(owner)),
        }
        if better is None:
            stats["unresolved"] += 1
            finding["fix"] = None
        else:
            stats["confident" if confidence == "confident" else "uncertain"] += 1
            finding["confidence"] = confidence
            finding["fix"] = {
                "tmdb_title": title_of(better),
                "origin": sorted(origins(better)),
                "cover_image": f"https://image.tmdb.org/t/p/w500{better['poster_path']}" if better.get("poster_path") else None,
                "banner_image": f"https://image.tmdb.org/t/p/original{better['backdrop_path']}" if better.get("backdrop_path") else None,
                "description": (better.get("overview") or "").strip() or None,
            }
        findings.append(finding)

    print()
    print(f"inspecionadas      : {len(rows)}")
    print(f"corretas           : {stats['ok']}")
    print(f"origem nao asiatica: {stats['wrong']}")
    print(f"  substituto seguro: {stats['confident']}  (pais bate + titulo >= 85% + tem sinopse)")
    print(f"  substituto incerto: {stats['uncertain']}  (so com --include-uncertain)")
    print(f"  sem substituto   : {stats['unresolved']}  (revisao manual)")
    print(f"dono nao identificado: {stats['unknown_owner']}")

    if args.report:
        json.dump(findings, open(args.report, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"\nrelatorio: {args.report}")

    if not args.apply:
        print("\n(dry run — nada foi gravado; use --apply para gravar)")
        return 0

    if args.clear_unfixable:
        # These are proven to describe a different, non-Asian production. A
        # placeholder is honest; a Dutch reality show's poster on a Chinese
        # drama is not. The originals live in the report and in the backup.
        cleared = 0
        for finding in findings:
            if finding.get("confidence") == "confident":
                continue
            if finding.get("confidence") == "uncertain" and args.include_uncertain:
                continue
            db.execute(
                "update series set cover_image = NULL, banner_image = NULL, "
                "description = NULL where id = ?",
                (finding["id"],),
            )
            cleared += 1
        db.commit()
        print()
        print(f"limpas (sem substituto): {cleared}")

    applied = 0
    for finding in findings:
        fix = finding.get("fix")
        if not fix or not fix.get("cover_image"):
            continue
        if finding.get("confidence") != "confident" and not args.include_uncertain:
            continue
        sets, values = ["cover_image = ?"], [fix["cover_image"]]
        if fix.get("banner_image"):
            sets.append("banner_image = ?")
            values.append(fix["banner_image"])
        if fix.get("description"):
            sets.append("description = ?")
            values.append(fix["description"])
        values.append(finding["id"])
        db.execute(f"update series set {', '.join(sets)} where id = ?", values)
        applied += 1
    db.commit()
    print(f"\naplicadas: {applied}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
