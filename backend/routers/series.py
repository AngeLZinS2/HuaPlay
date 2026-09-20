from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
import models, schemas
from database import get_db
from pydantic import BaseModel

router = APIRouter(
    prefix="/series",
    tags=["series"]
)

# Same URL prefix, but every route registered here inherits the admin guard
# from main.py. Writes go on admin_router; public reads stay on router.
admin_router = APIRouter(
    prefix="/series",
    tags=["series-admin"]
)

import time
import recommender
from typing import Optional
from fastapi import Header

def get_or_create_featured_config(db: Session) -> models.FeaturedConfig:
    config = db.query(models.FeaturedConfig).first()
    if not config:
        config = models.FeaturedConfig(
            id=1,
            mode="MOST_WATCHED",
            rotate_interval_minutes=60,
            manual_series_id=None
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

@router.get("/featured-config", response_model=schemas.FeaturedConfigResponse)
def get_featured_config(db: Session = Depends(get_db)):
    return get_or_create_featured_config(db)

@admin_router.post("/featured-config", response_model=schemas.FeaturedConfigResponse)
def update_featured_config(
    data: schemas.FeaturedConfigCreate,
    db: Session = Depends(get_db)
):
    config = get_or_create_featured_config(db)
    config.mode = data.mode
    config.rotate_interval_minutes = max(1, data.rotate_interval_minutes)
    config.manual_series_id = data.manual_series_id
    db.commit()
    db.refresh(config)
    return config

@router.get("/hero-featured", response_model=schemas.Series)
def get_hero_featured(db: Session = Depends(get_db)):
    config = get_or_create_featured_config(db)

    # 1. MANUAL MODE
    if config.mode == "MANUAL":
        # First check if any series is explicitly starred (is_featured = True)
        starred = db.query(models.Series).filter(models.Series.is_featured == True).first()
        if starred:
            return starred
        if config.manual_series_id:
            series = db.query(models.Series).filter(models.Series.id == config.manual_series_id).first()
            if series:
                return series

    # 2. MOST_WATCHED MODE
    if config.mode == "MOST_WATCHED":
        most_watched = (
            db.query(models.Series)
            .filter(models.Series.banner_image.isnot(None), models.Series.banner_image != "")
            .order_by(models.Series.views_count.desc(), models.Series.id.desc())
            .first()
        )
        if most_watched:
            return most_watched

    # 3. RANDOM_ROTATE MODE (or fallback)
    pool = (
        db.query(models.Series)
        .filter(models.Series.banner_image.isnot(None), models.Series.banner_image != "")
        .order_by(models.Series.id.asc())
        .all()
    )
    if not pool:
        pool = db.query(models.Series).order_by(models.Series.id.asc()).all()

    if pool:
        interval_seconds = max(60, config.rotate_interval_minutes * 60)
        time_slot = (int(time.time()) // interval_seconds) % len(pool)
        return pool[time_slot]

    raise HTTPException(status_code=404, detail="No series available for hero featured")

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(models.Series).count()
    completed = db.query(models.Series).filter(models.Series.status == "Completo").count()
    ongoing = db.query(models.Series).filter(models.Series.status == "Em andamento").count()
    
    types_query = db.query(models.Series.type, func.count(models.Series.type)).group_by(models.Series.type).all()
    types = {t[0]: t[1] for t in types_query}
    
    return {
        "total": total,
        "completed": completed,
        "ongoing": ongoing,
        "types": types
    }

class RecommendationSignals(BaseModel):
    """Taste signals the client reads from its own Firestore data."""
    watched_ids: List[int] = []
    liked_ids: List[int] = []
    listed_ids: List[int] = []
    recent_series_id: Optional[int] = None


@router.get("/recommendations")
def get_recommendations(db: Session = Depends(get_db)):
    """Cold-start recommendations, for signed-out visitors."""
    return recommender.get_ml_recommendations(db, limit=18)


@router.post("/recommendations")
def get_personalized_recommendations(
    signals: RecommendationSignals,
    db: Session = Depends(get_db)
):
    """Personalized recommendations from client-supplied signals.

    A POST because the signal lists can be long; nothing is stored.
    """
    return recommender.get_ml_recommendations(
        db,
        watched_ids=signals.watched_ids[:200],
        liked_ids=signals.liked_ids[:200],
        listed_ids=signals.listed_ids[:200],
        recent_series_id=signals.recent_series_id,
        limit=18,
    )

@router.get("/", response_model=List[schemas.Series])
def read_series(
    response: Response,
    skip: int = 0, 
    limit: int = 100, 
    search: str = None, 
    is_featured: bool = None,
    type: str = None,
    status: str = None,
    country: str = None,
    release_year: int = None,
    genre: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Series)
    
    if search:
        query = query.filter(models.Series.title.ilike(f"%{search}%"))
    if is_featured is not None:
        query = query.filter(models.Series.is_featured == is_featured)
    if type and type != "All":
        query = query.filter(models.Series.type == type)
    if status and status != "All":
        query = query.filter(models.Series.status == status)
    if country:
        query = query.filter(models.Series.country == country)
    if release_year:
        query = query.filter(models.Series.release_year == release_year)
    if genre:
        query = query.filter(models.Series.genre.ilike(f"%{genre}%"))

    # Get total count for pagination headers
    total_count = query.count()
    response.headers["X-Total-Count"] = str(total_count)

    series = query.order_by(models.Series.id.asc()).offset(skip).limit(limit).all()
    return series

@admin_router.post("/{series_id}/feature", response_model=schemas.Series)
def set_featured_series(series_id: int, db: Session = Depends(get_db)):
    series = db.query(models.Series).filter(models.Series.id == series_id).first()
    if series is None:
        raise HTTPException(status_code=404, detail="Series not found")
    
    # If already featured, unfeature it
    if series.is_featured:
        series.is_featured = False
        db.commit()
        db.refresh(series)
        return series
    
    # Unfeature all other series
    db.query(models.Series).update({models.Series.is_featured: False})
    
    # Feature the selected series
    series.is_featured = True

    # Automatically set featured mode to MANUAL when admin clicks the star icon
    config = get_or_create_featured_config(db)
    config.mode = "MANUAL"
    config.manual_series_id = series.id

    db.commit()
    db.refresh(series)
    return series

@router.get("/by-ids", response_model=List[schemas.Series])
def read_series_by_ids(ids: str, db: Session = Depends(get_db)):
    """Hydrate a set of series by id, in one round trip.

    Firestore stores only the series id for likes / my-list / history, so the
    client needs to resolve them against the catalog. Unlike /series/{id}, this
    does NOT increment views_count — these are list renders, not views, and
    counting them would inflate the popularity used by the hero rotation.
    """
    wanted = []
    for raw in ids.split(","):
        raw = raw.strip()
        if raw.isdigit():
            wanted.append(int(raw))
    if not wanted:
        return []
    # Bound the fan-out so a crafted query cannot ask for the whole catalog.
    wanted = wanted[:200]
    rows = db.query(models.Series).filter(models.Series.id.in_(wanted)).all()
    order = {sid: i for i, sid in enumerate(wanted)}
    return sorted(rows, key=lambda r: order.get(r.id, len(order)))


@router.get("/{series_ident}", response_model=schemas.Series)
def read_series_detail(series_ident: str, db: Session = Depends(get_db)):
    if series_ident.isdigit():
        series = db.query(models.Series).filter(models.Series.id == int(series_ident)).first()
    else:
        series = db.query(models.Series).filter(models.Series.slug == series_ident).first()
        
    if series is None:
        raise HTTPException(status_code=404, detail="Series not found")

    # Increment popularity views count
    series.views_count = (series.views_count or 0) + 1
    db.commit()
    db.refresh(series)
    return series

@router.get("/{series_ident}/episodes", response_model=List[schemas.Episode])
def read_episodes(series_ident: str, db: Session = Depends(get_db)):
    if series_ident.isdigit():
        series_id = int(series_ident)
    else:
        series = db.query(models.Series).filter(models.Series.slug == series_ident).first()
        if not series:
            raise HTTPException(status_code=404, detail="Series not found")
        series_id = series.id
        
    episodes = (
        db.query(models.Episode)
        .filter(models.Episode.series_id == series_id)
        .order_by(
            (models.Episode.season_number == 0),
            models.Episode.season_number,
            models.Episode.episode_number,
        )
        .all()
    )
    return episodes
from datetime import datetime

def commit_or_conflict(db: Session):
    """Commit, turning a constraint clash into a readable 409.

    slug carries a UNIQUE index, so a duplicate used to surface as an unhandled
    IntegrityError. That answers 500 without passing through CORSMiddleware, so
    the browser reported a CORS failure and hid the real cause.
    """
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        detail = "Já existe uma série com esse slug." if "slug" in str(exc.orig) else f"Violação de restrição no banco: {exc.orig}"
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


@admin_router.post("/", response_model=schemas.Series, status_code=status.HTTP_201_CREATED)
def create_series(series: schemas.SeriesCreate, db: Session = Depends(get_db)):
    series_data = {k: v for k, v in series.dict().items() if hasattr(models.Series, k)}
    db_series = models.Series(**series_data, created_at=datetime.now())
    db.add(db_series)
    commit_or_conflict(db)
    db.refresh(db_series)
    return db_series

@admin_router.put("/{series_id}", response_model=schemas.Series)
def update_series(series_id: int, series: schemas.SeriesCreate, db: Session = Depends(get_db)):
    db_series = db.query(models.Series).filter(models.Series.id == series_id).first()
    if db_series is None:
        raise HTTPException(status_code=404, detail="Series not found")

    for key, value in series.dict().items():
        if hasattr(models.Series, key):
            setattr(db_series, key, value)

    commit_or_conflict(db)
    db.refresh(db_series)
    return db_series

@admin_router.delete("/{series_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_series(series_id: int, db: Session = Depends(get_db)):
    series = db.query(models.Series).filter(models.Series.id == series_id).first()
    if series is None:
        raise HTTPException(status_code=404, detail="Series not found")
    db.delete(series)
    db.commit()
    return None

@admin_router.post("/{series_id}/episodes", response_model=schemas.Episode, status_code=status.HTTP_201_CREATED)
def create_episode(series_id: int, episode: schemas.EpisodeCreate, db: Session = Depends(get_db)):
    db_episode = models.Episode(**episode.dict(), series_id=series_id, created_at=datetime.now())
    db.add(db_episode)
    db.commit()
    db.refresh(db_episode)
    return db_episode

@admin_router.put("/episodes/{episode_id}", response_model=schemas.Episode)
def update_episode(episode_id: int, episode: schemas.EpisodeCreate, db: Session = Depends(get_db)):
    db_episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if db_episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    for key, value in episode.dict().items():
        setattr(db_episode, key, value)
    
    db.commit()
    db.refresh(db_episode)
    return db_episode

@admin_router.delete("/episodes/{episode_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_episode(episode_id: int, db: Session = Depends(get_db)):
    db_episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if db_episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    db.delete(db_episode)
    db.commit()
    return None
