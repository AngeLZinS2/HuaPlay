import os
import sqlite3
import requests
import time
import re
import difflib

API_KEY = os.getenv("TMDB_API_KEY", "")

ALLOWED_ASIAN = {"CN", "KR", "JP", "TH", "TW", "HK", "PH", "VN", "TR", "MO"}
DISALLOWED_WESTERN = {"US", "GB", "FR", "DE", "IT", "ES", "CA", "AU", "BR", "MX", "AR", "RU", "NL", "SE", "NO", "DK", "PL"}

LANG_MAP = {
    "zh": "CN", "ko": "KR", "ja": "JP", "th": "TH", "cn": "CN",
    "vi": "VN", "tl": "PH", "tr": "TR"
}

def clean_title(title: str) -> str:
    if not title: return ""
    t = title.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    t = re.sub(r"\(.*?\)", "", t)
    t = re.sub(r"\[.*?\]", "", t)
    t = re.sub(r":?\s*Season\s*\d+", "", t, flags=re.I)
    t = re.sub(r":?\s*Temporada\s*\d+", "", t, flags=re.I)
    t = re.sub(r":?\s*Part\s*\d+", "", t, flags=re.I)
    t = re.sub(r"\s*\d{4}$", "", t)
    return re.sub(r"\s+", " ", t).strip()

def get_origins(item: dict) -> set:
    found = set(item.get("origin_country") or [])
    lang = (item.get("original_language") or "").lower()
    if lang in LANG_MAP:
        found.add(LANG_MAP[lang])
    elif lang in ("en", "es", "fr", "de", "it", "pt"):
        found.add("US")
    for p in item.get("production_countries", []):
        iso = p.get("iso_3166_1")
        if iso: found.add(iso)
    return found

conn = sqlite3.connect('/app/weifansub.db')
c = conn.cursor()

series = c.execute("SELECT id, title, country, release_year, cover_image, banner_image, description FROM series ORDER BY id").fetchall()
print(f"Total series to audit: {len(series)}")

suspects = []

for s_id, title, country, year, cover, banner, desc in series:
    cleaned = clean_title(title)
    if not cleaned or not cover or "image.tmdb.org" not in cover:
        continue
    
    # Extract filename from cover
    m = re.search(r"/[a-zA-Z0-9_-]+\.(?:jpg|png)$", cover)
    if not m:
        continue
    curr_poster = m.group(0)

    # Fast search: TV first, then Movie
    found_western_match = None
    found_asian_match = None
    
    for endpoint in ("tv", "movie"):
        url = f"https://api.themoviedb.org/3/search/{endpoint}?api_key={API_KEY}&query={requests.utils.quote(cleaned)}&include_adult=false"
        try:
            res = requests.get(url, timeout=5).json().get("results", [])
        except Exception:
            continue
            
        for item in res:
            orig = get_origins(item)
            p_path = item.get("poster_path")
            b_path = item.get("backdrop_path")
            
            # Check if current cover is this western poster/backdrop
            if (p_path == curr_poster or b_path == curr_poster):
                if orig & DISALLOWED_WESTERN and not (orig & ALLOWED_ASIAN):
                    found_western_match = (endpoint, item, orig)
            
            # Check if this item is a valid Asian candidate
            if (orig & ALLOWED_ASIAN) and (not found_asian_match or (item.get("poster_path") and not found_asian_match[1].get("poster_path"))):
                # Verify title similarity
                it_t = item.get("name") or item.get("title") or ""
                it_o = item.get("original_name") or item.get("original_title") or ""
                sim = max(difflib.SequenceMatcher(None, cleaned.lower(), it_t.lower()).ratio(),
                          difflib.SequenceMatcher(None, cleaned.lower(), it_o.lower()).ratio())
                if sim >= 0.5:
                    found_asian_match = (endpoint, item, orig)
                    
        if found_western_match:
            break

    if found_western_match:
        w_title = found_western_match[1].get("name") or found_western_match[1].get("title")
        w_origs = list(found_western_match[2])
        asian_info = None
        if found_asian_match:
            a_title = found_asian_match[1].get("name") or found_asian_match[1].get("title")
            a_origs = list(found_asian_match[2])
            asian_info = (found_asian_match[0], found_asian_match[1].get("id"), a_title, a_origs, found_asian_match[1].get("poster_path"), found_asian_match[1].get("backdrop_path"))
        
        suspects.append({
            "id": s_id,
            "title": title,
            "country": country,
            "year": year,
            "cover": cover,
            "western_match": f"[{found_western_match[0].upper()}] {w_title} ({w_origs})",
            "asian_candidate": asian_info
        })
        print(f"\n[!] CONTAMINAÇÃO DETECTADA #{s_id} '{title}' ({country}):")
        print(f"    Capa atual é do filme/série ocidental: {suspects[-1]['western_match']}")
        if asian_info:
            print(f"    -> Substituto Asiático Encontrado: {asian_info[2]} (Origem: {asian_info[3]}, Poster: {asian_info[4]})")
        else:
            print(f"    -> Nenhum substituto asiático automático encontrado pelo título simples.")

    time.sleep(0.05)

print("\n" + "="*60)
print(f"Total de contaminações ocidentais encontradas: {len(suspects)}")
print("="*60)

conn.close()
