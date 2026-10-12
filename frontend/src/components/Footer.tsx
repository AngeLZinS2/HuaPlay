import { Github, Linkedin, Mail, MessageSquareWarning } from 'lucide-react';
import { Link } from 'react-router-dom';

const linkClass = 'text-sm text-gray-400 transition-colors hover:text-primary';

export default function Footer() {
    return (
        <footer className="mt-20 border-t border-white/10 bg-surface pb-28 pt-12 md:pb-8">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <Link to="/" className="inline-flex items-center gap-3">
                            <img src="/Logo Wei.png" alt="HuaPlay" className="h-10 w-10 rounded-full object-cover" />
                            <span className="font-display text-xl font-bold tracking-wider text-primary">HuaPlay</span>
                        </Link>
                        <p className="mt-4 max-w-xs text-sm leading-6 text-gray-400">Catálogo de produções asiáticas com perfis, listas e recomendações personalizadas.</p>
                    </div>

                    <div>
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-white">Navegação</h2>
                        <ul className="space-y-3">
                            <li><Link to="/" className={linkClass}>Início</Link></li>
                            <li><Link to="/explore" className={linkClass}>Explorar</Link></li>
                            <li><Link to="/schedule" className={linkClass}>Cronograma</Link></li>
                            <li><Link to="/my-list" className={linkClass}>Minha lista</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-white">Informações</h2>
                        <ul className="space-y-3">
                            <li><Link to="/faq" className={linkClass}>Perguntas frequentes</Link></li>
                            <li><Link to="/terms" className={linkClass}>Termos de uso</Link></li>
                            <li><Link to="/privacy" className={linkClass}>Privacidade</Link></li>
                            <li><Link to="/copyright" className={linkClass}>Direitos autorais</Link></li>
                            <li><Link to="/contact" className={linkClass}>Contato</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-white">Conecte-se</h2>
                        <div className="flex gap-3">
                            <a href="https://github.com/AngeLZinS2" target="_blank" rel="noreferrer" aria-label="GitHub de Angelo Neri" className="rounded-full border border-white/10 p-3 text-gray-400 transition hover:border-primary/60 hover:text-primary"><Github className="h-5 w-5" /></a>
                            <a href="https://www.linkedin.com/in/angelo-neri-3921a72b9/" target="_blank" rel="noreferrer" aria-label="LinkedIn de Angelo Neri" className="rounded-full border border-white/10 p-3 text-gray-400 transition hover:border-primary/60 hover:text-primary"><Linkedin className="h-5 w-5" /></a>
                            <a href="mailto:angelo.neri@playdb.info" aria-label="E-mail de contato" className="rounded-full border border-white/10 p-3 text-gray-400 transition hover:border-primary/60 hover:text-primary"><Mail className="h-5 w-5" /></a>
                        </div>
                        <a href="mailto:angelo.neri@playdb.info" className="mt-4 block break-all text-sm text-gray-400 hover:text-primary">angelo.neri@playdb.info</a>
                        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('huaplay:open-report'))} className="mt-5 flex items-center gap-2 text-sm text-gray-400 transition hover:text-primary md:hidden">
                            <MessageSquareWarning className="h-4 w-4" /> Reportar um problema
                        </button>
                    </div>
                </div>

                <div className="mt-10 border-t border-white/10 pt-7 text-sm text-gray-500">
                    <p className="max-w-4xl leading-6">O HuaPlay organiza informações e referências disponibilizadas por terceiros. Não hospedamos arquivos de vídeo em nossos servidores. Solicitações fundamentadas de desindexação podem ser enviadas pelo canal de contato.</p>
                    <p className="mt-4">© {new Date().getFullYear()} HuaPlay. Todos os direitos reservados.</p>
                </div>
            </div>
        </footer>
    );
}
