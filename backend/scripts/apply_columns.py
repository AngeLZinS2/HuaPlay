"""Add columns declared on the models that are missing from the live database.

Companion to apply_indexes.py. SQLAlchemy's create_all() never alters an
existing table, so a column added to models.py after the fact silently does not
exist. SQLite supports ALTER TABLE ADD COLUMN, which is additive and safe.

    python scripts/apply_columns.py [--dry-run]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text

import models  # noqa: F401
from database import Base, engine


def sql_default(column):
    if column.default is None or column.default.arg is None:
        return None
    value = column.default.arg
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return f"'{value}'"


def main(dry_run: bool = False) -> int:
    inspector = inspect(engine)
    added = []

    for table in Base.metadata.sorted_tables:
        if not inspector.has_table(table.name):
            continue
        existing = {c["name"] for c in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in existing:
                continue
            ddl = f"ALTER TABLE {table.name} ADD COLUMN {column.name} {column.type.compile(engine.dialect)}"
            default = sql_default(column)
            if default is not None:
                ddl += f" DEFAULT {default}"
            added.append(f"{table.name}.{column.name}")
            if not dry_run:
                with engine.begin() as conn:
                    conn.execute(text(ddl))

    print(("would add: " if dry_run else "added: ") + (", ".join(added) if added else "(none)"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(dry_run="--dry-run" in sys.argv))
