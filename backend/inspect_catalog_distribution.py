import sqlite3
from collections import Counter

conn = sqlite3.connect('/app/weifansub.db')
c = conn.cursor()

# Countries
countries = c.execute("SELECT country, count(*) FROM series GROUP BY country ORDER BY count(*) DESC").fetchall()
print("=== PAÍSES ===")
for r in countries:
    print(r)

# Types
types = c.execute("SELECT type, count(*) FROM series GROUP BY type ORDER BY count(*) DESC").fetchall()
print("\n=== TIPOS ===")
for r in types:
    print(r)

# Genres
genres_raw = c.execute("SELECT genre FROM series WHERE genre IS NOT NULL AND genre != ''").fetchall()
genre_counter = Counter()
for (g,) in genres_raw:
    for item in str(g).replace(";", ",").replace("|", ",").split(","):
        cleaned = item.strip()
        if cleaned:
            genre_counter[cleaned] += 1

print("\n=== TOP 25 GÊNEROS ===")
for g, count in genre_counter.most_common(25):
    print(f"{g}: {count}")

conn.close()
