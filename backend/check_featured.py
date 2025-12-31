import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "weifansub.db")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("Searching for 'Love's Ambition'...")
# Try like match
cursor.execute("SELECT id, title, is_featured, trailer_url FROM series WHERE title LIKE '%Love%' AND title LIKE '%Ambition%'")
rows = cursor.fetchall()

if not rows:
    # Try just Ambition
    cursor.execute("SELECT id, title, is_featured, trailer_url FROM series WHERE title LIKE '%Ambition%'")
    rows = cursor.fetchall()

if not rows:
    print("No matches for 'Love's Ambition'.")
else:
    for row in rows:
        print(f"ID: {row[0]}")
        print(f"Title: {row[1]}")
        print(f"Featured: {row[2]}")
        print(f"Trailer: {row[3]}")
        print("-" * 20)

print("\nCurrently Featured:")
cursor.execute("SELECT id, title FROM series WHERE is_featured = 1")
try:
    feat = cursor.fetchone()
    if feat:
        print(f"ID: {feat[0]}, Title: {feat[1]}")
    else:
        print("None")
except:
    print("Error getting featured.")

conn.close()
