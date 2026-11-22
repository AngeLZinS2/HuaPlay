import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SeriesCard from './SeriesCard';

interface SeriesRowProps {
    title: string;
    series: any[];
    onOpenModal: (series: any) => void;
    eager?: boolean;
}

type RowCallback = () => void;
let sharedRowObserver: IntersectionObserver | null = null;
const rowListeners = new Map<Element, RowCallback>();

function getSharedRowObserver(): IntersectionObserver | null {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
        return null;
    }
    if (!sharedRowObserver) {
        sharedRowObserver = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        const cb = rowListeners.get(entry.target);
                        if (cb) {
                            cb();
                            sharedRowObserver?.unobserve(entry.target);
                            rowListeners.delete(entry.target);
                        }
                    }
                }
            },
            { rootMargin: '350px 0px' }
        );
    }
    return sharedRowObserver;
}

export default function SeriesRow({ title, series, onOpenModal, eager = false }: SeriesRowProps) {
    const sectionRef = useRef<HTMLDivElement>(null);
    const rowRef = useRef<HTMLDivElement>(null);
    const [isMoved, setIsMoved] = useState(false);
    const [shouldRenderCards, setShouldRenderCards] = useState<boolean>(eager);

    useEffect(() => {
        if (shouldRenderCards) return;
        const el = sectionRef.current;
        const observer = getSharedRowObserver();
        if (!el || !observer) {
            setShouldRenderCards(true);
            return;
        }
        const onVisible = () => setShouldRenderCards(true);
        rowListeners.set(el, onVisible);
        observer.observe(el);
        return () => {
            observer.unobserve(el);
            rowListeners.delete(el);
        };
    }, [shouldRenderCards]);

    const handleClick = (direction: 'left' | 'right') => {
        setIsMoved(true);
        if (rowRef.current) {
            const { scrollLeft, clientWidth } = rowRef.current;
            const scrollTo = direction === 'left'
                ? scrollLeft - clientWidth
                : scrollLeft + clientWidth;

            rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
        }
    };

    return (
        <section
            ref={sectionRef}
            className="space-y-2 md:space-y-4 mb-3 md:mb-8 group px-4 sm:px-6 lg:px-8"
            style={{ contentVisibility: 'auto', containIntrinsicSize: '270px' }}
        >
            <h2 className="text-lg md:text-xl font-semibold text-white transition-colors group-hover:text-primary">
                {title}
            </h2>

            <div className="relative group/row">
                <button
                    type="button"
                    aria-label={`Rolar ${title} para a esquerda`}
                    className={`absolute top-0 bottom-0 left-0 z-50 w-12 bg-black/50 h-full flex items-center justify-center cursor-pointer opacity-0 group-hover/row:opacity-100 transition duration-300 hover:bg-black/70 ${!isMoved && "hidden"}`}
                    onClick={() => handleClick("left")}
                >
                    <ChevronLeft className="h-8 w-8 text-white" />
                </button>

                <div
                    ref={rowRef}
                    className="flex items-center space-x-2.5 overflow-x-scroll scrollbar-hide md:space-x-3.5 py-2 md:pb-20 md:pt-16 pl-4 min-h-[226px] md:min-h-[444px]"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {shouldRenderCards ? (
                        series.map((item, index) => (
                            <SeriesCard
                                key={item.id}
                                item={item}
                                onOpenModal={onOpenModal}
                                isFirst={index === 0}
                                isLast={index === series.length - 1}
                            />
                        ))
                    ) : (
                        Array.from({ length: Math.min(6, series.length) }).map((_, i) => (
                            <div
                                key={i}
                                className="flex-none w-[140px] md:w-[200px] h-[210px] md:h-[300px] rounded-md bg-white/[0.04]"
                            />
                        ))
                    )}
                </div>

                <button
                    type="button"
                    aria-label={`Rolar ${title} para a direita`}
                    className="absolute top-0 bottom-0 right-0 z-50 w-12 bg-black/50 h-full flex items-center justify-center cursor-pointer opacity-0 group-hover/row:opacity-100 transition duration-300 hover:bg-black/70"
                    onClick={() => handleClick("right")}
                >
                    <ChevronRight className="h-8 w-8 text-white" />
                </button>
            </div>
        </section>
    );
}
