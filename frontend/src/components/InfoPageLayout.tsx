import type { ReactNode } from 'react';

interface InfoPageLayoutProps {
    eyebrow: string;
    title: string;
    intro: string;
    children: ReactNode;
}

export default function InfoPageLayout({ eyebrow, title, intro, children }: InfoPageLayoutProps) {
    return (
        <div className="mx-auto w-full max-w-4xl px-5 pb-10 pt-32 sm:px-8 md:pt-36">
            <header className="mb-10 border-b border-white/10 pb-8">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-primary">{eyebrow}</p>
                <h1 className="font-display text-3xl font-bold leading-tight text-white sm:text-5xl">{title}</h1>
                <p className="mt-5 max-w-3xl text-base leading-7 text-gray-400 sm:text-lg">{intro}</p>
            </header>
            <article className="space-y-9 text-gray-300 [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-white [&_li]:leading-7 [&_p]:leading-7 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                {children}
            </article>
        </div>
    );
}
