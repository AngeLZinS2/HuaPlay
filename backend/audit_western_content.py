import sqlite3
import re
import requests

conn = sqlite3.connect('/app/weifansub.db')
c = conn.cursor()

# 1. Update Viva La Vida (#757) immediately
# Real Chinese movie: 我们一起摇太阳 (2024), directed by Han Yan, starring Peng Yuchang & Li Gengxi
viva_cover = "https://image.tmdb.org/t/p/w500/5JlR6yERxMWYHuhlwL1vRfoaVgh.jpg"
viva_banner = "https://image.tmdb.org/t/p/original/nffhhbdrEvIXPJCt30JqA0jWbuv.jpg"
viva_synopsis = "Uma jovem que precisa de um transplante de rim conhece um rapaz que enfrenta uma grave doença cerebral. Juntos, eles encontram forças mútuas para lutar pela vida e pelo amor."

c.execute("""
    UPDATE series 
    SET cover_image = ?, banner_image = ?, description = ?, release_year = 2024
    WHERE id = 757
""", (viva_cover, viva_banner, viva_synopsis))
conn.commit()
print("Fixed #757 'Viva La Vida' with correct 2024 Chinese movie poster and synopsis.")

# 2. Audit all 1164 series for Western keywords in description
all_series = c.execute("SELECT id, title, country, release_year, cover_image, banner_image, description FROM series").fetchall()
print(f"Total series to audit: {len(all_series)}")

western_synopsis_matches = []
western_kw = [
    r"\bNova York\b", r"\bNew York\b", r"\bLos Angeles\b", r"\bFBI\b", r"\bCIA\b",
    r"\bEstados Unidos\b", r"\bEUA\b", r"\bInglaterra\b", r"\bLondres\b", r"\bLondon\b",
    r"\bFrança\b", r"\bParis\b", r"\bAlemanha\b", r"\bBerlim\b", r"\bItália\b",
    r"\bRoma\b", r"\bEspanha\b", r"\bMadrid\b", r"\bHollywood\b", r"\bPixar\b",
    r"\bDisney\b", r"\bMarvel\b", r"\bDC Comics\b", r"\bNetflix americana\b"
]

for s_id, title, country, year, cover, banner, desc in all_series:
    if not desc:
        continue
    for kw in western_kw:
        if re.search(kw, desc, re.I):
            western_synopsis_matches.append((s_id, title, country, kw, desc[:100]))
            break

print(f"\n[!] Séries com menções a locais/termos ocidentais na sinopse: {len(western_synopsis_matches)}")
for m in western_synopsis_matches:
    print(f"  #{m[0]} '{m[1]}' ({m[2]}) -> Keyword: '{m[3]}' | Sinopse: {m[4]}...")

conn.close()
