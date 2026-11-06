import { motion } from 'framer-motion';
import { useLayoutEffect } from 'react';
import type { ReactNode } from 'react';

interface PageTransitionProps {
    children: ReactNode;
}

const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
};

export default function PageTransition({ children }: PageTransitionProps) {
    useLayoutEffect(() => {
        // Reset only when the destination mounts, after the previous page exits.
        // Let links with a fragment keep their intended anchor position.
        if (!window.location.hash) {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
    }, []);

    return (
        <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={pageVariants}
            transition={{ duration: 0.4, ease: "easeOut" }}
        >
            {children}
        </motion.div>
    );
}
