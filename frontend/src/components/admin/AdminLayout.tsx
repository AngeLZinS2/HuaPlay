import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard,
    Tv,
    Users,
    LogOut,
    Home,
    Menu,
    X,
    ChevronRight,
    Shield,
} from 'lucide-react';

interface AdminLayoutProps {
    children: React.ReactNode;
}

const navItems = [
    { label: 'Visão Geral', icon: LayoutDashboard, path: '/admin' },
    { label: 'Séries', icon: Tv, path: '/admin/series' },
    { label: 'Atores', icon: Users, path: '/admin/actors' },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Failed to sign out', error);
        } finally {
            navigate('/login');
        }
    };

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-6 border-b border-white/5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                    <p className="text-white font-bold text-sm tracking-wide" style={{ fontFamily: 'Cinzel, serif' }}>HuaPlay</p>
                    <p className="text-gray-500 text-xs">Painel Admin</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/admin'}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                                isActive
                                    ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon className={`w-4.5 h-4.5 ${isActive ? 'text-yellow-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
                                <span className="flex-1">{item.label}</span>
                                {isActive && <ChevronRight className="w-3.5 h-3.5 text-yellow-500/60" />}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* User + Logout */}
            <div className="px-3 pb-4 border-t border-white/5 pt-4">
                <div className="flex items-center gap-3 px-3 py-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400/20 to-yellow-600/10 border border-yellow-500/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-yellow-400 text-xs font-bold">
                            {user?.email?.[0]?.toUpperCase() ?? 'A'}
                        </span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{user?.displayName || 'Admin'}</p>
                        <p className="text-gray-500 text-xs truncate">{user?.email}</p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/')}
                    className="w-full flex items-center gap-2 px-3 py-2 mb-1 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                >
                    <Home className="w-4 h-4" />
                    Voltar ao site
                </button>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                    <LogOut className="w-4 h-4" />
                    Sair
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-screen" style={{ background: '#050505' }}>
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-60 border-r border-white/5 flex-shrink-0">
                <SidebarContent />
            </aside>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                            onClick={() => setSidebarOpen(false)}
                        />
                        <motion.aside
                            initial={{ x: -240 }}
                            animate={{ x: 0 }}
                            exit={{ x: -240 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed left-0 top-0 bottom-0 z-50 w-60 border-r border-white/5 lg:hidden"
                            style={{ background: '#080808' }}
                        >
                            <SidebarContent />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile Top Bar */}
                <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-white/5">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <span className="text-white font-bold text-sm" style={{ fontFamily: 'Cinzel, serif' }}>HuaPlay Admin</span>
                    <button
                        onClick={() => navigate('/')}
                        aria-label="Sair do painel e voltar ao site"
                        title="Voltar ao site"
                        className="ml-auto p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
