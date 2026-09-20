import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ModalProvider } from './context/ModalContext';
import { useAuth } from './context/AuthContext';
import { useEffect } from 'react';
import SeriesDetailsModal from './components/SeriesDetailsModal';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import AdminSeries from './pages/AdminSeries';
import AdminActors from './pages/AdminActors';
import SeriesDetail from './pages/SeriesDetail';
import Actors from './pages/Actors';
import ActorDetail from './pages/ActorDetail';
import MyList from './pages/MyList';
import Profiles from './pages/Profiles';
import PageTransition from './components/PageTransition';
import AdminLayout from './components/admin/AdminLayout';
import RequireAdmin from './components/admin/RequireAdmin';

import CategoryExplore from './pages/CategoryExplore';

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModalProvider>
      <div className="min-h-screen flex flex-col font-sans bg-background text-white">
        <Navbar />
        <main className="flex-grow">{children}</main>
        <Footer />
        <SeriesDetailsModal />
      </div>
    </ModalProvider>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, currentProfile, isLoading } = useAuth();

  const isAdminRoute = location.pathname.startsWith('/admin');

  useEffect(() => {
    if (!isLoading && isAuthenticated && !currentProfile && !isAdminRoute) {
      if (location.pathname !== '/profiles' && location.pathname !== '/login') {
        navigate('/profiles');
      }
    }
  }, [isAuthenticated, currentProfile, isLoading, location.pathname, navigate, isAdminRoute]);

  // ─── Admin Layout (isolated) ───────────────────────────────────────────────
  if (isAdminRoute) {
    return (
      <RequireAdmin>
        <AdminLayout>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/series" element={<AdminSeries />} />
              <Route path="/admin/actors" element={<AdminActors />} />
            </Routes>
          </AnimatePresence>
        </AdminLayout>
      </RequireAdmin>
    );
  }

  // ─── Public Layout ─────────────────────────────────────────────────────────
  return (
    <PublicLayout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><Home /></PageTransition>} />
          <Route path="/series/:id" element={<PageTransition><SeriesDetail /></PageTransition>} />
          <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
          <Route path="/profiles" element={<PageTransition><Profiles /></PageTransition>} />
          <Route path="/explore" element={<PageTransition><CategoryExplore /></PageTransition>} />
          <Route path="/category/:category" element={<PageTransition><CategoryExplore /></PageTransition>} />
          <Route path="/tag/:tag" element={<PageTransition><CategoryExplore /></PageTransition>} />
          <Route path="/collection/:collection" element={<PageTransition><CategoryExplore /></PageTransition>} />
          <Route path="/schedule" element={<PageTransition><CategoryExplore /></PageTransition>} />
          <Route path="/coming-soon" element={<PageTransition><CategoryExplore /></PageTransition>} />
          <Route path="/my-list" element={<PageTransition><MyList /></PageTransition>} />
          <Route path="/profile" element={<PageTransition><Profile /></PageTransition>} />
          <Route path="/actors" element={<PageTransition><Actors gender="Male" title="Atores" /></PageTransition>} />
          <Route path="/actresses" element={<PageTransition><Actors gender="Female" title="Atrizes" /></PageTransition>} />
          <Route path="/actors/:id" element={<PageTransition><ActorDetail /></PageTransition>} />
        </Routes>
      </AnimatePresence>
    </PublicLayout>
  );
}

export default App;
