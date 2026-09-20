"""Create any index declared on the models that is missing from the live database.

SQLAlchemy's create_all() only creates missing *tables* — it never touches an
existing one, which is why indexes added to a model after the table was created
silently never exist. Run this after adding an Index() to models.py.

    python scripts/apply_indexes.py [--dry-run]

Idempotent: an index that already exists is left alone.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect

import models  # noqa: F401  (registers the tables on Base.metadata)
from database import Base, engine


def main(dry_run: bool = False) -> int:
    inspector = inspect(engine)
    created, skipped = [], []

    for table in Base.metadata.sorted_tables:
        if not inspector.has_table(table.name):
            print(f"  ! table missing, skipping: {table.name}")
            continue
        existing = {ix["name"] for ix in inspector.get_indexes(table.name)}
        for index in table.indexes:
            if index.name in existing:
                skipped.append(index.name)
                continue
            if dry_run:
                created.append(index.name)
                continue
            index.create(bind=engine)
            created.append(index.name)

    verb = "would create" if dry_run else "created"
    print(f"{verb}: {created or '(none)'}")
    print(f"already present: {len(skipped)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(dry_run="--dry-run" in sys.argv))
