import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User as UserIcon, ArrowRight } from 'lucide-react';
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
    const { login } = useAuth();

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            if (isLogin) {
                const response = await api.post('/auth/login', { email, password });
                login(response.data.access_token);
                navigate('/profiles');
            } else {
                const response = await api.post('/auth/register', { email, password, full_name: fullName });
                login(response.data.access_token);
                navigate('/profiles');
            }
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || 'Erro ao autenticar. Verifique suas credenciais.');
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
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full bg-gradient-to-r from-primary to-orange-600 text-black font-bold py-4 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2"
                    >
                        {isLogin ? "Entrar" : "Criar Conta"}
                        <ArrowRight className="w-4 h-4" />
                    </motion.button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-400">
                    <p className="cursor-pointer hover:text-white transition-colors" onClick={() => setIsLogin(!isLogin)}>
                        {isLogin ? "Não tem uma conta? Cadastre-se" : "Já tem conta? Entre"}
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
