import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface Series {
    id: number;
    title: string;
    description?: string | null;
    release_year: number;
    cover_image?: string | null;
    banner_image?: string | null;
    image?: string | null; // fallback
    banner?: string | null; // fallback
    trailer_url?: string | null;
    cast?: string | null;
    genre?: string | null;
    moods?: string | null;
    [key: string]: any;
}

interface ModalContextType {
    isOpen: boolean;
    content: Series | null;
    openModal: (series: Series) => void;
    closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [content, setContent] = useState<Series | null>(null);

    const openModal = (series: Series) => {
        setContent(series);
        setIsOpen(true);
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    };

    const closeModal = () => {
        setIsOpen(false);
        setContent(null);
        document.body.style.overflow = 'unset';
    };

    return (
        <ModalContext.Provider value={{ isOpen, content, openModal, closeModal }}>
            {children}
        </ModalContext.Provider>
    );
}

export function useModal() {
    const context = useContext(ModalContext);
    if (context === undefined) {
        throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
}
