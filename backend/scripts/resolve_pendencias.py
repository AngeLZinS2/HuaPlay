#!/usr/bin/env python3
"""
HuaPlay Catalog Health Resolver & Western Content Safeguard
===========================================================
Ensures the HuaPlay catalog remains 100% compliant:
1. Strict restriction to allowed Asian content (CN, KR, TH, JP, TW, PH, VN, TR).
2. Prevents Western content homonyms from contaminating the catalog.
3. Automatically enriches series missing covers, banners, or synopses.
4. Keeps the Central de Pendências at 0 alerts.
"""

import os
import re
import sys
import time
import sqlite3
import argparse
import difflib
import requests

# Ensure UTF-8 output
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

TMDB_API_KEY = os.getenv("TMDB_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

ALLOWED_ASIAN_ORIGINS = {
    "CN", "KR", "JP", "TH", "TW", "HK", "PH", "VN", "TR", "MO"
}

DISALLOWED_WESTERN_ORIGINS = {
    "US", "GB", "FR", "DE", "IT", "ES", "CA", "AU", "BR", "MX", "AR", "RU", "NL", "SE", "NO", "DK", "PL"
}

COUNTRY_MAP = {
    "China": "CN",
    "South Korea": "KR",
    "Coreia do Sul": "KR",
    "Japan": "JP",
    "Japão": "JP",
    "Thailand": "TH",
    "Tailândia": "TH",
    "Taiwan": "TW",
    "Hong Kong": "HK",
    "Philippines": "PH",
    "Filipinas": "PH",
    "Vietnã": "VN",
    "Vietnam": "VN",
    "Turquia": "TR",
    "Turkey": "TR",
}

LANG_MAP = {
    "zh": "CN", "ko": "KR", "ja": "JP", "th": "TH", "cn": "CN",
    "vi": "VN", "tl": "PH", "tr": "TR"
}


def clean_title_for_search(title: str) -> str:
    """Normalize title for robust TMDB lookup."""
    if not title:
        return ""
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
    for prod in item.get("production_countries", []):
        iso = prod.get("iso_3166_1")
        if iso:
            found.add(iso)
    return found


def is_allowed_asian(item: dict) -> bool:
    orig = get_origins(item)
    if orig & DISALLOWED_WESTERN_ORIGINS and not (orig & ALLOWED_ASIAN_ORIGINS):
        return False
    return bool(orig & ALLOWED_ASIAN_ORIGINS)


def search_tmdb(title: str, country: str = "", year: int = 0) -> dict | None:
    cleaned = clean_title_for_search(title)
    if not cleaned:
        return None

    target_country_code = COUNTRY_MAP.get(country, "")
    candidates = []

    for endpoint in ("tv", "movie"):
        url = f"https://api.themoviedb.org/3/search/{endpoint}?api_key={TMDB_API_KEY}&query={requests.utils.quote(cleaned)}&include_adult=false"
        try:
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                results = resp.json().get("results", [])
                for r in results:
                    r["_endpoint"] = endpoint
                    candidates.append(r)
        except Exception:
            pass

    scored = []
    for item in candidates:
        if not is_allowed_asian(item):
            continue

        item_title = item.get("name") or item.get("title") or ""
        item_orig = item.get("original_name") or item.get("original_title") or ""
        origins = get_origins(item)

        sim_title = difflib.SequenceMatcher(None, cleaned.lower(), item_title.lower()).ratio()
        sim_orig = difflib.SequenceMatcher(None, cleaned.lower(), item_orig.lower()).ratio()
        score = max(sim_title, sim_orig) * 10.0

        if target_country_code:
            if target_country_code in origins:
                score += 10.0
            else:
                score -= 15.0

        if year and year > 1900:
            rel = item.get("first_air_date") or item.get("release_date") or ""
            if rel and len(rel) >= 4:
                try:
                    item_year = int(rel[:4])
                    diff = abs(item_year - year)
                    if diff <= 1:
                        score += 5.0
                    elif diff <= 3:
                        score += 2.0
                except ValueError:
                    pass

        if item.get("poster_path"):
            score += 2.0
        if item.get("backdrop_path"):
            score += 1.0

        scored.append((score, item))

    if not scored:
        return None

    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best_item = scored[0]
    if best_score < 4.0:
        return None

    return best_item


def generate_pt_synopsis(raw_overview: str, title: str, country: str, year: int) -> str:
    if not GEMINI_API_KEY:
        return (raw_overview or f"{title} é uma produção imperdível de {country}.")[:255]

    prompt = (
        f"Você é redator especialista em doramas e cinema asiático do HuaPlay.\n"
        f"Escreva uma sinopse em português brasileiro (PT-BR) concisa, envolvente e fluida para o drama/filme:\n"
        f"Título: {title}\n"
        f"País: {country}\n"
        f"Ano: {year}\n"
        f"Sinopse base / notas: {raw_overview or 'Sem sinopse prévia.'}\n\n"
        f"REGRAS:\n"
        f"- Máximo de 250 caracteres no total.\n"
        f"- NÃO inclua avisos como '(Fonte: ...)' ou '~~ Adaptado...'.\n"
        f"- NÃO dê spoilers.\n"
        f"- Retorne APENAS o texto da sinopse, sem aspas e sem enrolação."
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    for _ in range(2):
        try:
            resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=12)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                text = text.strip('"\'')
                if len(text) > 260:
                    text = text[:257].rsplit(" ", 1)[0] + "..."
                return text
        except Exception:
            time.sleep(1)

    return (raw_overview or f"{title} é uma emocionante produção de {country}.")[:255]


def main():
    parser = argparse.ArgumentParser(description="Resolve catalog health alerts safely")
    parser.add_argument("--db", default="/app/weifansub.db")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    conn = sqlite3.connect(args.db)
    cursor = conn.cursor()

    # 1. Check pending items
    pending_series = cursor.execute("""
        SELECT id, title, country, release_year, cover_image, banner_image, description
        FROM series
        WHERE (cover_image IS NULL OR trim(cover_image) = '')
           OR (banner_image IS NULL OR trim(banner_image) = '')
           OR (description IS NULL OR trim(description) = '')
    """).fetchall()

    print(f"Total de séries pendentes: {len(pending_series)}")

    for s_id, title, country, year, cover, banner, desc in pending_series:
        missing = []
        if not (cover or "").strip():
            missing.append("capa")
        if not (banner or "").strip():
            missing.append("banner")
        if not (desc or "").strip():
            missing.append("sinopse")

        print(f"Resolvendo #{s_id} '{title}' ({country}, {year}) | Falta: {', '.join(missing)}")
        item = search_tmdb(title, country=country or "", year=year or 0)
        if not item:
            print("  [!] TMDB seguro não encontrou correspondência estrita.")
            continue

        updates = []
        params = []

        if "capa" in missing and item.get("poster_path"):
            updates.append("cover_image = ?")
            params.append(f"https://image.tmdb.org/t/p/w500{item['poster_path']}")

        if "banner" in missing:
            b_path = item.get("backdrop_path") or item.get("poster_path")
            if b_path:
                updates.append("banner_image = ?")
                params.append(f"https://image.tmdb.org/t/p/original{b_path}")

        if "sinopse" in missing:
            raw_ov = item.get("overview") or ""
            new_syn = generate_pt_synopsis(raw_ov, title, country or "Ásia", year or 0)
            updates.append("description = ?")
            params.append(new_syn)

        if updates and args.apply:
            params.append(s_id)
            cursor.execute(f"UPDATE series SET {', '.join(updates)} WHERE id = ?", tuple(params))
            conn.commit()

    # 2. Banner fallback for any cover that lacks a banner
    if args.apply:
        cursor.execute("""
            UPDATE series
            SET banner_image = cover_image
            WHERE (banner_image IS NULL OR trim(banner_image) = '')
              AND (cover_image IS NOT NULL AND trim(cover_image) != '')
        """)
        conn.commit()

    conn.close()
    print("Health check & safeguard finished.")


if __name__ == "__main__":
    main()
