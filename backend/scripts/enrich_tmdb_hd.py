#!/usr/bin/env python3
"""
HuaPlay TMDB HD Media & Trailer Enricher
========================================
Finds High-Quality Posters (w500), Full HD Banners (original/w1280),
and YouTube Trailers for ALL 1,229 series and movies in the database.

Usage:
    python enrich_tmdb_hd.py [--limit N]
"""

import re
import sys
import time
import sqlite3
import requests
import urllib.parse

# Force UTF-8 on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

DB_PATH = "weifansub.db"
API_KEY = "8476a7ab80ad76f0936744df0430e67c"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) HuaPlay HD Enricher/1.0",
}

# ─── YOUTUBE FALLBACK TRAILER SEARCH ──────────────────────────────────────────

def get_youtube_trailer_fallback(title):
    try:
        clean_name = re.sub(r'[\(\):–\-\[\]]', ' ', title).strip()
        q = urllib.parse.quote(clean_name + ' trailer legendado')
        r = requests.get('https://www.youtube.com/results?search_query=' + q, headers=HEADERS, timeout=6)
        vids = re.findall(r'/watch\?v=([a-zA-Z0-9_-]{11})', r.text)
        if vids:
            return 'https://www.youtube.com/watch?v=' + vids[0]
    except Exception:
        pass
    return None


# ─── TMDB SEARCH ──────────────────────────────────────────────────────────────

def clean_title_for_search(title):
    # Remove Season 01, Special, year in parenthesis, etc.
    t = re.sub(r'\s*\(.*?\)', '', title)
    t = re.sub(r':?\s*Season\s*\d+', '', t, flags=re.I)
    t = re.sub(r':?\s*Temporada\s*\d+', '', t, flags=re.I)
    t = re.sub(r'\s*\d{4}$', '', t)
    return t.strip()


def fetch_tmdb_media(title):
    search_title = clean_title_for_search(title)
    
    # 1. Search TV
    url_tv = f"https://api.themoviedb.org/3/search/tv?api_key={API_KEY}&query={urllib.parse.quote(search_title)}&language=pt-BR"
    r = requests.get(url_tv, timeout=10)
    results = r.json().get("results", []) if r.ok else []
    media_type = "tv"

    # 2. If no TV results, Search Movie
    if not results:
        url_mov = f"https://api.themoviedb.org/3/search/movie?api_key={API_KEY}&query={urllib.parse.quote(search_title)}&language=pt-BR"
        r = requests.get(url_mov, timeout=10)
        results = r.json().get("results", []) if r.ok else []
        media_type = "movie"

    if not results:
        return None

    item = results[0]
    poster_path = item.get("poster_path")
    backdrop_path = item.get("backdrop_path")
    overview = item.get("overview")

    poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None
    banner_url = f"https://image.tmdb.org/t/p/original{backdrop_path}" if backdrop_path else None

    # Fetch YouTube Trailer
    trailer_url = None
    media_id = item.get("id")
    if media_id:
        r_vid = requests.get(f"https://api.themoviedb.org/3/{media_type}/{media_id}/videos?api_key={API_KEY}&language=pt-BR", timeout=8)
        vids = r_vid.json().get("results", []) if r_vid.ok else []
        if not vids:
            r_vid = requests.get(f"https://api.themoviedb.org/3/{media_type}/{media_id}/videos?api_key={API_KEY}&language=en-US", timeout=8)
            vids = r_vid.json().get("results", []) if r_vid.ok else []

        if vids:
            trailer = next((v for v in vids if v.get("type") in ["Trailer", "Teaser"] and v.get("site") == "YouTube"), vids[0])
            if trailer.get("key"):
                trailer_url = f"https://www.youtube.com/watch?v={trailer['key']}"

    # YouTube Fallback if no trailer found via TMDB
    if not trailer_url:
        trailer_url = get_youtube_trailer_fallback(title)

    return {
        "poster_url": poster_url,
        "banner_url": banner_url,
        "trailer_url": trailer_url,
        "overview": overview
    }


# ─── MAIN PROCESS ─────────────────────────────────────────────────────────────

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    series_list = cur.execute("SELECT id, title, cover_image, banner_image, trailer_url FROM series").fetchall()
    total = len(series_list)

    print("="*60)
    print("🎬 HuaPlay HD Media & Trailer Enricher")
    print("="*60)
    print(f"Total Series to process: {total}")
    print("="*60 + "\n")

    updated_posters = 0
    updated_banners = 0
    updated_trailers = 0

    for idx, (sid, title, curr_cover, curr_banner, curr_trailer) in enumerate(series_list, 1):
        progress = f"[{idx}/{total}]"
        
        try:
            media = fetch_tmdb_media(title)
        except Exception as e:
            print(f"{progress} ❌ Error fetching {title}: {e}")
            time.sleep(0.5)
            continue

        if not media:
            # Try youtube trailer fallback even if TMDB fails
            fallback_yt = get_youtube_trailer_fallback(title)
            if fallback_yt and fallback_yt != curr_trailer:
                cur.execute("UPDATE series SET trailer_url = ? WHERE id = ?", (fallback_yt, sid))
                updated_trailers += 1
                conn.commit()
                print(f"{progress} 📺 Found YouTube Trailer Fallback: {title}")
            else:
                print(f"{progress} ⚠️ TMDB Not Found: {title}")
            time.sleep(0.3)
            continue

        new_cover = media.get("poster_url") or curr_cover
        new_banner = media.get("banner_url") or curr_banner
        new_trailer = media.get("trailer_url") or curr_trailer or get_youtube_trailer_fallback(title)

        updates = []
        params = []

        if media.get("poster_url") and media["poster_url"] != curr_cover:
            updates.append("cover_image = ?")
            params.append(media["poster_url"])
            updated_posters += 1

        if media.get("banner_url") and media["banner_url"] != curr_banner:
            updates.append("banner_image = ?")
            params.append(media["banner_url"])
            updated_banners += 1

        if new_trailer and new_trailer != curr_trailer:
            updates.append("trailer_url = ?")
            params.append(new_trailer)
            updated_trailers += 1

        if updates:
            sql = f"UPDATE series SET {', '.join(updates)} WHERE id = ?"
            params.append(sid)
            cur.execute(sql, tuple(params))
            conn.commit()
            print(f"{progress} ✅ Updated: {title} (Posters: {'+Poster ' if media.get('poster_url') else ''}{'+Banner ' if media.get('banner_url') else ''}{'+Trailer' if new_trailer else ''})")
        else:
            print(f"{progress} ⏭️ No change: {title}")

        time.sleep(0.25)

    conn.commit()
    conn.close()

    print("\n" + "="*60)
    print("🎉 HD MEDIA & TRAILERS ENRICHMENT COMPLETE!")
    print("="*60)
    print(f"  🖼️ HD Posters Updated:   {updated_posters}")
    print(f"  🎨 Full HD Banners Updated: {updated_banners}")
    print(f"  📺 YouTube Trailers Added: {updated_trailers}")
    print("="*60)


if __name__ == "__main__":
    main()
