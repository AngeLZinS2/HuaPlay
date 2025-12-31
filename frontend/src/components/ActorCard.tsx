import type { Actor } from '../types';

interface ActorCardProps {
    actor: Actor;
}

export default function ActorCard({ actor }: ActorCardProps) {
    return (
        <div className="relative group flex flex-col items-center">
            {/* Name Tag */}


            {/* Image Container */}
            <div className="w-full aspect-[3/4] overflow-hidden border-4 border-[#202020] bg-[#202020]">
                <img
                    src={actor.image_url || "https://via.placeholder.com/300x400?text=No+Image"}
                    alt={actor.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
            </div>

            {/* Diamond Icon (Decorative) */}
            <div className="mt-2 text-blue-500 text-xs">
                ✦
            </div>
        </div>
    );
}
