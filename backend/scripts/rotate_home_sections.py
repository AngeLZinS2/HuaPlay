#!/usr/bin/env python3
"""
HuaPlay Home Sections Dynamic Curator & Rotator
================================================
Automates and maintains dynamic, cohesive homepage rows matching
HuaPlay's Asian catalog (C-Dramas, K-Dramas, Lakorns, Wuxia, Rom-Coms, etc.).

Usage:
  python rotate_home_sections.py --db /app/weifansub.db [--rotate] [--curate]
"""

import sqlite3
import argparse
import random
import sys

# Ensure UTF-8
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

EDITORIAL_PRESETS = [
    {
        "key": "popular",
        "title": "Em Alta no HuaPlay",
        "section_type": "popular",
        "filter_value": "",
        "item_limit": 18,
        "is_anchor": True,
    },
    {
        "key": "latest",
        "title": "Novos Lançamentos",
        "section_type": "latest",
        "filter_value": "",
        "item_limit": 18,
        "is_anchor": True,
    },
    {
        "key": "wuxia",
        "title": "Dramas de Época, Wuxia & Xianxia",
        "section_type": "genre",
        "filter_value": "Wuxia",
        "item_limit": 18,
        "is_anchor": False,
    },
    {
        "key": "korea",
        "title": "Doramas Coreanos em Destaque",
        "section_type": "country",
        "filter_value": "South Korea",
        "item_limit": 18,
        "is_anchor": False,
    },
    {
        "key": "thailand",
        "title": "Sucessos da Tailândia & Lakorns",
        "section_type": "country",
        "filter_value": "Thailand",
        "item_limit": 18,
        "is_anchor": False,
    },
    {
        "key": "romcom",
        "title": "Comédias Românticas Imperdíveis",
        "section_type": "genre",
        "filter_value": "Comédia",
        "item_limit": 18,
        "is_anchor": False,
    },
    {
        "key": "youth",
        "title": "Romance Escolar & Juventude",
        "section_type": "genre",
        "filter_value": "Youth",
        "item_limit": 18,
        "is_anchor": False,
    },
    {
        "key": "contract",
        "title": "Casamento por Contrato & Coabitação",
        "section_type": "genre",
        "filter_value": "Contrato",
        "item_limit": 18,
        "is_anchor": False,
    },
    {
        "key": "bl",
        "title": "Séries BL & LGBTQIA+ Asiáticas",
        "section_type": "genre",
        "filter_value": "LGBTQIA+",
        "item_limit": 18,
        "is_anchor": False,
    },
    {
        "key": "minis",
        "title": "Mini-Dramas & Web-Séries Chinesas",
        "section_type": "genre",
        "filter_value": "Minis",
        "item_limit": 18,
        "is_anchor": False,
    },
    {
        "key": "movies",
        "title": "Sessão de Cinema Asiático",
        "section_type": "type",
        "filter_value": "Movie",
        "item_limit": 18,
        "is_anchor": False,
    },
    {
        "key": "fantasy",
        "title": "Fantasia, Sobrenatural & Mitologia",
        "section_type": "genre",
        "filter_value": "Fantasy",
        "item_limit": 18,
        "is_anchor": False,
    },
    {
        "key": "mystery",
        "title": "Mistério, Crime & Suspense",
        "section_type": "genre",
        "filter_value": "Mistério",
        "item_limit": 18,
        "is_anchor": False,
    },
    {
        "key": "office",
        "title": "Romances de Escritório & Trabalho",
        "section_type": "genre",
        "filter_value": "Escritório",
        "item_limit": 18,
        "is_anchor": False,
    },
    {
        "key": "japan",
        "title": "Dramas Japoneses (J-Dramas)",
        "section_type": "country",
        "filter_value": "Japan",
        "item_limit": 18,
        "is_anchor": False,
    },
    {
        "key": "taiwan",
        "title": "Romances de Taiwan",
        "section_type": "country",
        "filter_value": "Taiwan",
        "item_limit": 18,
        "is_anchor": False,
    },
]


def count_series_for_preset(cursor: sqlite3.Cursor, preset: dict) -> int:
    kind = preset["section_type"]
    val = preset["filter_value"]
    if kind in ("popular", "latest"):
        return cursor.execute("SELECT count(*) FROM series WHERE publication_status = 'published'").fetchone()[0]
    if kind == "country":
        return cursor.execute("SELECT count(*) FROM series WHERE publication_status = 'published' AND country LIKE ?", (f"%{val}%",)).fetchone()[0]
    if kind == "genre":
        return cursor.execute("SELECT count(*) FROM series WHERE publication_status = 'published' AND genre LIKE ?", (f"%{val}%",)).fetchone()[0]
    if kind == "type":
        return cursor.execute("SELECT count(*) FROM series WHERE publication_status = 'published' AND type = ?", (val,)).fetchone()[0]
    return 0


def curate_home_sections(db_path: str, min_items: int = 8, shuffle_thematics: bool = False):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Separate anchors and thematic candidates
    anchors = [p for p in EDITORIAL_PRESETS if p.get("is_anchor")]
    thematics = [p for p in EDITORIAL_PRESETS if not p.get("is_anchor")]

    # Filter thematics having enough catalog items
    valid_thematics = []
    for t in thematics:
        cnt = count_series_for_preset(cursor, t)
        if cnt >= min_items:
            valid_thematics.append(t)

    if shuffle_thematics:
        random.shuffle(valid_thematics)

    chosen_sections = anchors + valid_thematics

    # Save to home_sections table
    cursor.execute("DELETE FROM home_sections")
    for pos, s in enumerate(chosen_sections):
        cursor.execute("""
            INSERT INTO home_sections (title, section_type, filter_value, item_limit, position, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        """, (s["title"], s["section_type"], s["filter_value"], s["item_limit"], pos))

    conn.commit()
    conn.close()
    print(f"Curadoria concluída: {len(chosen_sections)} fileiras ativas (Âncoras fixas + {len(valid_thematics)} temáticas).")


def rotate_active_thematics(db_path: str):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    rows = cursor.execute("""
        SELECT id, title, section_type, filter_value, item_limit, position, is_active
        FROM home_sections
        ORDER BY position
    """).fetchall()

    if len(rows) <= 3:
        # If very few rows, re-curate from full presets
        conn.close()
        curate_home_sections(db_path, shuffle_thematics=True)
        return

    # Keep position 0 and 1 fixed (Em Alta, Novos Lançamentos)
    anchors = rows[:2]
    thematics = list(rows[2:])
    random.shuffle(thematics)

    all_ordered = anchors + thematics
    for pos, r in enumerate(all_ordered):
        cursor.execute("UPDATE home_sections SET position = ? WHERE id = ?", (pos, r[0]))

    conn.commit()
    conn.close()
    print(f"Rotação concluída: {len(thematics)} fileiras temáticas rotacionadas na Home.")


def main():
    parser = argparse.ArgumentParser(description="HuaPlay Home Sections Dynamic Curator")
    parser.add_argument("--db", default="/app/weifansub.db")
    parser.add_argument("--rotate", action="store_true", help="Rotate existing thematic rows")
    parser.add_argument("--curate", action="store_true", help="Reset and curate all valid Asian presets")
    args = parser.parse_args()

    if args.rotate:
        rotate_active_thematics(args.db)
    else:
        # Default behavior: curate all
        curate_home_sections(args.db, shuffle_thematics=False)


if __name__ == "__main__":
    main()
