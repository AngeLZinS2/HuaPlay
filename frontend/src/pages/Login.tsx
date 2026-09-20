import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User as UserIcon, ArrowRight } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState(''); // Added state for full name
    const [error, setError] = useState('');
    const [banners, setBanners] = useState<string[]>([]);
    const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
    const navigate = useNavigate();
    const { signInWithEmail, registerWithEmail, signInWithGoogle } = useAuth();
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const fetchBanners = async () => {
            try {
                const response = await api.get('/series/?limit=100');
                const validBanners = (response.data || [])
                    .map((s: any) => s.banner_image)
                    .filter((b: string) => b && (b.includes('image.tmdb.org') || b.includes('unsplash.com') || b.startsWith('http')) && !b.includes('tvtime.com'));

                if (validBanners.length > 0) {
                    setBanners(validBanners);
                }
            } catch (err) {
                console.error("Failed to load background banners", err);
            }
        };

        fetchBanners();
    }, []);

    useEffect(() => {
        if (banners.length === 0) return;

        const interval = setInterval(() => {
            setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
        }, 6000);

        return () => clearInterval(interval);
    }, [banners]);

    /** Firebase error codes are stable identifiers; map them to plain Portuguese. */
    const describeError = (err: unknown): string => {
        if (err instanceof FirebaseError) {
            switch (err.code) {
                case 'auth/invalid-credential':
                case 'auth/wrong-password':
                case 'auth/user-not-found':
                    return 'E-mail ou senha incorretos.';
                case 'auth/email-already-in-use':
                    return 'Este e-mail já tem uma conta. Tente entrar.';
                case 'auth/weak-password':
                    return 'A senha precisa ter ao menos 6 caracteres.';
                case 'auth/invalid-email':
                    return 'E-mail inválido.';
                case 'auth/popup-closed-by-user':
                case 'auth/cancelled-popup-request':
                    return '';
                case 'auth/popup-blocked':
                    return 'O navegador bloqueou a janela do Google. Libere os pop-ups e tente de novo.';
                case 'auth/unauthorized-domain':
                    return 'Este domínio não está autorizado no Firebase Authentication.';
                case 'auth/too-many-requests':
                    return 'Muitas tentativas. Aguarde um momento e tente novamente.';
                case 'auth/network-request-failed':
                    return 'Falha de rede ao contatar o Firebase.';
            }
        }
        console.error(err);
        // Surface the real code instead of a generic message: without it there is
        // nothing to act on, for the user or for whoever reads the report.
        if (err instanceof FirebaseError) {
            return `Falha na autenticação (${err.code}). ${err.message}`;
        }
        if (err instanceof Error) {
            return `Falha na autenticação: ${err.message}`;
        }
        return 'Erro ao autenticar. Tente novamente.';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            if (isLogin) {
                await signInWithEmail(email, password);
            } else {
                await registerWithEmail(email, password, fullName);
            }
            navigate('/profiles');
        } catch (err) {
            setError(describeError(err));
        } finally {
            setBusy(false);
        }
    };

    const handleGoogle = async () => {
        setError('');
        setBusy(true);
        try {
            await signInWithGoogle();
            navigate('/profiles');
        } catch (err) {
            setError(describeError(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
            {/* Background Slideshow */}
            <div className="absolute inset-0 z-0">
                <AnimatePresence>
                    {banners.length > 0 && (
                        <motion.div
                            key={currentBannerIndex}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 2.5, ease: "easeInOut" }}
                            className="absolute inset-0"
                        >
                            <img
                                src={banners[currentBannerIndex]}
                                alt=""
                                onError={() => setCurrentBannerIndex((prev) => (prev + 1) % banners.length)}
                                className="w-full h-full object-cover"
                            />
                            {/* Overlay gradient for readability */}
                            <div className="absolute inset-0 bg-black/60" />
                        </motion.div>
                    )}
                </AnimatePresence>
                {/* Fallback pattern if no banners */}
                {banners.length === 0 && (
                    <>
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-primary/20" />
                        <div className="absolute -top-20 -left-20 w-80 h-80 bg-primary/30 rounded-full blur-[100px]" />
                        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-neon-blue/30 rounded-full blur-[100px]" />
                    </>
                )}
            </div>

            <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md bg-black/60 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl relative z-10 mx-4"
            >
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold inline-block mb-2">
                        <span className="text-primary">Hua</span>
                        <span className="text-white">Play</span>
                    </h1>
                    <p className="text-gray-400">
                        {isLogin ? "Bem-vindo de volta!" : "Junte-se a nós"}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <AnimatePresence mode="popLayout">
                        {!isLogin && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="relative">
                                    <UserIcon className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        placeholder="Nome Completo"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all duration-300"
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="relative">
                        <Mail className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all duration-300"
                        />
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                        <input
                            type="password"
                            placeholder="Senha"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all duration-300"
                        />
                    </div>

                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                    <motion.button
                        whileHover={{ scale: busy ? 1 : 1.02 }}
                        whileTap={{ scale: busy ? 1 : 0.98 }}
                        disabled={busy}
                        className="w-full bg-gradient-to-r from-primary to-orange-600 text-black font-bold py-4 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {busy ? 'Aguarde…' : isLogin ? 'Entrar' : 'Criar Conta'}
                        <ArrowRight className="w-4 h-4" />
                    </motion.button>
                </form>

                <div className="flex items-center gap-3 my-5">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-[11px] uppercase tracking-wider text-gray-500">ou</span>
                    <div className="h-px flex-1 bg-white/10" />
                </div>

                <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-semibold py-3.5 rounded-xl hover:bg-gray-100 transition-all disabled:opacity-60"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
                    </svg>
                    Continuar com Google
                </button>

                <div className="mt-6 text-center text-sm text-gray-400">
                    <p className="cursor-pointer hover:text-white transition-colors" onClick={() => setIsLogin(!isLogin)}>
                        {isLogin ? "Não tem uma conta? Cadastre-se" : "Já tem conta? Entre"}
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
