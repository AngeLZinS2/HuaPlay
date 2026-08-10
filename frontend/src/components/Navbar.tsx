import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, User, Menu, X, ChevronDown, Edit, Repeat, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchModal from './SearchModal';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

const navigation = [
    { name: 'CRONOGRAMA', href: '/schedule' },
    {
        name: 'PROJETOS',
        href: '#',
        dropdown: [
            { name: 'ANIMES', href: '/category/animes' },
            { name: 'DRAMAS', href: '/category/dramas' },
            { name: 'FILMES', href: '/category/filmes' },
            { name: 'MANHUA', href: '/category/manhua' },
            { name: 'NOVELS', href: '/category/novels' },
        ]
    },
    { name: 'EM BREVE', href: '/coming-soon' },
    { name: 'DINASTIA CHINESA', href: '/collection/chinese-dynasty' },
    { name: 'ATRIZES', href: '/actresses' },
    { name: 'ATORES', href: '/actors' },
    {
        name: "TAG'S",
        href: '#',
        dropdown: [
            'AÇÃO / MISTÉRIO', 'AGE GAP', 'COABITAÇÃO', 'CONTRATO',
            'CRIANÇA', 'CROSS-DRESSING', 'ESCOLAR', 'ESCRITÓRIO',
            'ESPORTS / JOGO', 'HISTÓRICO', 'LGBTQIA+', 'MÉDICO',
            'MINIS', 'REPUBLICANO', 'SOBRENATURAL', 'WUXIA'
        ].map(tag => ({ name: tag, href: `/tag/${tag.toLowerCase().replace(/ /g, '-').replace('/', '').replace('+', 'plus')}` }))
    },
];

export default function Navbar() {
    const { isAuthenticated, profiles, currentProfile, selectProfile, logout } = useAuth();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 0);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const location = useLocation();

    // Hide Navbar on specific routes
    if (['/login', '/profiles'].includes(location.pathname)) {
        return null;
    }

    return (
        <nav
            className={`fixed top-0 w-full z-50 transition-colors duration-300 ${isScrolled ? 'bg-background/95 backdrop-blur-sm shadow-md' : 'bg-transparent'
                }`}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20"> {/* Increased height slightly for better spacing */}
                    {/* Logo (Hidden on Desktop if centered, or kept left. User provided image shows logo separate or possibly centered. Keeping simplified text logo for now) */}
                    {/* Assuming existing logo logic. Reference image doesn't show logo, just menu. keeping logo for functionality */}
                    <Link to="/" className="flex items-center gap-3 group mr-8">
                        <img
                            src="/Logo Wei.png"
                            alt="HuaPlay"
                            className="h-10 w-auto object-contain rounded-full shadow-lg group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="flex items-center">
                            <span className="text-lg md:text-xl lg:text-2xl font-display font-bold text-primary tracking-wider">Hua</span>
                            <span className="text-lg md:text-xl lg:text-2xl font-display font-bold text-white tracking-widest ml-1">Play</span>
                        </div>
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center space-x-2 lg:space-x-6 flex-1 justify-center">
                        {navigation.map((item) => (
                            <div
                                key={item.name}
                                className="relative group"
                                onMouseEnter={() => setActiveDropdown(item.name)}
                                onMouseLeave={() => setActiveDropdown(null)}
                            >
                                <Link
                                    to={item.href}
                                    className="flex items-center gap-1 text-[10px] lg:text-sm font-semibold tracking-wide text-gray-300 hover:text-primary transition-colors py-2 uppercase whitespace-nowrap"
                                >
                                    {item.name}
                                    {item.dropdown && <ChevronDown className="w-3 h-3 lg:w-4 lg:h-4" />}
                                </Link>

                                {/* Dropdown */}
                                <AnimatePresence>
                                    {item.dropdown && activeDropdown === item.name && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, height: 0 }}
                                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                                            exit={{ opacity: 0, y: 10, height: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="absolute top-full left-0 mt-0 w-48 bg-white text-gray-900 rounded-sm shadow-xl overflow-hidden z-50"
                                        >
                                            <div className="py-2 flex flex-col">
                                                {item.dropdown.map((subItem: any) => (
                                                    <Link
                                                        key={subItem.name}
                                                        to={subItem.href}
                                                        className="px-4 py-3 text-sm font-medium hover:bg-gray-100 flex justify-between items-center group/item transition-colors"
                                                    >
                                                        {subItem.name}
                                                        <span className="opacity-0 group-hover/item:opacity-100 transition-opacity text-primary">›</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>

                    {/* Icons */}
                    <div className="hidden md:flex items-center space-x-3">
                        <LanguageSwitcher />
                        <button
                            className="text-gray-300 hover:text-white transition-colors"
                            onClick={() => setIsSearchOpen(true)}
                        >
                            <Search className="w-5 h-5" />
                        </button>
                        {/* User Profile Dropdown */}
                        {isAuthenticated ? (
                            <div
                                className="relative ml-4 z-50"
                                onMouseEnter={() => setActiveDropdown('profile')}
                                onMouseLeave={() => setActiveDropdown(null)}
                            >
                                <div className="flex items-center gap-2 cursor-pointer py-2">
                                    <div className={`w-8 h-8 rounded-md overflow-hidden border transition-colors ${activeDropdown === 'profile' ? 'border-white' : 'border-transparent'}`}>
                                        <img
                                            src={currentProfile?.avatar_url || "https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-qo9h82134t9nv0j0.jpg"}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-white transition-transform duration-300 ${activeDropdown === 'profile' ? 'rotate-180' : ''}`} />
                                </div>

                                {/* Dropdown Menu */}
                                <AnimatePresence>
                                    {activeDropdown === 'profile' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            transition={{ duration: 0.2, ease: "easeOut" }}
                                            className="absolute right-0 top-full pt-2 w-56"
                                        >
                                            {/* Up Arrow */}
                                            <div className="flex justify-end pr-3 mb-[-1px]">
                                                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-white/10"></div>
                                            </div>

                                            <div className="bg-black/95 border border-white/10 rounded-sm shadow-2xl overflow-hidden backdrop-blur-sm">
                                                {/* Other Profiles */}
                                                <div className="p-3 flex flex-col gap-3">
                                                    {profiles.filter(p => p.id !== currentProfile?.id).map(profile => (
                                                        <div
                                                            key={profile.id}
                                                            onClick={() => selectProfile(profile)}
                                                            className="flex items-center gap-3 cursor-pointer group/item"
                                                        >
                                                            <img
                                                                src={profile.avatar_url || "https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-qo9h82134t9nv0j0.jpg"}
                                                                alt={profile.name}
                                                                className="w-8 h-8 rounded-md object-cover opacity-80 group-hover/item:opacity-100"
                                                            />
                                                            <span className="text-sm text-gray-300 group-hover/item:text-white group-hover/item:underline transition-colors">{profile.name}</span>
                                                        </div>
                                                    ))}
                                                    <Link to="/profiles" className="flex items-center gap-3 mt-1 text-sm text-gray-300 hover:text-white hover:underline transition-colors pt-2 border-t border-white/10">
                                                        <Edit className="w-4 h-4" />
                                                        Gerenciar perfis
                                                    </Link>
                                                    <div className="flex items-center gap-3 text-sm text-gray-300 hover:text-white hover:underline transition-colors cursor-not-allowed opacity-50">
                                                        <Repeat className="w-4 h-4" />
                                                        Transferir perfil
                                                    </div>
                                                    <Link to="/profile" className="flex items-center gap-3 text-sm text-gray-300 hover:text-white hover:underline transition-colors">
                                                        <User className="w-4 h-4" />
                                                        Conta
                                                    </Link>
                                                    <div className="flex items-center gap-3 text-sm text-gray-300 hover:text-white hover:underline transition-colors cursor-not-allowed opacity-50">
                                                        <HelpCircle className="w-4 h-4" />
                                                        Central de Ajuda
                                                    </div>
                                                </div>

                                                {/* Logout */}
                                                <div className="border-t border-white/10 p-3">
                                                    <button
                                                        onClick={() => {
                                                            logout();
                                                            window.location.href = '/login';
                                                        }}
                                                        className="w-full text-center text-xs font-semibold text-white hover:underline"
                                                    >
                                                        Sair da HuaPlay
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <Link
                                to="/login"
                                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors ml-2"
                            >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-purple-600 p-[1px]">
                                    <div className="w-full h-full rounded-full bg-surface flex items-center justify-center">
                                        <User className="w-4 h-4" />
                                    </div>
                                </div>
                            </Link>
                        )}
                    </div>

                    {/* Mobile Icons & Menu */}
                    <div className="md:hidden flex items-center gap-4">
                        <button
                            className="text-gray-300 hover:text-white transition-colors"
                            onClick={() => setIsSearchOpen(true)}
                        >
                            <Search className="w-5 h-5" />
                        </button>

                        {isAuthenticated ? (
                            <div className="relative z-50">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'mobile-profile' ? null : 'mobile-profile')}
                                    className="flex items-center gap-2"
                                >
                                    <div className={`w-8 h-8 rounded-md overflow-hidden border transition-colors ${activeDropdown === 'mobile-profile' ? 'border-white' : 'border-transparent'}`}>
                                        <img
                                            src={currentProfile?.avatar_url || "https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-qo9h82134t9nv0j0.jpg"}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                </button>

                                <AnimatePresence>
                                    {activeDropdown === 'mobile-profile' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute right-0 top-full pt-2 w-56"
                                        >
                                            <div className="bg-[#141414] border border-white/10 rounded-sm shadow-2xl overflow-hidden">
                                                <div className="p-3 flex flex-col gap-3">
                                                    {profiles.filter(p => p.id !== currentProfile?.id).map(profile => (
                                                        <div
                                                            key={profile.id}
                                                            onClick={() => {
                                                                selectProfile(profile);
                                                                setActiveDropdown(null);
                                                            }}
                                                            className="flex items-center gap-3 cursor-pointer group/item"
                                                        >
                                                            <img
                                                                src={profile.avatar_url}
                                                                alt={profile.name}
                                                                className="w-7 h-7 rounded-md object-cover opacity-80"
                                                            />
                                                            <span className="text-sm text-gray-300 group-hover/item:text-white">{profile.name}</span>
                                                        </div>
                                                    ))}
                                                    <Link to="/profiles" className="flex items-center gap-3 mt-1 text-sm text-gray-300 hover:text-white pt-2 border-t border-white/10">
                                                        <Edit className="w-4 h-4" />
                                                        Gerenciar perfis
                                                    </Link>
                                                    <Link to="/profile" className="flex items-center gap-3 text-sm text-gray-300 hover:text-white">
                                                        <User className="w-4 h-4" />
                                                        Conta
                                                    </Link>
                                                </div>
                                                <div className="border-t border-white/10 p-3">
                                                    <button
                                                        onClick={() => {
                                                            logout();
                                                            window.location.href = '/login';
                                                        }}
                                                        className="w-full text-center text-xs font-semibold text-white hover:underline"
                                                    >
                                                        Sair da HuaPlay
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <Link to="/login" className="text-gray-300 hover:text-white">
                                <User className="w-6 h-6" />
                            </Link>
                        )}

                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="text-gray-300 hover:text-white"
                        >
                            {isMobileMenuOpen ? <X /> : <Menu />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-0 z-40 md:hidden bg-black/95 backdrop-blur-xl h-[100dvh] overflow-y-auto"
                    >
                        <div className="flex flex-col pt-6 px-6 space-y-6 pb-32">
                            <div className="flex justify-between items-center mb-8">
                                <span className="text-xl font-display font-bold text-primary">MENU</span>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 border border-white/20 rounded-full text-white hover:bg-white/10"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            {navigation.map((item, idx) => (
                                <motion.div
                                    key={item.name}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 + idx * 0.05 }}
                                >
                                    <Link
                                        to={item.href}
                                        className="text-2xl font-display font-bold text-white hover:text-primary transition-colors block mb-2"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        {item.name}
                                    </Link>

                                    {item.dropdown && (
                                        <div className="grid grid-cols-2 gap-3 pl-4 border-l border-white/10 mt-2">
                                            {item.dropdown.map((subItem: any) => (
                                                <Link
                                                    key={subItem.name}
                                                    to={subItem.href}
                                                    className="text-sm text-gray-400 hover:text-white transition-colors py-1"
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                >
                                                    {subItem.name}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                            <div className="pt-6 border-t border-white/10 flex gap-4">
                                <Link to="/login" className="px-6 py-2 border border-white/20 rounded-full text-white hover:bg-white hover:text-black transition-all">
                                    Login
                                </Link>
                                <Link to="/register" className="px-6 py-2 bg-primary text-black font-bold rounded-full hover:brightness-110 transition-all">
                                    Cadastrar
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <SearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
            />
        </nav>
    );
}
