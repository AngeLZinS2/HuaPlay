from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models, schemas
from database import get_db
from auth import get_current_user

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

@router.get("/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@router.get("/me/history", response_model=List[schemas.Series])
def read_watch_history(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # For now, return mock empty list or actual query if relationship exists
    # Ideally: return [h.series for h in current_user.history]
    return []

@router.get("/me/list", response_model=List[schemas.Series])
def read_my_list(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Ideally: return [l.series for l in current_user.my_list]
    return []
