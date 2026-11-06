# -*- coding: utf-8 -*-
import sqlite3

conn = sqlite3.connect('/app/weifansub.db')
c = conn.cursor()

curated_sections = [
    {
        "title": "Em Alta no HuaPlay",
        "section_type": "popular",
        "filter_value": "",
        "item_limit": 18,
        "position": 0,
        "is_active": 1
    },
    {
        "title": "Novos Lançamentos",
        "section_type": "latest",
        "filter_value": "",
        "item_limit": 18,
        "position": 1,
        "is_active": 1
    },
    {
        "title": "Dramas de Época, Wuxia & Xianxia",
        "section_type": "genre",
        "filter_value": "Wuxia",
        "item_limit": 18,
        "position": 2,
        "is_active": 1
    },
    {
        "title": "Doramas Coreanos em Destaque",
        "section_type": "country",
        "filter_value": "South Korea",
        "item_limit": 18,
        "position": 3,
        "is_active": 1
    },
    {
        "title": "Sucessos da Tailândia & Lakorns",
        "section_type": "country",
        "filter_value": "Thailand",
        "item_limit": 18,
        "position": 4,
        "is_active": 1
    },
    {
        "title": "Comédias Românticas Imperdíveis",
        "section_type": "genre",
        "filter_value": "Comédia",
        "item_limit": 18,
        "position": 5,
        "is_active": 1
    },
    {
        "title": "Romance Escolar & Juventude",
        "section_type": "genre",
        "filter_value": "Youth",
        "item_limit": 18,
        "position": 6,
        "is_active": 1
    },
    {
        "title": "Casamento por Contrato & Coabitação",
        "section_type": "genre",
        "filter_value": "Contrato",
        "item_limit": 18,
        "position": 7,
        "is_active": 1
    },
    {
        "title": "Séries BL & LGBTQIA+ Asiáticas",
        "section_type": "genre",
        "filter_value": "LGBTQIA+",
        "item_limit": 18,
        "position": 8,
        "is_active": 1
    },
    {
        "title": "Mini-Dramas & Web-Séries Chinesas",
        "section_type": "genre",
        "filter_value": "Minis",
        "item_limit": 18,
        "position": 9,
        "is_active": 1
    },
    {
        "title": "Sessão de Cinema Asiático",
        "section_type": "type",
        "filter_value": "Movie",
        "item_limit": 18,
        "position": 10,
        "is_active": 1
    },
    {
        "title": "Fantasia, Sobrenatural & Mitologia",
        "section_type": "genre",
        "filter_value": "Fantasy",
        "item_limit": 18,
        "position": 11,
        "is_active": 1
    },
    {
        "title": "Mistério, Crime & Suspense",
        "section_type": "genre",
        "filter_value": "Mistério",
        "item_limit": 18,
        "position": 12,
        "is_active": 1
    },
]

c.execute("DELETE FROM home_sections")
for s in curated_sections:
    c.execute("""
        INSERT INTO home_sections (title, section_type, filter_value, item_limit, position, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (s["title"], s["section_type"], s["filter_value"], s["item_limit"], s["position"], s["is_active"]))

conn.commit()
conn.close()
print("Populated clean UTF-8!")
