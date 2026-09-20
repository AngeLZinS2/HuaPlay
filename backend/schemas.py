from typing import List, Optional
from pydantic import BaseModel, field_validator
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class SeriesBase(BaseModel):
    title: str
    slug: Optional[str] = None
    description: Optional[str] = None
    cover_image: Optional[str] = None
    banner_image: Optional[str] = None
    genre: str
    type: str = "Series"
    country: str
    status: str
    release_year: int
    trailer_url: Optional[str] = None
    feature_type: Optional[str] = "TRAILER"
    cast: Optional[str] = None
    
    drive_link: Optional[str] = None
    mega_link: Optional[str] = None
    mediafire_link: Optional[str] = None
    pixeldrain_link: Optional[str] = None

    is_featured: bool = False
    views_count: Optional[int] = 0

    @field_validator("slug", mode="before")
    @classmethod
    def blank_slug_is_none(cls, value):
        """An empty slug means "no slug", which is NULL — not "".

        slug has a UNIQUE index. The admin form sends "" for a series that has
        none, so the first save claimed the empty string and every later save
        of another slug-less series hit the constraint. SQLite allows any number
        of NULLs in a unique index, so normalising here fixes all of them.
        """
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

class SeriesCreate(SeriesBase):
    pass

class Series(SeriesBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class FeaturedConfigBase(BaseModel):
    mode: str = "MOST_WATCHED"
    rotate_interval_minutes: int = 60
    manual_series_id: Optional[int] = None

class FeaturedConfigCreate(FeaturedConfigBase):
    pass

class FeaturedConfigResponse(FeaturedConfigBase):
    id: int
    manual_series: Optional[Series] = None
    class Config:
        from_attributes = True

class EpisodeBase(BaseModel):
    title: str
    episode_number: int
    season_number: Optional[int] = 1
    embed_url_1: Optional[str] = None
    embed_url_2: Optional[str] = None

    download_link: Optional[str] = None
    external_link: Optional[str] = None
    
    drive_link: Optional[str] = None
    mega_link: Optional[str] = None
    mediafire_link: Optional[str] = None
    pixeldrain_link: Optional[str] = None
    youtube_link: Optional[str] = None

class EpisodeCreate(EpisodeBase):
    pass

class Episode(EpisodeBase):
    id: int
    series_id: int
    created_at: datetime
    class Config:
        from_attributes = True

class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    password: str
    full_name: Optional[str] = None

class User(UserBase):
    id: int
    is_active: bool
    is_admin: bool
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    class Config:
        from_attributes = True

class WatchHistoryCreate(BaseModel):
    episode_id: int
    timestamp_seconds: Optional[int] = 0
    completed: Optional[bool] = False
    # True when the position was inferred from time on page, not read from a player.
    is_estimated: Optional[bool] = False

class WatchHistoryEntry(BaseModel):
    id: int
    profile_id: int
    episode_id: int
    series_id: int
    timestamp_seconds: int
    completed: bool
    is_estimated: bool = False
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class EpisodeProgress(BaseModel):
    episode_id: int
    episode_number: int
    timestamp_seconds: int
    completed: bool
    is_estimated: bool = False
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class ActorBase(BaseModel):
    name: str
    real_name: Optional[str] = None
    gender: str = "Female"
    image_url: Optional[str] = None
    bio: Optional[str] = None
    birth_date: Optional[str] = None
    social_media: Optional[str] = None

class ActorCreate(ActorBase):
    pass

class Actor(ActorBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True
class UserProfileBase(BaseModel):
    name: str
    avatar_url: Optional[str] = None

class UserProfileCreate(UserProfileBase):
    pass

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None

class UserProfile(UserProfileBase):
    id: int
    user_id: int
    created_at: datetime
    class Config:
        from_attributes = True

class UserWithProfiles(User):
    profiles: List[UserProfile] = []
