#!/usr/bin/env python3
"""
WeiFansub Content & Translation Fixer
=====================================
1. Re-parses WP post content for all series (fixing ranges like 'EPISÓDIOS 01 AO 05' and movies with 0 episodes).
2. Translates English descriptions to fluent PT-BR via Google Translate API.
"""

import re
import sys
import time
import sqlite3
import requests
from html import unescape
from bs4 import BeautifulSoup

# Force UTF-8 on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

DB_PATH = "weifansub.db"
WEIFANSUB_API = "https://weifansub.com.br/wp-json/wp/v2"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) HuaPlay Fixer/1.0",
}

# ─── TRANSLATION ──────────────────────────────────────────────────────────────

def translate_to_pt(text):
    if not text or len(text.strip()) == 0:
        return text
    
    # Check if text is likely already in Portuguese
    pt_words = {"um", "uma", "para", "com", "seu", "sua", "não", "quando", "sobre", "depois", "onde", "quando", "este", "esta", "que"}
    text_words = set(re.findall(r'\b\w+\b', text.lower()))
    if len(pt_words.intersection(text_words)) >= 2:
        return text  # Already in Portuguese!

    try:
        url = "https://translate.googleapis.com/translate_a/single"
        params = {
            "client": "gtx",
            "sl": "auto",
            "tl": "pt",
            "dt": "t",
            "q": text[:4000]
        }
        r = requests.get(url, params=params, headers=HEADERS, timeout=12)
        if r.ok:
            data = r.json()
            translated = "".join([item[0] for item in data[0] if item and item[0]])
            return translated
    except Exception as e:
        print(f"    ⚠️ Translation error: {e}")
        pass
    return text


# ─── ENHANCED EPISODE PARSER ──────────────────────────────────────────────────

def parse_episodes_from_html(html_str, series_title):
    if not html_str:
        return []

    soup = BeautifulSoup(html_str, "lxml")
    episodes = []
    seen_ep_nums = set()

    # Find all paragraph, li, div blocks
    blocks = soup.find_all(["p", "li", "div", "pre"])

    for block in blocks:
        text = block.get_text().strip()
        if not text:
            continue

        # Extract links in block
        links = {
            "mega_link": None,
            "pixeldrain_link": None,
            "mediafire_link": None,
            "drive_link": None,
            "youtube_link": None,
            "embed_url_1": None,
            "embed_url_2": None,
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
            elif "youtu" in href and not links["youtube_link"]:
                links["youtube_link"] = href
            elif ("ok.ru" in href or "embed" in href.lower()) and not links["embed_url_1"]:
                links["embed_url_1"] = href

        has_links = any(v for v in links.values())
        if not has_links:
            continue

        # Pattern 1: Range (e.g. EPISÓDIOS 01 AO 05, EPISÓDIOS 01-05, EPISÓDIOS 01 A 05, EP 01-05)
        m_range = re.search(r'EPIS[OÓ]DIOS?\s+(\d+)\s*(?:AO|A|-|E|&)\s*(\d+)', text, re.IGNORECASE)
        
        # Pattern 2: Single episode (e.g. EPISÓDIO 01, EPISÓDIO 1, EP 01)
        m_single = re.search(r'EPIS[OÓ]DIO\s+(\d+)', text, re.IGNORECASE)

        if m_range:
            start_ep, end_ep = int(m_range.group(1)), int(m_range.group(2))
            if start_ep <= end_ep and (end_ep - start_ep) <= 100:
                for ep_num in range(start_ep, end_ep + 1):
                    if ep_num not in seen_ep_nums:
                        seen_ep_nums.add(ep_num)
                        episodes.append({
                            "episode_number": ep_num,
                            "title": f"Episódio {ep_num:02d}",
                            **links
                        })
        elif m_single:
            ep_num = int(m_single.group(1))
            if ep_num not in seen_ep_nums:
                seen_ep_nums.add(ep_num)
                episodes.append({
                    "episode_number": ep_num,
                    "title": f"Episódio {ep_num:02d}",
                    **links
                })

    # Fallback for Movie / Single File (if 0 episodes found so far)
    if not episodes:
        movie_links = {
            "mega_link": None,
            "pixeldrain_link": None,
            "mediafire_link": None,
            "drive_link": None,
            "youtube_link": None,
        }
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "mega.nz" in href and not movie_links["mega_link"]:
                movie_links["mega_link"] = href
            elif "pixeldrain" in href and not movie_links["pixeldrain_link"]:
                movie_links["pixeldrain_link"] = href
            elif "mediafire" in href and not movie_links["mediafire_link"]:
                movie_links["mediafire_link"] = href
            elif "drive.google" in href and not movie_links["drive_link"]:
                movie_links["drive_link"] = href
            elif "youtu" in href and not movie_links["youtube_link"]:
                movie_links["youtube_link"] = href

        if any(v for v in movie_links.values()):
            episodes.append({
                "episode_number": 1,
                "title": "Filme / Completo",
                **movie_links
            })

    episodes.sort(key=lambda e: e["episode_number"])
    return episodes


# ─── MAIN FIXER PROCESS ───────────────────────────────────────────────────────

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Get all series
    series_list = cur.execute("SELECT id, title, slug, description, type, mega_link, drive_link FROM series").fetchall()
    print(f"Loaded {len(series_list)} series from database.")

    translated_count = 0
    episodes_added_count = 0
    series_fixed_count = 0

    session = requests.Session()
    session.headers.update(HEADERS)

    for idx, (sid, title, slug, desc, stype, mega, drive) in enumerate(series_list, 1):
        progress = f"[{idx}/{len(series_list)}]"
        needs_commit = False

        # 1. Check description translation
        if desc and len(desc.strip()) > 0:
            translated_desc = translate_to_pt(desc)
            if translated_desc != desc:
                cur.execute("UPDATE series SET description = ? WHERE id = ?", (translated_desc, sid))
                translated_count += 1
                needs_commit = True
                print(f"{progress} 🌐 Translated description for: {title}")

        # 2. Check episodes count
        ep_count = cur.execute("SELECT COUNT(*) FROM episodes WHERE series_id = ?", (sid,)).fetchone()[0]
        
        if ep_count == 0:
            # Re-fetch WP post to parse episodes or movie links
            print(f"{progress} 🔍 Refetching WP post for 0-episode series: {title} ({slug})")
            try:
                r = session.get(f"{WEIFANSUB_API}/posts", params={"slug": slug, "_fields": "content,categories"}, timeout=12)
                if r.ok and len(r.json()) > 0:
                    content_html = r.json()[0].get("content", {}).get("rendered", "")
                    parsed_eps = parse_episodes_from_html(content_html, title)
                    
                    if parsed_eps:
                        added_for_this = 0
                        for ep in parsed_eps:
                            cur.execute("""
                                INSERT INTO episodes (
                                    series_id, episode_number, title,
                                    mega_link, pixeldrain_link, mediafire_link, drive_link, youtube_link,
                                    embed_url_1, embed_url_2, created_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                            """, (
                                sid, ep["episode_number"], ep["title"],
                                ep.get("mega_link"), ep.get("pixeldrain_link"), ep.get("mediafire_link"),
                                ep.get("drive_link"), ep.get("youtube_link"),
                                ep.get("embed_url_1"), ep.get("embed_url_2")
                            ))
                            added_for_this += 1

                        # Also update series download links if it's a movie/single file
                        if ep_count == 0 and len(parsed_eps) == 1:
                            ep1 = parsed_eps[0]
                            cur.execute("""
                                UPDATE series SET
                                    mega_link = COALESCE(mega_link, ?),
                                    pixeldrain_link = COALESCE(pixeldrain_link, ?),
                                    mediafire_link = COALESCE(mediafire_link, ?),
                                    drive_link = COALESCE(drive_link, ?)
                                WHERE id = ?
                            """, (ep1.get("mega_link"), ep1.get("pixeldrain_link"), ep1.get("mediafire_link"), ep1.get("drive_link"), sid))

                        episodes_added_count += added_for_this
                        series_fixed_count += 1
                        needs_commit = True
                        print(f"    ✅ Added {added_for_this} episodes to {title}")
                    else:
                        print(f"    ⚠️ Still 0 episodes found for: {title}")
            except Exception as e:
                print(f"    ❌ Error refetching {title}: {e}")

        if needs_commit:
            conn.commit()

        # Slight rate limit
        time.sleep(0.15)

    conn.commit()
    conn.close()

    print("\n" + "="*60)
    print("🎉 FIX & TRANSLATION COMPLETED!")
    print("="*60)
    print(f"  🌐 Descriptions translated to PT-BR: {translated_count}")
    print(f"  📺 Total missing episodes added:   {episodes_added_count}")
    print(f"  🎬 Series/Movies fixed:             {series_fixed_count}")
    print("="*60)


if __name__ == "__main__":
    main()
