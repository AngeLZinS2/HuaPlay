import { useLayoutEffect } from 'react';
import type { ReactNode } from 'react';

interface PageTransitionProps {
    children: ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
    useLayoutEffect(() => {
        // Reset only when destination mounts, preserving anchor hash links
        if (!window.location.hash) {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
    }, []);

    return <div className="w-full flex-grow">{children}</div>;
}
