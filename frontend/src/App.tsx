import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ModalProvider } from './context/ModalContext';
import { NotificationProvider } from './context/NotificationContext';
import { useAuth } from './context/AuthContext';
import { lazy, Suspense, use, useEffect, type ComponentType, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import SeriesDetailsModal from './components/SeriesDetailsModal';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import PageTransition from './components/PageTransition';
import AdminLayout from './components/admin/AdminLayout';
import RequireAdmin from './components/admin/RequireAdmin';
import MobileBottomNav from './components/MobileBottomNav';
import ShakeToReport from './components/ShakeToReport';

const isNativeAndroid = import.meta.env.MODE === 'mobile' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
const NativeAppUpdater = isNativeAndroid
  ? lazy(() => import('./components/NativeAppUpdater'))
  : null;

function lazyPage<T extends ComponentType>(loader: () => Promise<{ default: T }>) {
  let pending: ReturnType<typeof loader> | undefined;
  const preload = () => pending ??= loader();
  return { Page: lazy(preload), preload };
}

const { Page: Login, preload: loadLogin } = lazyPage(() => import('./pages/Login'));
const { Page: Profile, preload: loadProfile } = lazyPage(() => import('./pages/Profile'));
const { Page: AdminDashboard, preload: loadAdminDashboard } = lazyPage(() => import('./pages/AdminDashboard'));
const { Page: AdminSeries, preload: loadAdminSeries } = lazyPage(() => import('./pages/AdminSeries'));
const { Page: AdminEpisodes, preload: loadAdminEpisodes } = lazyPage(() => import('./pages/AdminEpisodes'));
const { Page: AdminImporter, preload: loadAdminImporter } = lazyPage(() => import('./pages/AdminImporter'));
const { Page: AdminGenres, preload: loadAdminGenres } = lazyPage(() => import('./pages/AdminGenres'));
const { Page: AdminActors, preload: loadAdminActors } = lazyPage(() => import('./pages/AdminActors'));
const { Page: AdminHome, preload: loadAdminHome } = lazyPage(() => import('./pages/AdminHome'));
const { Page: AdminHighlights, preload: loadAdminHighlights } = lazyPage(() => import('./pages/AdminHighlights'));
const { Page: AdminCalendar, preload: loadAdminCalendar } = lazyPage(() => import('./pages/AdminCalendar'));
const { Page: AdminAnalytics, preload: loadAdminAnalytics } = lazyPage(() => import('./pages/AdminAnalytics'));
const { Page: AdminNotifications, preload: loadAdminNotifications } = lazyPage(() => import('./pages/AdminNotifications'));
const { Page: AdminHealth, preload: loadAdminHealth } = lazyPage(() => import('./pages/AdminHealth'));
const { Page: AdminReports, preload: loadAdminReports } = lazyPage(() => import('./pages/AdminReports'));
const { Page: AdminHistory, preload: loadAdminHistory } = lazyPage(() => import('./pages/AdminHistory'));
const { Page: AdminMaintenance, preload: loadAdminMaintenance } = lazyPage(() => import('./pages/AdminMaintenance'));
const { Page: AdminHomePreview, preload: loadAdminHomePreview } = lazyPage(() => import('./pages/AdminHomePreview'));
const { Page: SeriesDetail, preload: loadSeriesDetail } = lazyPage(() => import('./pages/SeriesDetail'));
const { Page: Actors, preload: loadActors } = lazyPage(() => import('./pages/Actors'));
const { Page: ActorDetail, preload: loadActorDetail } = lazyPage(() => import('./pages/ActorDetail'));
const { Page: MyList, preload: loadMyList } = lazyPage(() => import('./pages/MyList'));
const { Page: Profiles, preload: loadProfiles } = lazyPage(() => import('./pages/Profiles'));
const { Page: FAQ, preload: loadFAQ } = lazyPage(() => import('./pages/FAQ'));
const { Page: Terms, preload: loadTerms } = lazyPage(() => import('./pages/Terms'));
const { Page: Privacy, preload: loadPrivacy } = lazyPage(() => import('./pages/Privacy'));
const { Page: Copyright, preload: loadCopyright } = lazyPage(() => import('./pages/Copyright'));
const { Page: Contact, preload: loadContact } = lazyPage(() => import('./pages/Contact'));
const { Page: CategoryExplore, preload: loadCategoryExplore } = lazyPage(() => import('./pages/CategoryExplore'));

const pageLoaders: Record<string, () => Promise<unknown>> = {
  '/login': loadLogin, '/profile': loadProfile, '/profiles': loadProfiles,
  '/my-list': loadMyList, '/actors': loadActors, '/actresses': loadActors,
  '/explore': loadCategoryExplore, '/schedule': loadCategoryExplore, '/coming-soon': loadCategoryExplore,
  '/faq': loadFAQ, '/terms': loadTerms, '/privacy': loadPrivacy,
  '/copyright': loadCopyright, '/contact': loadContact,
  '/admin': loadAdminDashboard,
  '/admin/series': loadAdminSeries,
  '/admin/episodes': loadAdminEpisodes,
  '/admin/import': loadAdminImporter,
  '/admin/genres': loadAdminGenres,
  '/admin/actors': loadAdminActors,
  '/admin/home': loadAdminHome,
  '/admin/highlights': loadAdminHighlights,
  '/admin/calendar': loadAdminCalendar,
  '/admin/analytics': loadAdminAnalytics,
  '/admin/notifications': loadAdminNotifications,
  '/admin/health': loadAdminHealth,
  '/admin/reports': loadAdminReports,
  '/admin/history': loadAdminHistory,
  '/admin/maintenance': loadAdminMaintenance,
  '/admin/home-preview': loadAdminHomePreview,
};

function RouteReady({ pathname, children }: { pathname: string; children: ReactNode }) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const loader = pageLoaders[normalized]
    ?? (normalized.startsWith('/series/') ? loadSeriesDetail : undefined)
    ?? (normalized.startsWith('/actors/') ? loadActorDetail : undefined)
    ?? (/^\/(category|tag|collection)\//.test(normalized) ? loadCategoryExplore : undefined);

  // Suspend before AnimatePresence starts its exit, keeping the previous page
  // visible during the router transition until the destination chunk is ready.
  if (loader) use(loader());
  return children;
}

function PageLoading() {
  return <div className="min-h-screen flex items-center justify-center text-white bg-background">
    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>;
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModalProvider>
      <NotificationProvider>
        <div className="min-h-screen flex flex-col font-sans bg-background text-white">
          <Navbar />
          <main className="flex-grow">{children}</main>
          <Footer />
          <MobileBottomNav />
          <ShakeToReport />
          <SeriesDetailsModal />
        </div>
      </NotificationProvider>
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
      <>
        <RequireAdmin>
          <AdminLayout>
            <Suspense fallback={<PageLoading />}>
              <RouteReady pathname={location.pathname}>
                <AnimatePresence mode="wait">
                  <Routes location={location} key={location.pathname}>
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/series" element={<AdminSeries />} />
                    <Route path="/admin/episodes" element={<AdminEpisodes />} />
                    <Route path="/admin/import" element={<AdminImporter />} />
                    <Route path="/admin/genres" element={<AdminGenres />} />
                    <Route path="/admin/actors" element={<AdminActors />} />
                    <Route path="/admin/home" element={<AdminHome />} />
                    <Route path="/admin/highlights" element={<AdminHighlights />} />
                    <Route path="/admin/calendar" element={<AdminCalendar />} />
                    <Route path="/admin/analytics" element={<AdminAnalytics />} />
                    <Route path="/admin/notifications" element={<AdminNotifications />} />
                    <Route path="/admin/health" element={<AdminHealth />} />
                    <Route path="/admin/reports" element={<AdminReports />} />
                    <Route path="/admin/history" element={<AdminHistory />} />
                    <Route path="/admin/maintenance" element={<AdminMaintenance />} />
                    <Route path="/admin/home-preview" element={<AdminHomePreview />} />
                  </Routes>
                </AnimatePresence>
              </RouteReady>
            </Suspense>
          </AdminLayout>
        </RequireAdmin>
        {NativeAppUpdater && (
          <Suspense fallback={null}>
            <NativeAppUpdater />
          </Suspense>
        )}
      </>
    );
  }

  // ─── Public Layout ─────────────────────────────────────────────────────────
  return (
    <>
      <PublicLayout>
        <Suspense fallback={<PageLoading />}>
          <RouteReady pathname={location.pathname}>
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
                <Route path="/faq" element={<PageTransition><FAQ /></PageTransition>} />
                <Route path="/terms" element={<PageTransition><Terms /></PageTransition>} />
                <Route path="/privacy" element={<PageTransition><Privacy /></PageTransition>} />
                <Route path="/copyright" element={<PageTransition><Copyright /></PageTransition>} />
                <Route path="/contact" element={<PageTransition><Contact /></PageTransition>} />
              </Routes>
            </AnimatePresence>
          </RouteReady>
        </Suspense>
      </PublicLayout>
      {NativeAppUpdater && (
        <Suspense fallback={null}>
          <NativeAppUpdater />
        </Suspense>
      )}
    </>
  );
}

export default App;
