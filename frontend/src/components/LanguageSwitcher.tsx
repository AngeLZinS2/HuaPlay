import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown, Check } from 'lucide-react';

const LANGUAGES = [
    { code: 'pt-BR', label: 'Português', flag: '🇧🇷', short: 'PT' },
    { code: 'en-US', label: 'English',   flag: '🇺🇸', short: 'EN' },
    { code: 'es-ES', label: 'Español',   flag: '🇪🇸', short: 'ES' },
];

export default function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const current = LANGUAGES.find((l) => l.code === i18n.language)
        ?? LANGUAGES.find((l) => l.code === 'pt-BR')!;

    const switchLang = (code: string) => {
        i18n.changeLanguage(code);
        localStorage.setItem('huaplay_lang', code);
        setOpen(false);
    };

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all text-sm text-gray-400 hover:text-white"
            >
                <Globe className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">{current.flag} {current.short}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-white/10 shadow-2xl shadow-black overflow-hidden z-50"
                        style={{ background: '#0d0d0d' }}
                    >
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => switchLang(lang.code)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                                    lang.code === i18n.language
                                        ? 'text-yellow-400 bg-yellow-400/10'
                                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <span className="text-base">{lang.flag}</span>
                                <span className="flex-1 text-left font-medium">{lang.label}</span>
                                {lang.code === i18n.language && <Check className="w-3.5 h-3.5 text-yellow-400" />}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
