import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ModalProvider } from './context/ModalContext';
import SeriesDetailsModal from './components/SeriesDetailsModal';
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
