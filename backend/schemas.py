from typing import List, Optional
from pydantic import BaseModel
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
    cast: Optional[str] = None
    
    drive_link: Optional[str] = None
    mega_link: Optional[str] = None
    mediafire_link: Optional[str] = None
    pixeldrain_link: Optional[str] = None

    is_featured: bool = False


class SeriesCreate(SeriesBase):
    pass

class Series(SeriesBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class EpisodeBase(BaseModel):
    title: str
    episode_number: int
    embed_url_1: Optional[str] = None
    embed_url_2: Optional[str] = None

    download_link: Optional[str] = None
    external_link: Optional[str] = None
    
    drive_link: Optional[str] = None
    mega_link: Optional[str] = None
    mediafire_link: Optional[str] = None
    pixeldrain_link: Optional[str] = None

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

class User(UserBase):
    id: int
    is_active: bool
    is_admin: bool
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
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
