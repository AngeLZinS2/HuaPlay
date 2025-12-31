from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import models, schemas
from database import get_db

router = APIRouter(
    prefix="/series",
    tags=["series"]
)

@router.get("/", response_model=List[schemas.Series])
def read_series(skip: int = 0, limit: int = 100, search: str = None, is_featured: bool = None, db: Session = Depends(get_db)):
    query = db.query(models.Series)
    if search:
        query = query.filter(models.Series.title.ilike(f"%{search}%"))
    if is_featured is not None:
        query = query.filter(models.Series.is_featured == is_featured)
    series = query.offset(skip).limit(limit).all()
    return series

@router.post("/{series_id}/feature", response_model=schemas.Series)
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
    db.commit()
    db.refresh(series)
    return series

@router.get("/{series_ident}", response_model=schemas.Series)
def read_series_detail(series_ident: str, db: Session = Depends(get_db)):
    if series_ident.isdigit():
        series = db.query(models.Series).filter(models.Series.id == int(series_ident)).first()
    else:
        series = db.query(models.Series).filter(models.Series.slug == series_ident).first()
        
    if series is None:
        raise HTTPException(status_code=404, detail="Series not found")
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
        
    episodes = db.query(models.Episode).filter(models.Episode.series_id == series_id).order_by(models.Episode.episode_number).all()
    return episodes
from datetime import datetime

@router.post("/", response_model=schemas.Series, status_code=status.HTTP_201_CREATED)
def create_series(series: schemas.SeriesCreate, db: Session = Depends(get_db)):
    db_series = models.Series(**series.dict(), created_at=datetime.now())
    db.add(db_series)
    db.commit()
    db.refresh(db_series)
    return db_series

@router.put("/{series_id}", response_model=schemas.Series)
def update_series(series_id: int, series: schemas.SeriesCreate, db: Session = Depends(get_db)):
    db_series = db.query(models.Series).filter(models.Series.id == series_id).first()
    if db_series is None:
        raise HTTPException(status_code=404, detail="Series not found")
    
    for key, value in series.dict().items():
        setattr(db_series, key, value)
    
    db.commit()
    db.refresh(db_series)
    return db_series

@router.delete("/{series_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_series(series_id: int, db: Session = Depends(get_db)):
    series = db.query(models.Series).filter(models.Series.id == series_id).first()
    if series is None:
        raise HTTPException(status_code=404, detail="Series not found")
    db.delete(series)
    db.commit()
    return None

@router.post("/{series_id}/episodes", response_model=schemas.Episode, status_code=status.HTTP_201_CREATED)
def create_episode(series_id: int, episode: schemas.EpisodeCreate, db: Session = Depends(get_db)):
    db_episode = models.Episode(**episode.dict(), series_id=series_id, created_at=datetime.now())
    db.add(db_episode)
    db.commit()
    db.refresh(db_episode)
    return db_episode

@router.put("/episodes/{episode_id}", response_model=schemas.Episode)
def update_episode(episode_id: int, episode: schemas.EpisodeCreate, db: Session = Depends(get_db)):
    db_episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if db_episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    for key, value in episode.dict().items():
        setattr(db_episode, key, value)
    
    db.commit()
    db.refresh(db_episode)
    return db_episode

@router.delete("/episodes/{episode_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_episode(episode_id: int, db: Session = Depends(get_db)):
    db_episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if db_episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    db.delete(db_episode)
    db.commit()
    return None
