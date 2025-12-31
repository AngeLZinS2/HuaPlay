import sqlite3

def clean_db():
    conn = sqlite3.connect('weifansub.db')
    cursor = conn.cursor()
    
    # 1. Delete actors with diamond in name
    cursor.execute("DELETE FROM actors WHERE name LIKE '%💎%'")
    deleted_diamonds = cursor.rowcount
    
    # 2. Delete actors with very short names (likely artifacts)
    cursor.execute("DELETE FROM actors WHERE length(name) < 2")
    deleted_short = cursor.rowcount
    
    # 3. Clean Bio fields that contain "Fonte" at the end (simple heuristic update)
    # This is harder to do with SQL only, better to rely on scraper re-run.
    # But we can try to cut off if we know the pattern.
    
    conn.commit()
    conn.close()
    print(f"Deleted {deleted_diamonds} entries with diamonds.")
    print(f"Deleted {deleted_short} entries with short names.")

if __name__ == "__main__":
    clean_db()
