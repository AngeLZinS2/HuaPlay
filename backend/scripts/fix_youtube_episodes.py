#!/usr/bin/env python3
"""
HuaPlay YouTube & Empty Episode Fixer
=====================================
1. Finds all series in database with empty/null episode links.
2. Refetches the WP post content from weifansub.com.br.
3. Parses YouTube (youtu.be / youtube.com) links and converts them to embed URLs + youtube_link.
4. Updates database episode rows with complete links.
"""

import re
import sys
import time
import sqlite3
import requests
from bs4 import BeautifulSoup

# Force UTF-8 on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

DB_PATH = "weifansub.db"
WEIFANSUB_API = "https://weifansub.com.br/wp-json/wp/v2"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) HuaPlay YT Fixer/1.0",
}

def to_yt_embed(url):
    if not url:
        return None
    try:
        if "youtu.be/" in url:
            vid = url.split("youtu.be/")[1].split("?")[0]
            return f"https://www.youtube.com/embed/{vid}"
        elif "v=" in url:
            vid = url.split("v=")[1].split("&")[0]
            return f"https://www.youtube.com/embed/{vid}"
        elif "embed/" in url:
            vid = url.split("embed/")[1].split("?")[0]
            return f"https://www.youtube.com/embed/{vid}"
    except Exception:
        pass
    return url


def parse_wp_post_episodes(html_str):
    if not html_str:
        return []

    soup = BeautifulSoup(html_str, "lxml")
    episodes = []
    seen = set()

    blocks = soup.find_all(["p", "li", "div", "pre"])

    for block in blocks:
        text = block.get_text().strip()
        if not text:
            continue

        m_single = re.search(r'EPIS[OÓ]DIO\s+(\d+)', text, re.I)
        m_range = re.search(r'EPIS[OÓ]DIOS?\s+(\d+)\s*(?:AO|A|-|E|&)\s*(\d+)', text, re.I)

        links = {
            "mega_link": None,
            "pixeldrain_link": None,
            "mediafire_link": None,
            "drive_link": None,
            "youtube_link": None,
            "embed_url_1": None,
        }

        for a in block.find_all("a", href=True):
            href = a["href"]
            if "mega.nz" in href and not links["mega_link"]:
                links["mega_link"] = href
            elif "pixeldrain" in href and not links["pixeldrain_link"]:
                links["pixeldrain_link"] = href
            elif "mediafire" in href and not links["mediafire_link"]:
                links["mediafire_link"] = href
            elif "drive.google" in href and not links["drive_link"]:
                links["drive_link"] = href
            elif ("youtu" in href or "youtube.com" in href) and not links["youtube_link"]:
                links["youtube_link"] = href
                links["embed_url_1"] = to_yt_embed(href)

        has_links = any(v for v in links.values() if v)
        if not has_links:
            continue

        if m_range:
            start_ep, end_ep = int(m_range.group(1)), int(m_range.group(2))
            if start_ep <= end_ep and (end_ep - start_ep) <= 100:
                for ep_num in range(start_ep, end_ep + 1):
                    if ep_num not in seen:
                        seen.add(ep_num)
                        episodes.append({"ep": ep_num, "title": f"Episódio {ep_num:02d}", **links})
        elif m_single:
            ep_num = int(m_single.group(1))
            if ep_num not in seen:
                seen.add(ep_num)
                episodes.append({"ep": ep_num, "title": f"Episódio {ep_num:02d}", **links})

    return episodes


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Find series where episodes have no links or series with 0 eps
    series_to_fix = cur.execute("""
        SELECT DISTINCT s.id, s.title, s.slug 
        FROM series s
        JOIN episodes e ON e.series_id = s.id
        WHERE e.youtube_link IS NULL 
          AND e.embed_url_1 IS NULL 
          AND e.drive_link IS NULL 
          AND e.mega_link IS NULL 
          AND e.pixeldrain_link IS NULL
    """).fetchall()

    print(f"Found {len(series_to_fix)} series with missing/empty episode links.")

    session = requests.Session()
    session.headers.update(HEADERS)

    fixed_count = 0
    total_episodes_updated = 0

    for idx, (sid, title, slug) in enumerate(series_to_fix, 1):
        progress = f"[{idx}/{len(series_to_fix)}]"
        print(f"{progress} 🔍 Fixing YouTube/Links for: {title} ({slug})")

        try:
            r = session.get(f"{WEIFANSUB_API}/posts", params={"slug": slug, "_fields": "content"}, timeout=12)
            if r.ok and len(r.json()) > 0:
                html_content = r.json()[0].get("content", {}).get("rendered", "")
                parsed = parse_wp_post_episodes(html_content)

                if parsed:
                    # Delete old empty episode records for this series
                    cur.execute("DELETE FROM episodes WHERE series_id = ?", (sid,))
                    
                    # Insert clean parsed episodes
                    for ep in parsed:
                        cur.execute("""
                            INSERT INTO episodes (
                                series_id, episode_number, title,
                                youtube_link, embed_url_1, mega_link, pixeldrain_link, mediafire_link, drive_link,
                                created_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                        """, (
                            sid, ep["ep"], ep["title"],
                            ep["youtube_link"], ep["embed_url_1"],
                            ep["mega_link"], ep["pixeldrain_link"], ep["mediafire_link"], ep["drive_link"]
                        ))
                        total_episodes_updated += 1

                    conn.commit()
                    fixed_count += 1
                    print(f"    ✅ Fixed {len(parsed)} episodes for: {title}")
                else:
                    print(f"    ⚠️ No parsed episodes for: {title}")
        except Exception as e:
            print(f"    ❌ Error fixing {title}: {e}")

        time.sleep(0.2)

    conn.close()

    print("\n" + "="*60)
    print("🎉 YOUTUBE & EMPTY EPISODES FIX COMPLETE!")
    print("="*60)
    print(f"  🎬 Series Fixed:            {fixed_count}")
    print(f"  📺 Total Episodes Updated:  {total_episodes_updated}")
    print("="*60)


if __name__ == "__main__":
    main()
