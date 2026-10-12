import { type FormEvent, useState } from 'react';
import { CheckCircle2, Loader2, Mail, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import InfoPageLayout from '../components/InfoPageLayout';

type Status = 'idle' | 'sending' | 'success' | 'error';

export default function Contact() {
    const [status, setStatus] = useState<Status>('idle');

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setStatus('sending');
        const form = event.currentTarget;
        const data = Object.fromEntries(new FormData(form).entries());

        try {
            const response = await fetch('https://formsubmit.co/ajax/angelo.neri@playdb.info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ ...data, _subject: `[HuaPlay] ${data.assunto}`, _template: 'table' }),
            });
            if (!response.ok) throw new Error('Falha ao enviar');
            form.reset();
            setStatus('success');
        } catch {
            setStatus('error');
        }
    };

    const fieldClass = 'mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-primary/70 focus:ring-2 focus:ring-primary/10';

    return (
        <InfoPageLayout eyebrow="Fale conosco" title="Contato" intro="Envie dúvidas, sugestões, solicitações de privacidade ou notificações de direitos autorais.">
            <div className="grid gap-8 md:grid-cols-[1fr_1.7fr]">
                <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                    <Mail className="h-6 w-6 text-primary" />
                    <h2 className="mt-4 text-lg">Contato direto</h2>
                    <p className="mt-3 text-sm text-gray-400">Você também pode escrever diretamente para:</p>
                    <a href="mailto:angelo.neri@playdb.info" className="mt-3 block break-all text-sm">angelo.neri@playdb.info</a>
                    <p className="mt-6 text-xs text-gray-500">Os dados enviados serão usados para responder e documentar sua solicitação conforme a Política de Privacidade.</p>
                </aside>

                <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
                    <div><label htmlFor="nome" className="text-sm font-medium text-white">Nome</label><input id="nome" name="nome" required maxLength={100} className={fieldClass} autoComplete="name" /></div>
                    <div><label htmlFor="email" className="text-sm font-medium text-white">E-mail</label><input id="email" name="email" type="email" required maxLength={160} className={fieldClass} autoComplete="email" /></div>
                    <div>
                        <label htmlFor="assunto" className="text-sm font-medium text-white">Assunto</label>
                        <select id="assunto" name="assunto" required className={fieldClass} defaultValue="">
                            <option value="" disabled>Selecione</option><option>Suporte técnico</option><option>Sugestão</option><option>Privacidade e dados pessoais</option><option>Direitos autorais</option><option>Outro assunto</option>
                        </select>
                    </div>
                    <div><label htmlFor="url" className="text-sm font-medium text-white">URL relacionada <span className="text-gray-500">(opcional)</span></label><input id="url" name="url_relacionada" type="url" maxLength={500} className={fieldClass} placeholder="https://..." /></div>
                    <div><label htmlFor="mensagem" className="text-sm font-medium text-white">Mensagem</label><textarea id="mensagem" name="mensagem" required minLength={20} maxLength={5000} rows={7} className={fieldClass} /></div>
                    <input type="text" name="_honey" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                    <label className="flex items-start gap-3 text-xs leading-5 text-gray-400"><input type="checkbox" required className="mt-1 accent-[#D4AF37]" /><span>Li a <Link to="/privacy">Política de Privacidade</Link> e autorizo o uso dos dados para tratar esta solicitação.</span></label>
                    <button type="submit" disabled={status === 'sending'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-black transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70">
                        {status === 'sending' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}{status === 'sending' ? 'Enviando...' : 'Enviar mensagem'}
                    </button>
                    {status === 'success' && <p role="status" className="flex items-center gap-2 text-sm text-green-400"><CheckCircle2 className="h-5 w-5" /> Mensagem enviada. Obrigado pelo contato.</p>}
                    {status === 'error' && <p role="alert" className="text-sm text-red-400">Não foi possível enviar agora. Tente novamente ou use o e-mail direto.</p>}
                </form>
            </div>
        </InfoPageLayout>
    );
}
