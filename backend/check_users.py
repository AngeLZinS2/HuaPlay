from database import SessionLocal
from models import User

db = SessionLocal()
users = db.query(User).all()

print(f"Found {len(users)} users:")
for u in users:
    print(f"ID: {u.id}, Email: {u.email}, Name: {u.full_name}")

db.close()
