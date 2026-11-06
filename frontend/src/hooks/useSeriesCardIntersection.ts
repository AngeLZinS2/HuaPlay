import { useEffect, useRef, useState } from 'react';

type IntersectionCallback = (isIntersecting: boolean) => void;

let sharedObserver: IntersectionObserver | null = null;
const listeners = new Map<Element, IntersectionCallback>();

function getSharedObserver(): IntersectionObserver | null {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
        return null;
    }
    if (!sharedObserver) {
        sharedObserver = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        const target = entry.target;
                        const callback = listeners.get(target);
                        if (callback) {
                            callback(true);
                        }
                    }
                }
            },
            {
                root: null,
                rootMargin: '200px',
            }
        );
    }
    return sharedObserver;
}

export function useSeriesCardIntersection<T extends HTMLElement = HTMLDivElement>() {
    const ref = useRef<T | null>(null);
    const [isVisible, setIsVisible] = useState<boolean>(() => {
        if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
            return true;
        }
        return false;
    });

    useEffect(() => {
        if (isVisible) return;

        const element = ref.current;
        if (!element) return;

        const observer = getSharedObserver();
        if (!observer) {
            return;
        }

        const handleIntersect: IntersectionCallback = (isIntersecting) => {
            if (isIntersecting) {
                setIsVisible(true);
                observer.unobserve(element);
                listeners.delete(element);
            }
        };

        listeners.set(element, handleIntersect);
        observer.observe(element);

        return () => {
            observer.unobserve(element);
            listeners.delete(element);
        };
    }, [isVisible]);

    return { ref, isVisible, setIsVisible };
}

export default useSeriesCardIntersection;
