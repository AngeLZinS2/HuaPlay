import { useState } from 'react';
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
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            if (isLogin) {
                const response = await api.post('/auth/login', { email, password });
                login(response.data.access_token);
                navigate('/');
            } else {
                const response = await api.post('/auth/register', { email, password, full_name: fullName }); // Send full_name
                login(response.data.access_token);
                navigate('/');
            }
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || 'Erro ao autenticar. Verifique suas credenciais.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-primary/20" />
            <div className="absolute -top-20 -left-20 w-80 h-80 bg-primary/30 rounded-full blur-[100px]" />
            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-neon-blue/30 rounded-full blur-[100px]" />

            <motion.div
                layout
                className="w-full max-w-md bg-surface/50 backdrop-blur-xl p-8 rounded-2xl border border-white/10 shadow-2xl relative z-10 mx-4"
            >
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-neon-blue inline-block mb-2">
                        HuaPlay
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
                                        className="w-full bg-black/50 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-primary transition-colors"
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
                            className="w-full bg-black/50 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                        <input
                            type="password"
                            placeholder="Senha"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-black/50 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>

                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full bg-gradient-to-r from-primary to-red-600 text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-primary/50 transition-all flex items-center justify-center gap-2"
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
