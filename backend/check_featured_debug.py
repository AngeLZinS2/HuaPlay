import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "weifansub.db")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("--- Checking ALL Featured Series ---")
cursor.execute("SELECT id, title, is_featured FROM series WHERE is_featured = 1")
rows = cursor.fetchall()

if not rows:
    print("No series are featured.")
else:
    for row in rows:
        print(f"ID: {row[0]}, Title: {row[1]}, Featured: {row[2]}")


print("\n--- Checking ID 1 ---")
cursor.execute("SELECT id, title, is_featured, trailer_url FROM series WHERE id = 1")
row = cursor.fetchone()
if row:
    print(f"ID: {row[0]}, Title: {row[1]}, Featured: {row[2]}")
else:
    print("ID 1 not found.")

cursor.execute("SELECT id, title, is_featured FROM series LIMIT 5")
print("\n--- First 5 Series ---")
for r in cursor.fetchall():
    print(r)
