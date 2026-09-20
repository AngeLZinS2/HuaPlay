import sqlite3

conn = sqlite3.connect('weifansub.db')
cur = conn.cursor()

# Find any imgur or tvtime links
rows = cur.execute("SELECT id, title, cover_image, banner_image FROM series WHERE cover_image LIKE '%imgur%' OR cover_image LIKE '%tvtime%' OR banner_image LIKE '%imgur%' OR banner_image LIKE '%tvtime%'").fetchall()
print(f"Found {len(rows)} series with external imgur/tvtime links:")
for r in rows:
    print(r)

# Update imgur/tvtime links to high quality TMDB fallback
fallback_cover = "https://image.tmdb.org/t/p/w342/6MAPSqklbEo4DpcnpriDFyEoisu.jpg"
fallback_banner = "https://image.tmdb.org/t/p/w1280/xEUcPKH4Nfm6XSuyzgkox6mh775.jpg"

cur.execute("UPDATE series SET cover_image = ? WHERE cover_image LIKE '%imgur%' OR cover_image LIKE '%tvtime%'", (fallback_cover,))
cur.execute("UPDATE series SET banner_image = ? WHERE banner_image LIKE '%imgur%' OR banner_image LIKE '%tvtime%'", (fallback_banner,))

conn.commit()
conn.close()
print("Cleaned up external image URLs successfully!")
