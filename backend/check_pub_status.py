import sqlite3

conn = sqlite3.connect('/app/weifansub.db')
c = conn.cursor()
status_counts = c.execute("SELECT publication_status, count(*) FROM series GROUP BY publication_status").fetchall()
print("Publication status counts:", status_counts)
conn.close()
