from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import FirebaseUser, get_current_admin, get_current_user
from database import Base, engine
from routers import actors, series

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="HuaPlay Catalog API", version="0.2.0")

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

# Content writes. The guard lives on the include, not on each route, so a new
# endpoint added to an admin_router cannot ship unprotected by accident.
app.include_router(series.admin_router, dependencies=[Depends(get_current_admin)])
app.include_router(actors.admin_router, dependencies=[Depends(get_current_admin)])


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
