from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from auth import FirebaseUser, get_current_admin, get_current_user
from database import Base, engine
from fcm_service import start_push_worker, stop_push_worker
from routers import actors, series, admin, admin_suite, notifications

# Create tables
Base.metadata.create_all(bind=engine)


def ensure_admin_columns() -> None:
    """Apply the small additive migration needed by existing SQLite installs."""
    inspector = inspect(engine)
    additions = {
        "series": {
            "publication_status": "VARCHAR NOT NULL DEFAULT 'published'",
            "scheduled_at": "DATETIME",
        },
        "episodes": {
            "publication_status": "VARCHAR NOT NULL DEFAULT 'published'",
            "scheduled_at": "DATETIME",
        },
        "admin_notifications": {
            "push_status": "VARCHAR NOT NULL DEFAULT 'not_requested'",
            "push_error": "TEXT",
            "push_sent_count": "INTEGER NOT NULL DEFAULT 0",
            "push_failed_count": "INTEGER NOT NULL DEFAULT 0",
            "retry_count": "INTEGER NOT NULL DEFAULT 0",
            "max_retries": "INTEGER NOT NULL DEFAULT 3",
            "next_retry_at": "DATETIME",
            "claimed_at": "DATETIME",
            "claimed_by": "VARCHAR",
            "updated_at": "DATETIME",
        },
    }
    with engine.begin() as connection:
        for table_name, columns in additions.items():
            if not inspector.has_table(table_name):
                continue
            existing = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, declaration in columns.items():
                if column_name not in existing:
                    connection.execute(text(
                        f"ALTER TABLE {table_name} ADD COLUMN {column_name} {declaration}"
                    ))


ensure_admin_columns()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Lifecycle-managed background polling worker
    start_push_worker()
    yield
    await stop_push_worker()


app = FastAPI(title="HuaPlay Catalog API", version="0.2.0", lifespan=lifespan)

# CORS setup
origins = [
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)

# Public catalog reads.
app.include_router(series.router)
app.include_router(actors.router)
app.include_router(admin.public_router)
app.include_router(admin_suite.public_router)
app.include_router(notifications.router)

# Content writes. The guard lives on the include, not on each route, so a new
# endpoint added to an admin_router cannot ship unprotected by accident.
app.include_router(series.admin_router, dependencies=[Depends(get_current_admin)])
app.include_router(actors.admin_router, dependencies=[Depends(get_current_admin)])
app.include_router(admin.admin_router, dependencies=[Depends(get_current_admin)])
app.include_router(admin_suite.admin_router, dependencies=[Depends(get_current_admin)])


@app.get("/")
def read_root():
    return {"message": "HuaPlay Catalog API"}


@app.get("/auth/me")
def read_current_user(current_user: FirebaseUser = Depends(get_current_user)):
    """Echo back the verified identity.

    The client already knows who it is from the Firebase SDK; what it cannot
    know on its own is whether this backend considers it an administrator, since
    that is decided server-side.
    """
    return {
        "uid": current_user.uid,
        "email": current_user.email,
        "name": current_user.name,
        "email_verified": current_user.email_verified,
        "is_admin": current_user.is_admin,
    }
