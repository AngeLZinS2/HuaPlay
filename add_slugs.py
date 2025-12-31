
import sqlite3
import re
from contextlib import contextmanager

DB_PATH = "backend/weifansub.db"

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    text = text.strip('-')
    return text

def migrate_slugs():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Check if column exists
    cursor.execute("PRAGMA table_info(series)")
    columns = [info[1] for info in cursor.fetchall()]
    
    if "slug" not in columns:
        print("Adding slug column...")
        try:
            cursor.execute("ALTER TABLE series ADD COLUMN slug TEXT")
        except Exception as e:
            print(f"Error adding column: {e}")
    else:
        print("Slug column already exists.")

    # 2. Populate slugs
    print("Populating slugs...")
    cursor.execute("SELECT id, title, slug FROM series")
    rows = cursor.fetchall()
    
    for row in rows:
        series_id, title, existing_slug = row
        if not existing_slug:
            new_slug = slugify(title)
            
            # Ensure uniqueness (simple way: append id if needed, though title should be unique mostly)
            # Check if slug exists
            cursor.execute("SELECT id FROM series WHERE slug = ? AND id != ?", (new_slug, series_id))
            if cursor.fetchone():
                new_slug = f"{new_slug}-{series_id}"
            
            print(f"Updating ID {series_id}: {title} -> {new_slug}")
            cursor.execute("UPDATE series SET slug = ? WHERE id = ?", (new_slug, series_id))
    
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate_slugs()
