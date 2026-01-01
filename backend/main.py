from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth, series, users, actors

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="WEI Fansub API", version="0.1.0")

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

app.include_router(auth.router)
app.include_router(series.router)
app.include_router(users.router)
app.include_router(actors.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to WEI Fansub API"}
