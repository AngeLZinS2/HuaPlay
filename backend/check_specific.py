import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "weifansub.db")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

titles = ["Chọc Tức Vợ Yêu", "Ambition"]
for t in titles:
    print(f"--- Searching for '{t}' ---")
    cursor.execute("SELECT id, title, is_featured, trailer_url FROM series WHERE title LIKE ?", (f"%{t}%",))
    rows = cursor.fetchall()
    for row in rows:
        print(f"ID: {row[0]}")
        print(f"Title: {row[1]}")
        print(f"Featured: {row[2]}")
        print(f"Trailer: {row[3]}")

conn.close()
