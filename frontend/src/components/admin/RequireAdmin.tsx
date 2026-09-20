import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Gate for every /admin route.
 *
 * Note the two failure modes are deliberately different: an anonymous visitor is
 * sent to /login, while a signed-in non-admin gets a 403 screen. Redirecting the
 * latter to /login would be a dead end — they already have a valid session, so
 * logging in again changes nothing.
 */
export default function RequireAdmin({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading, isAdmin, user } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black px-6">
                <div className="max-w-md text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
                        <ShieldAlert className="w-7 h-7 text-red-400" />
                    </div>
                    <h1 className="text-xl font-bold text-white">Acesso restrito</h1>
                    <p className="text-sm text-gray-400">
                        Esta área é exclusiva para administradores. Sua conta
                        {user?.email ? ` (${user.email})` : ''} não tem essa permissão.
                    </p>
                    <a
                        href="/"
                        className="inline-block px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:text-white hover:border-white/30 transition-all"
                    >
                        Voltar ao início
                    </a>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
