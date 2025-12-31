import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "weifansub.db")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# 1. Reset ALL
cursor.execute("UPDATE series SET is_featured = 0")
print("Reset all featured to 0.")

# 2. Find Love's Ambition
target = "Love"
cursor.execute("SELECT id, title FROM series WHERE title LIKE '%Love%Ambition%' OR title LIKE '%Loves%Ambition%'")
rows = cursor.fetchall()

if not rows:
    print("Could not find Love's Ambition.")
    # Try finding ANY match with "Ambition"
    cursor.execute("SELECT id, title FROM series WHERE title LIKE '%Ambition%'")
    rows = cursor.fetchall()

if len(rows) == 1:
    s_id = rows[0][0]
    title = rows[0][1]
    print(f"Found target: {title} (ID: {s_id})")
    cursor.execute("UPDATE series SET is_featured = 1 WHERE id = ?", (s_id,))
    print("Set to Featured.")
elif len(rows) > 1:
    print(f"Found multiple: {rows}")
    # Pick first?
    s_id = rows[0][0]
    title = rows[0][1]
    print(f"Picking first: {title} (ID: {s_id})")
    cursor.execute("UPDATE series SET is_featured = 1 WHERE id = ?", (s_id,))
    print("Set to Featured.")
else:
    print("No series found to feature.")

conn.commit()
conn.close()
