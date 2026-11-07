import { motion, type Variants } from 'framer-motion';
import { useLayoutEffect, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface PageTransitionProps {
    children: ReactNode;
}

const isTouchOrCoarse = () => {
    if (typeof window === 'undefined') return false;
    return (
        window.matchMedia?.('(pointer: coarse)').matches ||
        window.innerWidth < 768 ||
        'ontouchstart' in window
    );
};

// Desktop mantém animação original HEAD y: 20 / y: -20, duration 0.4s
const desktopVariants: Variants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.4, ease: 'easeOut' } },
};

export default function PageTransition({ children }: PageTransitionProps) {
    const [isMobileDevice, setIsMobileDevice] = useState(isTouchOrCoarse);

    useEffect(() => {
        const update = () => setIsMobileDevice(isTouchOrCoarse());
        window.addEventListener('resize', update, { passive: true });
        return () => window.removeEventListener('resize', update);
    }, []);

    useLayoutEffect(() => {
        // Reset only when destination mounts, preserving anchor hash links
        if (!window.location.hash) {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
    }, []);

    if (isMobileDevice) {
        // No telefone/coarse Android: renderiza troca de página direta sem AnimatePresence wait/exit bloqueante
        return <div className="w-full flex-grow">{children}</div>;
    }

    return (
        <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={desktopVariants}
        >
            {children}
        </motion.div>
    );
}
