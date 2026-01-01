from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text, func
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    
    # Profile info
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)

    watch_history = relationship("WatchHistory", back_populates="user")
    my_list = relationship("UserList", back_populates="user")
    likes = relationship("Like", back_populates="user")

class Series(Base):
    __tablename__ = "series"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text, nullable=True)
    cover_image = Column(String, nullable=True) # Vertical poster
    banner_image = Column(String, nullable=True) # Horizontal hero
    genre = Column(String, index=True)
    type = Column(String, default="Series") # Series, Movie, Anime, Donghua
    country = Column(String, index=True) # KR, CN, JP, TH, etc.
    status = Column(String) # Ongoing, Completed
    release_year = Column(Integer)
    trailer_url = Column(String, nullable=True) # YouTube/Embed URL
    feature_type = Column(String, default="TRAILER") # 'TRAILER' or 'BANNER'
    cast = Column(String, nullable=True) # Comma-separated list of actors
    
    # Download Links
    drive_link = Column(String, nullable=True)
    mega_link = Column(String, nullable=True)
    mediafire_link = Column(String, nullable=True)
    telegram_link = Column(String, nullable=True)

    slug = Column(String, unique=True, index=True, nullable=True)
    is_featured = Column(Boolean, default=False) # Only one series should be true
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    episodes = relationship("Episode", back_populates="series", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="series")

class Episode(Base):
    __tablename__ = "episodes"

    id = Column(Integer, primary_key=True, index=True)
    series_id = Column(Integer, ForeignKey("series.id"))
    title = Column(String, index=True)
    episode_number = Column(Integer, index=True)
    
    # Content links
    embed_url_1 = Column(String, nullable=True)
    embed_url_2 = Column(String, nullable=True)

    download_link = Column(String, nullable=True)
    external_link = Column(String, nullable=True)

    # Specific provider links
    drive_link = Column(String, nullable=True)
    mega_link = Column(String, nullable=True)
    mediafire_link = Column(String, nullable=True)
    pixeldrain_link = Column(String, nullable=True)
    youtube_link = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    series = relationship("Series", back_populates="episodes")
    watch_history = relationship("WatchHistory", back_populates="episode")

class WatchHistory(Base):
    __tablename__ = "watch_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    episode_id = Column(Integer, ForeignKey("episodes.id"))
    timestamp_seconds = Column(Integer, default=0) # Last watched position
    completed = Column(Boolean, default=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="watch_history")
    episode = relationship("Episode", back_populates="watch_history")

class UserList(Base):
    __tablename__ = "user_list"
    
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    series_id = Column(Integer, ForeignKey("series.id"), primary_key=True)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="my_list")
    series = relationship("Series")

class Like(Base):
    __tablename__ = "likes"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    series_id = Column(Integer, ForeignKey("series.id"), primary_key=True)

    user = relationship("User", back_populates="likes")
    series = relationship("Series", back_populates="likes")

class Actor(Base):
    __tablename__ = "actors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    real_name = Column(String, nullable=True)
    gender = Column(String)  # "Male" or "Female"
    image_url = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    birth_date = Column(String, nullable=True)
    social_media = Column(String, nullable=True)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
