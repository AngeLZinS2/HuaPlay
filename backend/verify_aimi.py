import sqlite3

def verify_aimi():
    conn = sqlite3.connect('weifansub.db')
    cursor = conn.cursor()
    cursor.execute("SELECT bio FROM actors WHERE name = 'Ai Mi'")
    row = cursor.fetchone()
    if row:
        print(f"Bio content:\n{row[0]}")
    else:
        print("Ai Mi not found.")
    conn.close()

if __name__ == "__main__":
    verify_aimi()
