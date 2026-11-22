import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    addToast: (message: string, type: ToastType) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const addToast = useCallback((message: string, type: ToastType) => {
        const id = Math.random().toString(36).slice(2, 11);
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto remove after 3 seconds
        setTimeout(() => {
            removeToast(id);
        }, 3000);
    }, [removeToast]);

    const value = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            {toasts.length > 0 && (
                <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
                    {toasts.map((toast) => (
                        <div
                            key={toast.id}
                            role="status"
                            className={`min-w-[300px] p-4 rounded-lg shadow-lg border flex items-center gap-3 animate-[slideUp_0.2s_ease-out] ${toast.type === 'success' ? 'bg-black/90 border-green-500/50 text-white' :
                                    toast.type === 'error' ? 'bg-black/90 border-red-500/50 text-white' :
                                        'bg-black/90 border-blue-500/50 text-white'
                                }`}
                        >
                            <div className={`p-1 rounded-full ${toast.type === 'success' ? 'bg-green-500/20' :
                                    toast.type === 'error' ? 'bg-red-500/20' :
                                        'bg-blue-500/20'
                                }`}>
                                {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                                {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                {toast.type === 'info' && <Info className="w-4 h-4 text-blue-500" />}
                            </div>
                            <p className="flex-1 text-sm font-medium">{toast.message}</p>
                            <button
                                type="button"
                                aria-label="Fechar aviso"
                                onClick={() => removeToast(toast.id)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </ToastContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
