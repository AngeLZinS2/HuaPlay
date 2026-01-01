# Weifansub

Weifansub is a specialized streaming platform for Asian dramas and series, featuring a robust admin dashboard for content management.

## 🚀 Features

- **Public Interface**:
  - Modern, responsive Hero section with video backgrounds and banners.
  - Series browsing with filtering by Type (Drama, Movie, etc.), Status, Country, and Year.
  - Detailed Series pages with episodes, cast, and related content.
  - Mobile-responsive design.

- **Admin Dashboard**:
  - Secure authentication.
  - **Dashboard Overview**: Visualization of total stats (Series, Ongoing, Completed).
  - **Series Management**: Add, Edit, Delete, Search, Filter, and Paginate series.
  - **Episode Management**: Manage episodes, including multiple embed sources, YouTube links, and download links.
  - **Actor Management**: Manage actor profiles linked to series.
  - **Highlight Control**: Toggle series as "Featured" with choice of Trailer or Banner highlight.

## 🛠 Tech Stack

### Frontend
- **Framework**: React (Vite)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **HTTP Client**: Axios

### Backend
- **Framework**: FastAPI (Python)
- **Database**: SQLite (SQLAlchemy ORM)
- **Authentication**: JWT (JSON Web Tokens)

## 📦 Project Structure

```bash
Weifansub/
├── backend/            # FastAPI Backend
│   ├── routers/        # API Routes (series, actors, etc.)
│   ├── main.py         # Application entry point
│   ├── models.py       # Database models
│   ├── schemas.py      # Pydantic schemas
│   └── weifansub.db    # SQLite Database
├── frontend/           # React Frontend
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Application pages (AdminDashboard, Home, etc.)
│   │   └── services/   # API services
│   └── index.html
└── docs/               # Detailed Documentation
```

## 🏁 Quick Start

### Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate virtual environment:
   ```bash
   python -m venv venv
   # Windows
   .\venv\Scripts\activate
   # Linux/Mac
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the server:
   ```bash
   uvicorn main:app --reload
   ```

### Frontend
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## 📚 Documentation

For more detailed information, please check the `docs/` folder:
- [Backend Documentation](docs/BACKEND.md)
- [Frontend Documentation](docs/FRONTEND.md)
