from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import models, schemas
from database import get_db
from datetime import datetime

router = APIRouter(
    prefix="/actors",
    tags=["actors"]
)

@router.get("/", response_model=List[schemas.Actor])
def read_actors(skip: int = 0, limit: int = 100, gender: str = None, db: Session = Depends(get_db)):
    query = db.query(models.Actor)
    if gender:
        query = query.filter(models.Actor.gender == gender)
    actors = query.offset(skip).limit(limit).all()
    return actors

@router.post("/", response_model=schemas.Actor, status_code=status.HTTP_201_CREATED)
def create_actor(actor: schemas.ActorCreate, db: Session = Depends(get_db)):
    db_actor = models.Actor(**actor.dict(), created_at=datetime.now())
    db.add(db_actor)
    db.commit()
    db.refresh(db_actor)
    return db_actor

@router.get("/{actor_id}", response_model=schemas.Actor)
def read_actor(actor_id: int, db: Session = Depends(get_db)):
    db_actor = db.query(models.Actor).filter(models.Actor.id == actor_id).first()
    if db_actor is None:
        raise HTTPException(status_code=404, detail="Actor not found")
    return db_actor

@router.put("/{actor_id}", response_model=schemas.Actor)
def update_actor(actor_id: int, actor: schemas.ActorCreate, db: Session = Depends(get_db)):
    db_actor = db.query(models.Actor).filter(models.Actor.id == actor_id).first()
    if db_actor is None:
        raise HTTPException(status_code=404, detail="Actor not found")
    
    for key, value in actor.dict().items():
        setattr(db_actor, key, value)
    
    db.commit()
    db.refresh(db_actor)
    return db_actor

@router.delete("/{actor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_actor(actor_id: int, db: Session = Depends(get_db)):
    db_actor = db.query(models.Actor).filter(models.Actor.id == actor_id).first()
    if db_actor is None:
        raise HTTPException(status_code=404, detail="Actor not found")
    db.delete(db_actor)
    db.commit()
    return None
