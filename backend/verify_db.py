import sqlite3

def verify():
    conn = sqlite3.connect('weifansub.db')
    cursor = conn.cursor()
    cursor.execute("SELECT name, bio, birth_date, social_media FROM actors WHERE bio IS NOT NULL LIMIT 5")
    rows = cursor.fetchall()
    for row in rows:
        print(f"Name: {row[0]}")
        print(f"Bio: {row[1][:50]}...")
        print(f"Birth Date: {row[2]}")
        print(f"Socials: {row[3]}")
        print("-" * 20)
    conn.close()

if __name__ == "__main__":
    verify()
