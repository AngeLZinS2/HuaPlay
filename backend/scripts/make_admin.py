"""Grant or revoke the is_admin flag for a user.

    python scripts/make_admin.py <email>            # grant
    python scripts/make_admin.py <email> --revoke   # revoke
    python scripts/make_admin.py --list             # show current admins

Content write endpoints require this flag (see auth.get_current_admin), so at
least one user must hold it for the admin panel to work.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import models
from database import SessionLocal


def main(argv: list[str]) -> int:
    db = SessionLocal()
    try:
        if "--list" in argv:
            admins = db.query(models.User).filter(models.User.is_admin == True).all()  # noqa: E712
            if not admins:
                print("no admins defined")
            for u in admins:
                print(f"  {u.id}  {u.email}  ({u.full_name})")
            return 0

        args = [a for a in argv if not a.startswith("--")]
        if not args:
            print(__doc__)
            return 1

        email = args[0]
        revoke = "--revoke" in argv

        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            print(f"user not found: {email}")
            print("known users:")
            for u in db.query(models.User).all():
                print(f"  {u.email}")
            return 1

        was = bool(user.is_admin)
        user.is_admin = not revoke
        db.commit()
        print(f"{email}: is_admin {was} -> {bool(user.is_admin)}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
