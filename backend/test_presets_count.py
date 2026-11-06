import sqlite3

conn = sqlite3.connect('/app/weifansub.db')
c = conn.cursor()

presets = [
    ("Em Alta no HuaPlay", "popular", ""),
    ("Novos Lançamentos", "latest", ""),
    ("Dramas de Época, Wuxia & Xianxia", "genre", "Wuxia"),
    ("Doramas Coreanos em Destaque", "country", "South Korea"),
    ("Sucessos da Tailândia & Lakorns", "country", "Thailand"),
    ("Comédias Românticas Imperdíveis", "genre", "Comédia"),
    ("Romance Escolar & Juventude", "genre", "Youth"),
    ("Casamento por Contrato & Coabitação", "genre", "Contrato"),
    ("Séries BL & LGBTQIA+ Asiáticas", "genre", "LGBTQIA+"),
    ("Mini-Dramas & Web-Séries Chinesas", "genre", "Minis"),
    ("Sessão de Cinema Asiático", "type", "Movie"),
    ("Fantasia & Sobrenatural", "genre", "Fantasy"),
    ("Suspense, Ação & Mistério", "genre", "Mistério"),
]

print("=== VERIFICANDO CONTAGEM DE CADA FILEIRA SUGERIDA ===")
for title, kind, val in presets:
    if kind == "popular" or kind == "latest":
        count = c.execute("SELECT count(*) FROM series WHERE publication_status = 'published'").fetchone()[0]
    elif kind == "country":
        count = c.execute("SELECT count(*) FROM series WHERE publication_status = 'published' AND country LIKE ?", (f"%{val}%",)).fetchone()[0]
    elif kind == "genre":
        count = c.execute("SELECT count(*) FROM series WHERE publication_status = 'published' AND genre LIKE ?", (f"%{val}%",)).fetchone()[0]
    elif kind == "type":
        count = c.execute("SELECT count(*) FROM series WHERE publication_status = 'published' AND type = ?", (val,)).fetchone()[0]
    print(f"'{title}' ({kind}={val}) -> {count} séries disponíveis")

conn.close()
