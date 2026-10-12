import { useState } from 'react';
import { Compass, Heart, Home, Search, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import SearchModal from './SearchModal';

const items = [
    { label: 'Início', href: '/', icon: Home },
    { label: 'Explorar', href: '/explore', icon: Compass },
    { label: 'Minha lista', href: '/my-list', icon: Heart },
    { label: 'Perfil', href: '/profile', icon: User },
];

export default function MobileBottomNav() {
    const location = useLocation();
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    if (['/login', '/profiles'].includes(location.pathname)) {
        return null;
    }

    const isActive = (href: string) => (
        href === '/' ? location.pathname === '/' : location.pathname.startsWith(href)
    );

    return (
        <>
            <nav
                aria-label="Navegação principal mobile"
                className="fixed inset-x-0 bottom-0 z-50 pointer-events-none md:hidden"
            >
                <div className="mx-auto w-full max-w-md px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <div className="relative grid h-[68px] grid-cols-5 items-center rounded-[2rem] border border-white/15 bg-black/60 px-2 shadow-[0_18px_45px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl pointer-events-auto supports-[not_(backdrop-filter:blur(1px))]:bg-neutral-950/95">
                        {items.slice(0, 2).map(({ label, href, icon: Icon }) => {
                            const active = isActive(href);
                            return (
                                <Link
                                    key={href}
                                    to={href}
                                    aria-label={label}
                                    aria-current={active ? 'page' : undefined}
                                    className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${active ? 'text-primary' : 'text-white/55 hover:text-white'}`}
                                >
                                    <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                                    <span className="text-[10px] font-semibold leading-none">{label}</span>
                                </Link>
                            );
                        })}

                        <button
                            type="button"
                            aria-label="Buscar no HuaPlay"
                            onClick={() => setIsSearchOpen(true)}
                            className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl text-primary transition-colors hover:text-yellow-200 active:scale-95"
                        >
                            <Search className="h-5 w-5" strokeWidth={2.5} />
                            <span className="text-[10px] font-semibold leading-none">Buscar</span>
                        </button>

                        {items.slice(2).map(({ label, href, icon: Icon }) => {
                            const active = isActive(href);
                            return (
                                <Link
                                    key={href}
                                    to={href}
                                    aria-label={label}
                                    aria-current={active ? 'page' : undefined}
                                    className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${active ? 'text-primary' : 'text-white/55 hover:text-white'}`}
                                >
                                    <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                                    <span className="text-[10px] font-semibold leading-none">{label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </nav>

            <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </>
    );
}
