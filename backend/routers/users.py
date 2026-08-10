from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
import models, schemas
from database import get_db
from auth import get_current_user

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

# --- Dependency to get active profile ---
def get_current_profile(
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing_profiles = db.query(models.UserProfile).filter(models.UserProfile.user_id == current_user.id).all()
    if not existing_profiles:
        default_name = current_user.full_name
        if not default_name and current_user.email:
             default_name = current_user.email.split('@')[0]
        if not default_name:
            default_name = "Principal"

        main_profile = models.UserProfile(
            user_id=current_user.id,
            name=default_name,
            avatar_url="https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-qo9h82134t9nv0j0.jpg"
        )
        db.add(main_profile)
        db.commit()
        db.refresh(main_profile)
        existing_profiles = [main_profile]

    if not x_profile_id:
        return existing_profiles[0]

    profile = db.query(models.UserProfile).filter(models.UserProfile.id == x_profile_id).first()
    if not profile or profile.user_id != current_user.id:
        return existing_profiles[0]
    
    return profile

# --- Profile Management Endpoints ---

@router.get("/profiles", response_model=List[schemas.UserProfile])
def read_profiles(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Trigger auto-creation if empty
    profiles = db.query(models.UserProfile).filter(models.UserProfile.user_id == current_user.id).all()
    if not profiles:
        # Determine default name
        default_name = current_user.full_name
        if not default_name and current_user.email:
             default_name = current_user.email.split('@')[0]
        if not default_name:
            default_name = "Principal"

        main_profile = models.UserProfile(
            user_id=current_user.id,
            name=default_name,
            avatar_url="https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-qo9h82134t9nv0j0.jpg"
        )
        db.add(main_profile)
        db.commit()
        db.refresh(main_profile)
        return [main_profile]
    return profiles

@router.post("/profiles", response_model=schemas.UserProfile)
def create_profile(profile: schemas.UserProfileCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    count = db.query(models.UserProfile).filter(models.UserProfile.user_id == current_user.id).count()
    if count >= 3:
        raise HTTPException(status_code=400, detail="Maximum 3 profiles allowed")
    
    new_profile = models.UserProfile(
        user_id=current_user.id,
        name=profile.name,
        avatar_url=profile.avatar_url or "https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-qo9h82134t9nv0j0.jpg"
    )
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)
    return new_profile

@router.put("/profiles/{profile_id}", response_model=schemas.UserProfile)
def update_profile(
    profile_id: int, 
    profile_update: schemas.UserProfileUpdate, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    profile = db.query(models.UserProfile).filter(
        models.UserProfile.id == profile_id, 
        models.UserProfile.user_id == current_user.id
    ).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    if profile_update.name is not None:
        profile.name = profile_update.name
    if profile_update.avatar_url is not None:
        profile.avatar_url = profile_update.avatar_url

    db.commit()
    db.refresh(profile)
    return profile

@router.delete("/profiles/{profile_id}")
def delete_profile(profile_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(models.UserProfile).filter(models.UserProfile.id == profile_id, models.UserProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Check if last profile?
    count = db.query(models.UserProfile).filter(models.UserProfile.user_id == current_user.id).count()
    # if count <= 1:
        # raise HTTPException(status_code=400, detail="Cannot delete the last profile")

    db.delete(profile)
    db.commit()
    return {"message": "Profile deleted"}

# --- List / Likes / History Endpoints (Profile Scoped) ---

@router.get("/me", response_model=schemas.UserWithProfiles)
def read_users_me(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Ensure UserWithProfiles schema allows implicit fetch or eager load
    # Because of 'relationship', SQLA should handle it, but pydantic definition of UserWithProfiles needs 'profiles' field
    # We added 'profiles' to schemas.UserWithProfiles
    return current_user

@router.get("/me/list", response_model=List[schemas.Series])
def read_my_list(
    current_profile: models.UserProfile = Depends(get_current_profile),
    db: Session = Depends(get_db)
):
    if not current_profile:
         raise HTTPException(status_code=400, detail="Profile header required")

    user_list_items = db.query(models.UserList).filter(models.UserList.profile_id == current_profile.id).all()
    series_list = []
    for item in user_list_items:
        series = db.query(models.Series).filter(models.Series.id == item.series_id).first()
        if series:
            series_list.append(series)
    return series_list

@router.post("/me/list/{series_id}", status_code=201)
def add_to_list(
    series_id: int, 
    current_profile: models.UserProfile = Depends(get_current_profile), 
    db: Session = Depends(get_db)
):
    if not current_profile:
         raise HTTPException(status_code=400, detail="Profile header required")

    series = db.query(models.Series).filter(models.Series.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    
    existing_item = db.query(models.UserList).filter(
        models.UserList.profile_id == current_profile.id,
        models.UserList.series_id == series_id
    ).first()
    
    if existing_item:
        return {"message": "Series already in list"}
        
    new_item = models.UserList(profile_id=current_profile.id, series_id=series_id)
    db.add(new_item)
    db.commit()
    return {"message": "Series added to list"}

@router.delete("/me/list/{series_id}", status_code=204)
def remove_from_list(
    series_id: int, 
    current_profile: models.UserProfile = Depends(get_current_profile), 
    db: Session = Depends(get_db)
):
    if not current_profile:
         raise HTTPException(status_code=400, detail="Profile header required")

    item = db.query(models.UserList).filter(
        models.UserList.profile_id == current_profile.id,
        models.UserList.series_id == series_id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Series not found in list")
        
    db.delete(item)
    db.commit()
    return None

@router.get("/me/likes", response_model=List[schemas.Series])
def read_likes(
    current_profile: models.UserProfile = Depends(get_current_profile), 
    db: Session = Depends(get_db)
):
    if not current_profile:
         raise HTTPException(status_code=400, detail="Profile header required")

    likes = db.query(models.Like).filter(models.Like.profile_id == current_profile.id).all()
    series_list = []
    for like in likes:
        series = db.query(models.Series).filter(models.Series.id == like.series_id).first()
        if series:
            series_list.append(series)
    return series_list

@router.post("/me/likes/{series_id}", status_code=201)
def like_series(
    series_id: int, 
    current_profile: models.UserProfile = Depends(get_current_profile), 
    db: Session = Depends(get_db)
):
    if not current_profile:
         raise HTTPException(status_code=400, detail="Profile header required")

    series = db.query(models.Series).filter(models.Series.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
        
    existing_like = db.query(models.Like).filter(
        models.Like.profile_id == current_profile.id,
        models.Like.series_id == series_id
    ).first()
    
    if existing_like:
        return {"message": "Already liked"}
        
    new_like = models.Like(profile_id=current_profile.id, series_id=series_id)
    db.add(new_like)
    db.commit()
    return {"message": "Series liked"}

@router.delete("/me/likes/{series_id}", status_code=204)
def unlike_series(
    series_id: int, 
    current_profile: models.UserProfile = Depends(get_current_profile), 
    db: Session = Depends(get_db)
):
    if not current_profile:
         raise HTTPException(status_code=400, detail="Profile header required")

    like = db.query(models.Like).filter(
        models.Like.profile_id == current_profile.id,
        models.Like.series_id == series_id
    ).first()
    
    if not like:
        raise HTTPException(status_code=404, detail="Like not found")
        
    db.delete(like)
    db.commit()
    return None

@router.get("/me/history", response_model=List[schemas.Series])
def read_watch_history(
    current_profile: models.UserProfile = Depends(get_current_profile),
    db: Session = Depends(get_db)
):
    if not current_profile:
         raise HTTPException(status_code=400, detail="Profile header required")

    # Get history ordered by most recent
    history_items = db.query(models.WatchHistory).filter(
        models.WatchHistory.profile_id == current_profile.id
    ).order_by(models.WatchHistory.updated_at.desc()).all()
    
    series_list = []
    seen_series_ids = set()
    
    for item in history_items:
        # Check if episode and series exist (data integrity)
        if item.episode and item.episode.series:
            series = item.episode.series
            if series.id not in seen_series_ids:
                series_list.append(series)
                seen_series_ids.add(series.id)
    
    return series_list
