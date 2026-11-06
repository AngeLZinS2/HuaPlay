import type { ReactNode } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';

export function AdminPage({ eyebrow, title, description, action, children }: { eyebrow: string; title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return <div className="mx-auto max-w-7xl p-5 sm:p-7 lg:p-9">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs uppercase tracking-[.2em] text-yellow-500">{eyebrow}</p><h1 className="text-2xl font-bold text-white sm:text-3xl" style={{ fontFamily: 'Cinzel, serif' }}>{title}</h1><p className="mt-2 max-w-2xl text-sm text-gray-500">{description}</p></div>{action}</div>
    {children}
  </div>;
}

export function LoadingState() { return <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/[.07] bg-[#0d0d0d] p-12 text-sm text-gray-500"><LoaderCircle className="h-4 w-4 animate-spin"/>Carregando…</div>; }
export function ErrorState({ message = 'Não foi possível carregar esta área agora.' }: { message?: string }) { return <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300"><AlertCircle className="h-5 w-5"/>{message}</div>; }
export const inputClass = 'w-full rounded-xl border border-white/10 bg-[#090909] px-3 py-2.5 text-sm text-white outline-none transition focus:border-yellow-500/50';
export const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50';
