import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Series {
    id: number;
    title: string;
    description: string;
    release_year: number;
    cover_image?: string;
    banner_image?: string;
    image?: string; // fallback
    banner?: string; // fallback
    trailer_url?: string;
    cast?: string;
    genre?: string;
    moods?: string;
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
