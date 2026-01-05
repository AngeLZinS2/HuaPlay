import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ModalProvider } from './context/ModalContext';
import { useAuth } from './context/AuthContext';
import { useEffect } from 'react';
import SeriesDetailsModal from './components/SeriesDetailsModal';
// ... rest of imports
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import SeriesDetail from './pages/SeriesDetail';
import Actors from './pages/Actors';
import ActorDetail from './pages/ActorDetail';
import MyList from './pages/MyList';
import Profiles from './pages/Profiles';
import PageTransition from './components/PageTransition';

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, currentProfile, isLoading } = useAuth();

  useEffect(() => {
    // If authenticated but no profile selected, and not on profiles page (or sensitive pages), redirect to profiles
    if (!isLoading && isAuthenticated && !currentProfile) {
      if (location.pathname !== '/profiles' && location.pathname !== '/login') {
        navigate('/profiles');
      }
    }
  }, [isAuthenticated, currentProfile, isLoading, location.pathname, navigate]);

  return (
    <ModalProvider>
      <div className="min-h-screen flex flex-col font-sans bg-background text-white">
        <Navbar />
        <main className="flex-grow">
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={
                <PageTransition>
                  <Home />
                </PageTransition>
              } />
              <Route path="/series/:id" element={
                <PageTransition>
                  <SeriesDetail />
                </PageTransition>
              } />
              <Route path="/login" element={
                <PageTransition>
                  <Login />
                </PageTransition>
              } />
              <Route path="/profiles" element={
                <PageTransition>
                  <Profiles />
                </PageTransition>
              } />
              <Route path="/explore" element={
                <PageTransition>
                  <div className="pt-20 text-center text-gray-500">Página Explorar (Em Breve)</div>
                </PageTransition>
              } />
              <Route path="/my-list" element={
                <PageTransition>
                  <MyList />
                </PageTransition>
              } />
              <Route path="/profile" element={
                <PageTransition>
                  <Profile />
                </PageTransition>
              } />
              <Route path="/admin" element={
                <PageTransition>
                  <AdminDashboard />
                </PageTransition>
              } />
              <Route path="/actors" element={
                <PageTransition>
                  <Actors gender="Male" title="Atores" />
                </PageTransition>
              } />
              <Route path="/actresses" element={
                <PageTransition>
                  <Actors gender="Female" title="Atrizes" />
                </PageTransition>
              } />
              <Route path="/actors/:id" element={
                <PageTransition>
                  <ActorDetail />
                </PageTransition>
              } />
            </Routes>
          </AnimatePresence>
        </main>
        <Footer />
        <SeriesDetailsModal />
      </div>
    </ModalProvider>
  );
}

export default App;
