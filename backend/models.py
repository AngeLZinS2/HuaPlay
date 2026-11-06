from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text, func, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String, nullable=True) # Added full_name
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    
    # Profile info - Now managed via UserProfile, but keeping basics here optionally or moving them?
    # Keeping basic user info here, profiles manage their own lists
    profiles = relationship("UserProfile", back_populates="user")
    
    # Relationships now moved to Profile, but we might keep some for legacy or global access?
    # For now, let's keep them on User for backward compat until migration is done, 
    # but strictly speaking they should move to UserProfile. 
    # To follow the plan: "Update existing models ... to reference profile_id"
    # We will point them to UserProfile.

class UserProfile(Base):
    __tablename__ = "user_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="profiles")
    
    # Relationships specific to this profile
    watch_history = relationship("WatchHistory", back_populates="profile")
    my_list = relationship("UserList", back_populates="profile")
    likes = relationship("Like", back_populates="profile")


# ... Series and Episode classes remain same ...



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
    pixeldrain_link = Column(String, nullable=True)
    telegram_link = Column(String, nullable=True)

    slug = Column(String, unique=True, index=True, nullable=True)
    is_featured = Column(Boolean, default=False) # Only one series should be true
    views_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Published is the legacy-safe default: existing catalog behavior remains
    # unchanged until an editor explicitly moves an item into a workflow state.
    publication_status = Column(String, default="published", nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)

    episodes = relationship("Episode", back_populates="series", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="series")

class Episode(Base):
    __tablename__ = "episodes"
    # Covers "episodes of a series, ordered by season then number" — the hottest
    # read in the app.
    __table_args__ = (
        Index("ix_episodes_series_season_number", "series_id", "season_number", "episode_number"),
    )

    id = Column(Integer, primary_key=True, index=True)
    series_id = Column(Integer, ForeignKey("series.id"))
    title = Column(String, index=True)
    episode_number = Column(Integer, index=True)
    # Seasons of one show used to be stored as separate Series rows, which made
    # the recommender treat them as different works and repeat them on the home
    # page. 0 is reserved for specials and OVAs, as TMDb and Plex do.
    season_number = Column(Integer, default=1)

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

    publication_status = Column(String, default="published", nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    series = relationship("Series", back_populates="episodes")
    watch_history = relationship("WatchHistory", back_populates="episode")

class WatchHistory(Base):
    __tablename__ = "watch_history"
    # Lookup key for the per-episode upsert and the per-profile history listing.
    __table_args__ = (Index("ix_watch_history_profile_episode", "profile_id", "episode_id"),)

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("user_profiles.id"))
    episode_id = Column(Integer, ForeignKey("episodes.id"))
    timestamp_seconds = Column(Integer, default=0) # Last watched position
    completed = Column(Boolean, default=False)
    # True when timestamp_seconds was inferred from time spent on the page rather
    # than read from a real player. Providers other than YouTube expose no API, so
    # their positions are estimates and the UI must not present them as exact.
    is_estimated = Column(Boolean, default=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    profile = relationship("UserProfile", back_populates="watch_history")
    episode = relationship("Episode", back_populates="watch_history")

class UserList(Base):
    __tablename__ = "user_list"
    
    # Using profile_id now
    profile_id = Column(Integer, ForeignKey("user_profiles.id"), primary_key=True)
    series_id = Column(Integer, ForeignKey("series.id"), primary_key=True)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    profile = relationship("UserProfile", back_populates="my_list")
    series = relationship("Series")

class Like(Base):
    __tablename__ = "likes"

    profile_id = Column(Integer, ForeignKey("user_profiles.id"), primary_key=True)
    series_id = Column(Integer, ForeignKey("series.id"), primary_key=True)

    profile = relationship("UserProfile", back_populates="likes")
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

class FeaturedConfig(Base):
    __tablename__ = "featured_config"

    id = Column(Integer, primary_key=True, default=1)
    mode = Column(String, default="MOST_WATCHED")  # "MOST_WATCHED", "RANDOM_ROTATE", "MANUAL"
    rotate_interval_minutes = Column(Integer, default=60)  # Rotation interval in minutes (60 = 1 hour)
    manual_series_id = Column(Integer, ForeignKey("series.id"), nullable=True)

    manual_series = relationship("Series")


class PlaybackReport(Base):
    __tablename__ = "playback_reports"

    id = Column(Integer, primary_key=True, index=True)
    series_id = Column(Integer, ForeignKey("series.id", ondelete="SET NULL"), nullable=True, index=True)
    episode_id = Column(Integer, ForeignKey("episodes.id", ondelete="SET NULL"), nullable=True, index=True)
    reporter_email = Column(String, nullable=True, index=True)
    category = Column(String, nullable=False, default="playback")
    reason = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    page_url = Column(String, nullable=True)
    source_url = Column(String, nullable=True)
    status = Column(String, nullable=False, default="open", index=True)
    admin_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    series = relationship("Series")
    episode = relationship("Episode")


class HomeSection(Base):
    __tablename__ = "home_sections"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    section_type = Column(String, nullable=False, default="latest")
    filter_value = Column(String, nullable=True)
    series_ids = Column(Text, nullable=True)
    item_limit = Column(Integer, nullable=False, default=18)
    position = Column(Integer, nullable=False, default=0, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class HeroSlide(Base):
    __tablename__ = "hero_slides"

    id = Column(Integer, primary_key=True, index=True)
    series_id = Column(Integer, ForeignKey("series.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=True)
    subtitle = Column(String, nullable=True)
    image_url = Column(String, nullable=False)
    action_url = Column(String, nullable=True)
    position = Column(Integer, nullable=False, default=0)
    duration_seconds = Column(Integer, nullable=False, default=8)
    is_active = Column(Boolean, nullable=False, default=True)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AdminNotification(Base):
    __tablename__ = "admin_notifications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    image_url = Column(String, nullable=True)
    action_url = Column(String, nullable=True)
    audience = Column(String, nullable=False, default="all") # "all", "web", "android"
    status = Column(String, nullable=False, default="draft") # "draft", "scheduled", "published", "cancelled"
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Push delivery state & audit
    push_status = Column(String, nullable=False, default="not_requested") # "not_requested", "pending_credentials", "pending", "processing", "sent", "partial_failure", "failed", "skipped_no_tokens", "cancelled"
    push_error = Column(Text, nullable=True)
    push_sent_count = Column(Integer, nullable=False, default=0)
    push_failed_count = Column(Integer, nullable=False, default=0)
    retry_count = Column(Integer, nullable=False, default=0)
    max_retries = Column(Integer, nullable=False, default=3)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)

    # Concurrency claim for background worker execution
    claimed_at = Column(DateTime(timezone=True), nullable=True)
    claimed_by = Column(String, nullable=True)

    delivery_recipients = relationship("PushDeliveryRecipient", cascade="all, delete-orphan", backref="notification")


class PushDeviceToken(Base):
    __tablename__ = "push_device_tokens"
    __table_args__ = (
        Index("ix_push_device_tokens_user_platform", "user_id", "platform"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    token = Column(String, nullable=False, unique=True, index=True)
    platform = Column(String, nullable=False, default="web", index=True) # "web" or "android"
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_seen_at = Column(DateTime(timezone=True), nullable=True)


class PushDeliveryRecipient(Base):
    __tablename__ = "push_delivery_recipients"
    __table_args__ = (
        UniqueConstraint("notification_id", "token_id", name="uq_notification_recipient"),
        Index("ix_push_delivery_recipients_notif_status", "notification_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    notification_id = Column(Integer, ForeignKey("admin_notifications.id", ondelete="CASCADE"), nullable=False)
    token_id = Column(Integer, ForeignKey("push_device_tokens.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, nullable=False, default="pending")  # "pending", "sent", "failed"
    error_message = Column(Text, nullable=True)
    attempt_count = Column(Integer, nullable=False, default=0)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    device_token = relationship("PushDeviceToken")


class SearchEvent(Base):
    __tablename__ = "search_events"

    id = Column(Integer, primary_key=True, index=True)
    query = Column(String, nullable=False, index=True)
    result_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, nullable=False, index=True)
    entity_type = Column(String, nullable=False, index=True)
    entity_id = Column(Integer, nullable=True)
    payload = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class TrashItem(Base):
    __tablename__ = "trash_items"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String, nullable=False, index=True)
    entity_id = Column(Integer, nullable=True)
    label = Column(String, nullable=True)
    payload = Column(Text, nullable=False)
    deleted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    restored_at = Column(DateTime(timezone=True), nullable=True)


class HomeLayoutVersion(Base):
    __tablename__ = "home_layout_versions"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String, nullable=False, default="draft", index=True)
    payload = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)


class ScheduledRelease(Base):
    __tablename__ = "scheduled_releases"

    id = Column(Integer, primary_key=True, index=True)
    resource_type = Column(String, nullable=False, default="series")
    resource_id = Column(Integer, nullable=False)
    title = Column(String, nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(String, nullable=False, default="scheduled")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CatalogGenre(Base):
    __tablename__ = "catalog_genres"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

