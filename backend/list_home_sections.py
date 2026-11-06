import sqlite3

conn = sqlite3.connect('/app/weifansub.db')
c = conn.cursor()
rows = c.execute("SELECT id, title, section_type, filter_value, item_limit, position, is_active FROM home_sections ORDER BY position").fetchall()
for r in rows:
    print(r)
conn.close()
