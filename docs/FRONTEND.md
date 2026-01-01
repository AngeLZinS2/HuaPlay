# Frontend Documentation

The frontend is a specialized single-page application (SPA) built with **React**, **TypeScript**, and **Vite**, styled with **Tailwind CSS**.

## 🛠 Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Run Development Server**:
   ```bash
   npm run dev
   ```
   The app will run at `http://localhost:5173`.

## 📂 Project Structure

- `src/components/`: Reusable UI components.
  - `admin/`: Admin-specific components (*Refactored*).
    - `StatsGrid.tsx`: Dashboard statistics cards.
    - `DashboardToolbar.tsx`: Search, filter, and tab controls.
    - `SeriesTable.tsx`: Main data table for series.
    - `ActorsTable.tsx`: Data table for actors.
    - `EpisodeManager.tsx`: Episode list and management for a series.
    - `SeriesModal.tsx`, `ActorModal.tsx`, `EpisodeModal.tsx`: Forms for creating/editing content.
- `src/pages/`: Main application views.
  - `AdminDashboard.tsx`: The main orchestration page (Controller) that manages state and renders the admin components.
  - `Home.tsx`: Public homepage.
  - `SeriesDetail.tsx`: Public series view.
- `src/services/`: API integration.
  - `api.ts`: Axios instance with interceptors.
- `src/context/`: React Contexts (e.g., `ToastContext` for notifications).

## 🧩 Key Features & Implementation

### Admin Dashboard Refactor
The `AdminDashboard` was recently refactored from a monolithic file into smaller, focused components to improve maintainability.
- **State Management**: The parent `AdminDashboard.tsx` holds the "source of truth" state (series list, current page, search term) and passes it down via props.
- **Pagination**: Server-side pagination is implemented. The `SeriesTable` component manages the local input state for page navigation to prevent UX glitches.
- **Search & Filtering**: Search is debounced (500ms) to reduce API calls. Filters for Type, Status, Country, etc., are applied server-side.

### Public Interface
- **Hero Section**: Dynamic hero that can switch between a Trailer (video) or a Banner (image) based on the `feature_type` of the highlighted series.
- **Video Player**: Custom video player integration and support for various embed sources (YouTube, Google Drive, Mega, etc.).

## 🎨 Styling

- **Tailwind CSS**: Used for utility-first styling.
- **Framer Motion**: Used for page transitions and micro-interactions (e.g., table row fade-ins, modal animations).
