#!/usr/bin/env python3
"""
WeiFansub → HuaPlay Full Scraper
========================================
Scrapes all content from weifansub.com.br via WordPress REST API,
enriches metadata via MyDramaList, and imports into HuaPlay.

Usage:
    python scraper_weifansub.py [--limit N] [--skip-mdl] [--dry-run] [--token TOKEN]

Requirements:
    pip install requests beautifulsoup4 lxml
"""

import re
import sys
import time
import json
import argparse
import requests
from html import unescape
from bs4 import BeautifulSoup
from datetime import datetime

# Force UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# ─── CONFIG ───────────────────────────────────────────────────────────────────
WEIFANSUB_API = "https://weifansub.com.br/wp-json/wp/v2"
HUAPLAY_API   = "http://localhost:8000"
MDL_BASE      = "https://mydramalist.com"

HEADERS_WF = {
    "User-Agent": "Mozilla/5.0 (HuaPlay Scraper/1.0)",
    "Accept": "application/json",
}
HEADERS_MDL = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}

# ─── CATEGORY MAPPING ─────────────────────────────────────────────────────────
# WP category ID → (type, country)
CATEGORY_MAP = {
    70300568:  ("Series", "China"),
    10718773:  ("Series", "Korea"),
    194773367: ("Series", "Thailand"),
    8567527:   ("Series", "Japan"),
    3679105:   ("Series", "Taiwan"),
    715548928: ("Series", "Singapore"),
    711758371: ("Series", "Vietnam"),
    716750544: ("Series", "Philippines"),
    107988773: ("Series", "India"),
    716750563: ("Series", "Malaysia"),
    716750578: ("Movie", "Turkey"),  # Filme Turco
    4883619:   ("Movie", "China"),
    6714441:   ("Movie", "Korea"),
    36540849:  ("Movie", "Thailand"),
    6111345:   ("Movie", "Japan"),
    711758367: ("Movie", "Taiwan"),
    716749981: ("Movie", "Philippines"),
    716749967: ("Movie", "Vietnam"),
    716749968: ("Movie", "Indonesia"),
    716749980: ("Movie", "Malaysia"),
    715548928: ("Movie", "Singapore"),
    716750536: ("Movie", "Hong Kong"),
    716750562: ("Movie", "India"),
    716750074: ("Movie", "Kazakhstan"),
    716750000: ("Movie", "Singapore"),
    716750579: ("Movie", "Pakistan"),
    716750577: ("Donghua", "China"),
    716750576: ("Series", "China"),    # Manhua → treat as Series
    716750558: ("Anime", "China"),     # Anime Chinês
    565334216: ("Series", "China"),    # Novel Chinesa → Series
    716750560: ("Series", "Thailand"), # Novel Tailandesa → Series
}

# Status categories
STATUS_COMPLETED = {2420055}   # "Concluído"
STATUS_ONGOING   = {56494}     # "Em andamento"
SKIP_CATEGORIES  = {5078, 716750567, 716750566, 716750575, 716750574, 10340}  # Blog, misc, etc

# ─── GENRE MAPPING ────────────────────────────────────────────────────────────
COUNTRY_GENRE_DEFAULTS = {
    "China":     "Romance, Drama",
    "Korea":     "Romance, Drama",
    "Thailand":  "Romance, Drama",
    "Japan":     "Drama",
    "Taiwan":    "Romance",
    "Vietnam":   "Romance, Drama",
    "Philippines": "Romance",
    "Indonesia": "Drama",
    "India":     "Drama",
    "Malaysia":  "Romance",
    "Hong Kong": "Drama",
    "Turkey":    "Romance, Drama",
}

# ─── HELPERS ──────────────────────────────────────────────────────────────────

def log(msg, level="INFO"):
    prefix = {"INFO": "ℹ️", "OK": "✅", "WARN": "⚠️", "ERR": "❌", "SKIP": "⏭️"}.get(level, "·")
    print(f"[{prefix}] {msg}", flush=True)


def slugify(text):
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")[:120]


def clean_html(html_str):
    """Strip HTML tags and decode entities."""
    if not html_str:
        return ""
    soup = BeautifulSoup(html_str, "lxml")
    return unescape(soup.get_text(separator=" ", strip=True))


def extract_first_image(html_str):
    """Extract first meaningful image URL from HTML content."""
    if not html_str:
        return None
    soup = BeautifulSoup(html_str, "lxml")
    for img in soup.find_all("img"):
        src = img.get("src", "")
        # Skip tiny spacer/emoji images
        if not src or "emoji" in src or "espaco" in src.lower() or "LINHA" in src:
            continue
        if src.startswith("http") and ("imgur" in src or "wp-content" in src or "i.ibb" in src):
            return src
    return None


def translate_to_pt(text):
    if not text or len(text.strip()) == 0:
        return text
    
    # Check if text is likely already in Portuguese
    pt_words = {"um", "uma", "para", "com", "seu", "sua", "não", "quando", "sobre", "depois", "onde", "quando", "este", "esta", "que"}
    text_words = set(re.findall(r'\b\w+\b', text.lower()))
    if len(pt_words.intersection(text_words)) >= 2:
        return text

    try:
        url = "https://translate.googleapis.com/translate_a/single"
        params = {
            "client": "gtx",
            "sl": "auto",
            "tl": "pt",
            "dt": "t",
            "q": text[:4000]
        }
        r = requests.get(url, params=params, headers=HEADERS_WF, timeout=12)
        if r.ok:
            data = r.json()
            translated = "".join([item[0] for item in data[0] if item and item[0]])
            return translated
    except Exception:
        pass
    return text


def parse_episodes(html_str, series_title):
    """
    Parse episode links from WeiFansub HTML content.
    Handles single episodes (EPISÓDIO 01), ranges (EPISÓDIOS 01 AO 05),
    and movie single files (no EPISÓDIO header).
    """
    if not html_str:
        return []

    soup = BeautifulSoup(html_str, "lxml")
    episodes = []
    seen_ep_nums = set()

    blocks = soup.find_all(["p", "li", "div", "pre"])

    for block in blocks:
        text = block.get_text().strip()
        if not text:
            continue

        links = {
            "mega_link": None,
            "pixeldrain_link": None,
            "mediafire_link": None,
            "drive_link": None,
            "youtube_link": None,
            "embed_url_1": None,
            "embed_url_2": None,
            "download_link": None,
            "external_link": None,
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

        has_links = any(v for v in links.values() if v)
        if not has_links:
            continue

        m_range = re.search(r'EPIS[OÓ]DIOS?\s+(\d+)\s*(?:AO|A|-|E|&)\s*(\d+)', text, re.IGNORECASE)
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

    if not episodes:
        movie_links = {
            "mega_link": None,
            "pixeldrain_link": None,
            "mediafire_link": None,
            "drive_link": None,
            "youtube_link": None,
            "embed_url_1": None,
            "embed_url_2": None,
            "download_link": None,
            "external_link": None,
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

        if any(v for v in movie_links.values() if v):
            episodes.append({
                "episode_number": 1,
                "title": "Filme / Completo",
                **movie_links
            })

    episodes.sort(key=lambda e: e["episode_number"])
    return episodes


def parse_series_download_links(html_str):
    """
    For posts that are a single file (movie/special), extract series-level download links.
    """
    soup = BeautifulSoup(html_str, "lxml")
    links = {"mega_link": None, "pixeldrain_link": None, "mediafire_link": None, "drive_link": None}

    # Look for links NOT inside an EPISÓDIO block
    for a in soup.find_all("a", href=True):
        href = a["href"]
        # Check if parent has EPISÓDIO text
        parent_text = a.find_parent().get_text() if a.find_parent() else ""
        if re.search(r"EPIS[OÓ]DIO", parent_text, re.I):
            continue  # Skip episode-specific links

        if "mega.nz" in href and not links["mega_link"]:
            links["mega_link"] = href
        elif "pixeldrain" in href and not links["pixeldrain_link"]:
            links["pixeldrain_link"] = href
        elif "mediafire" in href and not links["mediafire_link"]:
            links["mediafire_link"] = href
        elif "drive.google" in href and not links["drive_link"]:
            links["drive_link"] = href

    return links


# ─── WEIFANSUB API ────────────────────────────────────────────────────────────

def fetch_wp_total_pages(session, categories=None):
    """Get total number of pages."""
    params = {"per_page": 100, "page": 1, "_fields": "id"}
    if categories:
        params["categories"] = ",".join(str(c) for c in categories)
    r = session.get(f"{WEIFANSUB_API}/posts", params=params, headers=HEADERS_WF, timeout=30)
    r.raise_for_status()
    total = int(r.headers.get("X-WP-Total", 0))
    pages = int(r.headers.get("X-WP-TotalPages", 1))
    return total, pages


def fetch_wp_posts_page(session, page, categories=None):
    """Fetch one page of WP posts."""
    params = {
        "per_page": 100,
        "page": page,
        "_fields": "id,title,slug,content,date,categories,featured_media",
    }
    if categories:
        params["categories"] = ",".join(str(c) for c in categories)
    r = session.get(f"{WEIFANSUB_API}/posts", params=params, headers=HEADERS_WF, timeout=60)
    r.raise_for_status()
    return r.json()


def fetch_featured_image(session, media_id):
    """Get featured image URL from WP media ID."""
    if not media_id:
        return None
    try:
        r = session.get(
            f"{WEIFANSUB_API}/media/{media_id}",
            params={"_fields": "source_url,media_details"},
            headers=HEADERS_WF,
            timeout=15
        )
        if r.ok:
            data = r.json()
            # Prefer medium or large size
            sizes = data.get("media_details", {}).get("sizes", {})
            for size in ["large", "medium_large", "medium", "full"]:
                if size in sizes:
                    return sizes[size].get("source_url")
            return data.get("source_url")
    except Exception:
        pass
    return None


# ─── MYDRAMALIST ENRICHMENT ───────────────────────────────────────────────────

def search_mdl(session, title):
    """
    Search MyDramaList for a title. Returns dict with:
    cover_image, banner_image, description, genre, cast, release_year, rating
    """
    try:
        search_url = f"{MDL_BASE}/search"
        r = session.get(
            search_url,
            params={"q": title, "adv": "titles"},
            headers=HEADERS_MDL,
            timeout=20
        )
        if not r.ok:
            return None

        soup = BeautifulSoup(r.text, "lxml")

        # Find first result
        result = soup.select_one(".box.movie-list-shrink .item-title a, .box.list-sm .title a")
        if not result:
            # Try alternate selector
            result = soup.select_one("h6.title a")

        if not result:
            return None

        detail_url = result.get("href", "")
        if not detail_url.startswith("http"):
            detail_url = MDL_BASE + detail_url

        # Fetch detail page
        time.sleep(0.5)  # Be polite
        r2 = session.get(detail_url, headers=HEADERS_MDL, timeout=20)
        if not r2.ok:
            return None

        return parse_mdl_detail(r2.text, detail_url)

    except Exception as e:
        log(f"MDL search error for '{title}': {e}", "WARN")
        return None


def parse_mdl_detail(html, url):
    """Parse a MyDramaList detail page."""
    soup = BeautifulSoup(html, "lxml")
    result = {}

    # Cover image (poster)
    cover_img = soup.select_one(".film-cover img, img.img-responsive[itemprop='image']")
    if cover_img:
        result["cover_image"] = cover_img.get("data-src") or cover_img.get("src")

    # Banner / backdrop
    banner_div = soup.select_one(".film-cover, .cover-img")
    if banner_div:
        style = banner_div.get("style", "")
        m = re.search(r"url\(['\"]?([^'\")\s]+)['\"]?\)", style)
        if m:
            result["banner_image"] = m.group(1)

    # Description
    desc_el = soup.select_one("[itemprop='description'], .show-synopsis p")
    if desc_el:
        result["description"] = desc_el.get_text(strip=True)[:2000]

    # Genres
    genres = []
    for el in soup.select("li.list-item[class*='genre'] a, a[href*='/genre/']"):
        g = el.get_text(strip=True)
        if g and len(g) < 30:
            genres.append(g)
    if genres:
        result["genre"] = ", ".join(genres[:5])

    # Cast
    cast_names = []
    for el in soup.select("[itemprop='actor'] [itemprop='name'], .cast-credits .list-item .name"):
        name = el.get_text(strip=True)
        if name:
            cast_names.append(name)
    if cast_names:
        result["cast"] = ", ".join(cast_names[:8])

    # Year
    year_el = soup.select_one("[itemprop='dateCreated'], .air-info span[class*='year']")
    if year_el:
        m = re.search(r"(\d{4})", year_el.get_text())
        if m:
            result["release_year"] = int(m.group(1))

    # Rating
    rating_el = soup.select_one("[itemprop='ratingValue'], .score")
    if rating_el:
        try:
            result["rating"] = float(rating_el.get_text(strip=True))
        except ValueError:
            pass

    # Country
    for li in soup.select("li.list-item"):
        label = li.select_one("b, .name")
        if label and "Country" in label.get_text():
            val = li.get_text(separator=" ", strip=True).replace(label.get_text(), "").strip()
            if val:
                result["country"] = val.split(",")[0].strip()
            break

    return result if result else None


# ─── HUAPLAY API ──────────────────────────────────────────────────────────────

def huaplay_get_token(session, email, password):
    """Authenticate with HuaPlay and get JWT token."""
    r = session.post(
        f"{HUAPLAY_API}/auth/token",
        data={"username": email, "password": password},
        timeout=15
    )
    r.raise_for_status()
    return r.json()["access_token"]


def huaplay_series_exists(session, slug, token):
    """Check if series with slug already exists."""
    headers = {"Authorization": f"Bearer {token}"}
    try:
        r = session.get(f"{HUAPLAY_API}/series/{slug}", headers=headers, timeout=10)
        return r.ok and r.status_code == 200
    except Exception:
        return False


def huaplay_create_series(session, data, token):
    """Create a series in HuaPlay. Returns (id, created)."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    r = session.post(f"{HUAPLAY_API}/series/", json=data, headers=headers, timeout=20)
    if r.status_code == 201:
        return r.json()["id"], True
    elif r.status_code in (409, 422):
        # Conflict or validation error — try to get existing
        return None, False
    else:
        r.raise_for_status()


def huaplay_create_episode(session, series_id, ep_data, token):
    """Create an episode."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    r = session.post(
        f"{HUAPLAY_API}/series/{series_id}/episodes",
        json=ep_data,
        headers=headers,
        timeout=15
    )
    return r.ok


# ─── MAIN PIPELINE ────────────────────────────────────────────────────────────

def determine_type_country_status(categories):
    """Determine series type, country, and status from WP category IDs."""
    content_type = None
    country = None
    status = "Em andamento"

    for cat_id in categories:
        if cat_id in SKIP_CATEGORIES:
            return None, None, None  # Skip this post

        if cat_id in STATUS_COMPLETED:
            status = "Completo"
        elif cat_id in STATUS_ONGOING:
            status = "Em andamento"

        if cat_id in CATEGORY_MAP and not content_type:
            content_type, country = CATEGORY_MAP[cat_id]

    if not content_type:
        return None, None, None  # Unknown type — skip

    return content_type, country, status


def process_post(session, post, args, token, stats):
    """Process a single WP post and import it into HuaPlay."""
    title = unescape(post.get("title", {}).get("rendered", "")).strip()
    slug = post.get("slug", "").strip() or slugify(title)
    categories = post.get("categories", [])
    content_html = post.get("content", {}).get("rendered", "")
    date_str = post.get("date", "")
    featured_media_id = post.get("featured_media")

    if not title:
        stats["skipped"] += 1
        return

    # Determine type / country / status
    content_type, country, status = determine_type_country_status(categories)
    if not content_type:
        stats["skipped"] += 1
        return

    # Check for duplicate
    if not args.dry_run and huaplay_series_exists(session, slug, token):
        log(f"SKIP (exists): {title}", "SKIP")
        stats["skipped"] += 1
        return

    # Parse release year
    release_year = datetime.now().year
    if date_str:
        try:
            release_year = int(date_str[:4])
        except ValueError:
            pass

    # Cover image: first try featured media, then extract from content
    cover_image = None
    if featured_media_id:
        cover_image = fetch_featured_image(session, featured_media_id)
    if not cover_image:
        cover_image = extract_first_image(content_html)

    # Default genre
    genre = COUNTRY_GENRE_DEFAULTS.get(country, "Drama")
    description = None
    banner_image = None
    cast = None

    # ── MyDramaList Enrichment ──────────────────────────────────────────────
    if not args.skip_mdl:
        time.sleep(0.8)  # Rate limit
        mdl_data = search_mdl(session, title)
        if mdl_data:
            if mdl_data.get("cover_image"):
                cover_image = mdl_data["cover_image"]
            if mdl_data.get("banner_image"):
                banner_image = mdl_data["banner_image"]
            if mdl_data.get("description"):
                description = translate_to_pt(mdl_data["description"])
            if mdl_data.get("genre"):
                genre = mdl_data["genre"]
            if mdl_data.get("cast"):
                cast = mdl_data["cast"]
            if mdl_data.get("release_year"):
                release_year = mdl_data["release_year"]
            if mdl_data.get("country"):
                country = mdl_data["country"]
            log(f"MDL enriched: {title}", "OK")
        else:
            log(f"MDL not found: {title}", "WARN")

    # ── Parse Episodes ──────────────────────────────────────────────────────
    episodes = parse_episodes(content_html, title)

    # ── Parse series-level download links (for movies / single files) ───────
    series_links = parse_series_download_links(content_html)

    # ── Build series payload ────────────────────────────────────────────────
    series_payload = {
        "title": title,
        "slug": slug,
        "description": description or f"{title} legendado em português (PT/BR).",
        "cover_image": cover_image or "",
        "banner_image": banner_image or "",
        "genre": genre,
        "type": content_type,
        "country": country,
        "status": status,
        "release_year": release_year,
        "cast": cast,
        "is_featured": False,
        "mega_link": series_links.get("mega_link"),
        "pixeldrain_link": series_links.get("pixeldrain_link"),
        "mediafire_link": series_links.get("mediafire_link"),
        "drive_link": series_links.get("drive_link"),
    }

    if args.dry_run:
        log(f"[DRY-RUN] Would create: {title} ({content_type} | {country} | {len(episodes)} eps)", "INFO")
        stats["created"] += 1
        stats["episodes"] += len(episodes)
        return

    # ── Create series ───────────────────────────────────────────────────────
    try:
        series_id, created = huaplay_create_series(session, series_payload, token)
        if not series_id:
            log(f"Failed to create: {title}", "ERR")
            stats["errors"] += 1
            return
    except Exception as e:
        log(f"Error creating {title}: {e}", "ERR")
        stats["errors"] += 1
        return

    # ── Create episodes ─────────────────────────────────────────────────────
    ep_ok = 0
    for ep in episodes:
        try:
            if huaplay_create_episode(session, series_id, ep, token):
                ep_ok += 1
        except Exception as e:
            log(f"  Episode {ep['episode_number']} error: {e}", "WARN")

    log(f"✅ Criado: {title} ({content_type} | {country} | {ep_ok}/{len(episodes)} eps)", "OK")
    stats["created"] += 1
    stats["episodes"] += ep_ok


def run_scraper(args):
    session = requests.Session()
    session.headers.update(HEADERS_WF)

    # ── Authenticate ────────────────────────────────────────────────────────
    token = args.token
    if not token and not args.dry_run:
        email = input("HuaPlay admin email: ").strip()
        password = input("HuaPlay admin password: ").strip()
        try:
            token = huaplay_get_token(session, email, password)
            log(f"Authenticated as {email}", "OK")
        except Exception as e:
            log(f"Auth failed: {e}", "ERR")
            sys.exit(1)

    # ── Fetch total count ───────────────────────────────────────────────────
    log("Fetching total post count from WeiFansub...")
    total, total_pages = fetch_wp_total_pages(session)
    log(f"Total posts: {total} ({total_pages} pages)")

    stats = {"created": 0, "skipped": 0, "errors": 0, "episodes": 0}

    limit = args.limit
    processed = 0

    # ── Iterate pages ───────────────────────────────────────────────────────
    for page in range(1, total_pages + 1):
        if limit and processed >= limit:
            break

        log(f"\n── Page {page}/{total_pages} ──────────────────────────────────")

        try:
            posts = fetch_wp_posts_page(session, page)
        except Exception as e:
            log(f"Failed to fetch page {page}: {e}", "ERR")
            time.sleep(5)
            continue

        for post in posts:
            if limit and processed >= limit:
                break

            processed += 1
            progress = f"[{processed}/{limit or total}]"
            title = unescape(post.get("title", {}).get("rendered", "?"))
            log(f"{progress} Processing: {title}")

            try:
                process_post(session, post, args, token, stats)
            except Exception as e:
                log(f"Unexpected error for '{title}': {e}", "ERR")
                stats["errors"] += 1

            # Rate limiting
            time.sleep(0.3)

        time.sleep(1)  # Between pages

    # ── Final Report ────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("📊 RESULTADO FINAL")
    print("="*60)
    print(f"  ✅ Criados:    {stats['created']}")
    print(f"  📺 Episódios:  {stats['episodes']}")
    print(f"  ⏭️  Ignorados:  {stats['skipped']}")
    print(f"  ❌ Erros:      {stats['errors']}")
    print("="*60)

    # Save report
    report_path = "scraper_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    log(f"Report saved to {report_path}", "OK")


# ─── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="WeiFansub → HuaPlay Scraper")
    parser.add_argument("--limit",    type=int,  default=None,  help="Max posts to process (default: all)")
    parser.add_argument("--skip-mdl", action="store_true",      help="Skip MyDramaList enrichment")
    parser.add_argument("--dry-run",  action="store_true",      help="Parse only, don't write to DB")
    parser.add_argument("--token",    type=str,  default=None,  help="HuaPlay JWT token (skip login prompt)")
    parser.add_argument("--api",      type=str,  default=None,  help="Override HuaPlay API base URL")
    args = parser.parse_args()

    if args.api:
        HUAPLAY_API = args.api

    print("="*60)
    print(">>> WeiFansub -> HuaPlay Full Scraper")
    print("="*60)
    print(f"  Mode:    {'DRY-RUN' if args.dry_run else 'LIVE'}")
    print(f"  MDL:     {'SKIP' if args.skip_mdl else 'ENABLED'}")
    print(f"  Limit:   {args.limit or 'ALL'}")
    print("="*60 + "\n")

    run_scraper(args)
