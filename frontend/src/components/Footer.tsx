import { Facebook, Twitter, Instagram, Github } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="bg-surface border-t border-gray-800 mt-20 pt-10 pb-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div>
                        <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-neon-blue mb-4">
                            HuaPlay
                        </h3>
                        <p className="text-gray-400 text-sm">
                            Sua plataforma de streaming de séries asiáticas com experiência premium e imersiva.
                        </p>
                    </div>

                    <div>
                        <h4 className="text-white font-semibold mb-4">Navegação</h4>
                        <ul className="space-y-2 text-sm text-gray-400">
                            <li><a href="#" className="hover:text-primary transition-colors">Home</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Séries populares</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Lançamentos</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Minha Lista</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-semibold mb-4">Ajuda</h4>
                        <ul className="space-y-2 text-sm text-gray-400">
                            <li><a href="#" className="hover:text-primary transition-colors">FAQ</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Termos de Uso</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Privacidade</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Contato</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-semibold mb-4">Social</h4>
                        <div className="flex space-x-4">
                            <a href="#" className="text-gray-400 hover:text-primary transition-colors"><Facebook className="w-5 h-5" /></a>
                            <a href="#" className="text-gray-400 hover:text-primary transition-colors"><Twitter className="w-5 h-5" /></a>
                            <a href="#" className="text-gray-400 hover:text-primary transition-colors"><Instagram className="w-5 h-5" /></a>
                            <a href="#" className="text-gray-400 hover:text-primary transition-colors"><Github className="w-5 h-5" /></a>
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
                    <p className="mb-4 max-w-4xl mx-auto opacity-70">
                        O HuaPlay é um projeto exclusivamente acadêmico e funciona como um indexador de links encontrados na web, operando de forma semelhante ao Stremio/Torrent. Não hospedamos nenhum arquivo de vídeo em nossos servidores.
                    </p>
                    © {new Date().getFullYear()} HuaPlay. Todos os direitos reservados.
                </div>
            </div>
        </footer>
    );
}
