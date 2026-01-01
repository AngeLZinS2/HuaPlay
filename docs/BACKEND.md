# Backend Documentation

The backend is built with **FastAPI** and uses **SQLAlchemy** with **SQLite** for data persistence.

## 🛠 Setup & Installation

1. **Python Version**: Ensure Python 3.8+ is installed.
2. **Virtual Environment**:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   ```
3. **Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
4. **Run Server**:
   ```bash
   uvicorn main:app --reload
   ```
   The API will be available at `http://localhost:8000`.
   Automatic API docs (Swagger UI) at `http://localhost:8000/docs`.

## 🗄 Database Models (`models.py`)

- **Series**: Represents a TV series or movie.
  - Fields: `id`, `title`, `cover_image`, `banner_image`, `description`, `type`, `status`, `release_year`, `genre`, `country`, `is_featured`, `feature_type`, `trailer_url`, `slug`.
  
- **Actor**: Represents an actor or actress.
  - Fields: `id`, `name`, `image_url`, `gender`.

- **Episode**: Represents an episode of a series.
  - Fields: `id`, `series_id`, `title`, `episode_number`, `video_url`, `youtube_link`, `is_locked`, and various embed/download links.

- **Admin**: User model for dashboard access.

## 🔌 API Endpoints

### Series
- `GET /series/`: List all series (supports filters: `skip`, `limit`, `search`, `type`, `status`, `country`, `release_year`).
- `GET /series/stats`: Get aggregate statistics (Total, Ongoing, Completed).
- `POST /series/`: Create a new series.
- `GET /series/{id}`: Get details of a specific series.
- `PUT /series/{id}`: Update a series.
- `DELETE /series/{id}`: Delete a series.

### Episodes
- `GET /episodes/series/{series_id}`: Get all episodes for a series.
- `POST /episodes/`: Add a new episode.
- `PUT /episodes/{id}`: Update an episode.
- `DELETE /episodes/{id}`: Delete an episode.

### Actors
- `GET /actors/`: List all actors.
- `POST /actors/`: Add a new actor.
- `PUT /actors/{id}`: Update an actor.
- `DELETE /actors/{id}`: Delete an actor.

## ⚙️ Key Scripts

- `main.py`: Application entry point. Configures CORS and includes routers.
- `database.py`: Database connection and session management.
- `auth.py`: JWT authentication logic (login, token verification).
- `import_data.py`: Scraper script to import data from external sources (legacy/migration tool).
