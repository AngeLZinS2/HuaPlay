import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SeriesCard from './SeriesCard';

interface SeriesRowProps {
    title: string;
    series: any[];
    onOpenModal: (series: any) => void;
}

export default function SeriesRow({ title, series, onOpenModal }: SeriesRowProps) {
    const rowRef = useRef<HTMLDivElement>(null);
    const [isMoved, setIsMoved] = useState(false);

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
        <div className="space-y-2 md:space-y-4 mb-8 group px-4 sm:px-6 lg:px-8">
            <h2 className="text-lg md:text-xl font-semibold text-white transition-colors group-hover:text-primary">
                {title}
            </h2>

            <div className="relative group/row">
                <div
                    className={`absolute top-0 bottom-0 left-0 z-50 w-12 bg-black/50 h-full flex items-center justify-center cursor-pointer opacity-0 group-hover/row:opacity-100 transition duration-300 hover:bg-black/70 ${!isMoved && "hidden"}`}
                    onClick={() => handleClick("left")}
                >
                    <ChevronLeft className="h-8 w-8 text-white" />
                </div>

                <div
                    ref={rowRef}
                    className="flex items-center space-x-2.5 overflow-x-scroll scrollbar-hide md:space-x-3.5 pb-10 pt-8 md:pb-20 md:pt-16 pl-4"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {series.map((item, index) => (
                        <SeriesCard
                            key={item.id}
                            item={item}
                            onOpenModal={onOpenModal}
                            isFirst={index === 0}
                            isLast={index === series.length - 1}
                        />
                    ))}
                </div>

                <div
                    className="absolute top-0 bottom-0 right-0 z-50 w-12 bg-black/50 h-full flex items-center justify-center cursor-pointer opacity-0 group-hover/row:opacity-100 transition duration-300 hover:bg-black/70"
                    onClick={() => handleClick("right")}
                >
                    <ChevronRight className="h-8 w-8 text-white" />
                </div>
            </div>
        </div>
    );
}
