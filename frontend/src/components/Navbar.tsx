import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, User, Menu, X, ChevronDown, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchModal from './SearchModal';

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
                            src="/Logo Wei.jpg"
                            alt="WEI Fansub"
                            className="h-10 w-auto object-contain rounded-full shadow-lg group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="flex items-center">
                            <span className="text-2xl font-display font-bold text-primary tracking-wider">WEI</span>
                            <span className="text-2xl font-display font-bold text-white tracking-widest ml-2">FANSUB</span>
                        </div>
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center space-x-6 flex-1 justify-center">
                        {navigation.map((item) => (
                            <div
                                key={item.name}
                                className="relative group"
                                onMouseEnter={() => setActiveDropdown(item.name)}
                                onMouseLeave={() => setActiveDropdown(null)}
                            >
                                <Link
                                    to={item.href}
                                    className="flex items-center gap-1 text-sm font-semibold tracking-wide text-gray-300 hover:text-primary transition-colors py-2 uppercase"
                                >
                                    {item.name}
                                    {item.dropdown && <ChevronDown className="w-4 h-4" />}
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
                                                        {/* Optional arrow for sub-items if desired, user image had small arrow */}
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
                    <div className="hidden md:flex items-center space-x-5">
                        <button className="text-primary hover:text-white transition-colors">
                            <Moon className="w-5 h-5" />
                        </button>
                        <button
                            className="text-gray-300 hover:text-white transition-colors"
                            onClick={() => setIsSearchOpen(true)}
                        >
                            <Search className="w-5 h-5" />
                        </button>
                        {/* Optional: Keep User Profile if user wants login access */}
                        <Link to="/profile" className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors ml-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-purple-600 p-[1px]">
                                <div className="w-full h-full rounded-full bg-surface flex items-center justify-center">
                                    <User className="w-4 h-4" />
                                </div>
                            </div>
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="text-gray-300 hover:text-white"
                        >
                            {isMobileMenuOpen ? <X /> : <Menu />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu (Simplified for now, can expand later) */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="md:hidden bg-surface border-t border-gray-800"
                    >
                        <div className="px-4 pt-2 pb-4 space-y-1 h-[80vh] overflow-y-auto">
                            {navigation.map((item) => (
                                <div key={item.name}>
                                    <Link to={item.href} className="block px-3 py-2 text-base font-bold text-white hover:bg-gray-800 rounded-md">
                                        {item.name}
                                    </Link>
                                    {item.dropdown && (
                                        <div className="pl-6 space-y-1 border-l-2 border-gray-800 ml-3">
                                            {item.dropdown.map((subItem: any) => (
                                                <Link
                                                    key={subItem.name}
                                                    to={subItem.href}
                                                    className="block px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-md"
                                                >
                                                    {subItem.name}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
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
