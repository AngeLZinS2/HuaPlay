import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "weifansub.db")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("SELECT COUNT(*) FROM series WHERE banner_image LIKE '%tmdb.org%'")
count = cursor.fetchone()[0]
print(f"Series with TMDB Banner: {count}")

cursor.execute("SELECT title, banner_image, description FROM series WHERE banner_image LIKE '%tmdb.org%' LIMIT 3")
rows = cursor.fetchall()
for row in rows:
    print(f"T: {row[0]}\nB: {row[1]}\nD: {row[2][:30]}...\n")

conn.close()
