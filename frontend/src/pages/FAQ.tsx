import InfoPageLayout from '../components/InfoPageLayout';

const questions = [
    ['O HuaPlay hospeda os vídeos?', 'Não. O HuaPlay organiza informações e referências para conteúdos disponibilizados por fontes externas. A reprodução pode depender da disponibilidade e das regras desses terceiros.'],
    ['Preciso criar uma conta?', 'Parte do catálogo pode ser explorada sem conta. Recursos pessoais, como perfis, histórico, curtidas e Minha Lista, exigem autenticação.'],
    ['Por que um episódio ou player não funciona?', 'Links externos podem mudar, expirar ou ficar indisponíveis. Use o recurso de denúncia do conteúdo ou o formulário de contato e informe a página e o episódio afetado.'],
    ['Como adiciono algo à Minha Lista?', 'Entre na sua conta, selecione um perfil e use o botão de lista disponível nos cards e nas páginas das séries.'],
    ['Como solicito a remoção de conteúdo?', 'Acesse Direitos Autorais ou Contato, escolha o assunto correspondente e envie a URL exata, a identificação da obra e os dados que comprovem sua legitimidade para fazer o pedido.'],
    ['Posso pedir acesso ou exclusão dos meus dados?', 'Sim. Envie a solicitação pelo formulário de contato usando o e-mail associado à conta. Poderemos pedir uma verificação razoável de identidade antes de atender ao pedido.'],
    ['O HuaPlay é gratuito?', 'O acesso atualmente é gratuito. Recursos, disponibilidade e condições podem mudar, sempre com atualização dos Termos quando necessário.'],
];

export default function FAQ() {
    return (
        <InfoPageLayout eyebrow="Central de ajuda" title="Perguntas frequentes" intro="Respostas rápidas sobre contas, reprodução, privacidade e solicitações de remoção.">
            <div className="space-y-4">
                {questions.map(([question, answer]) => (
                    <details key={question} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 open:border-primary/30">
                        <summary className="cursor-pointer list-none pr-6 font-semibold text-white marker:hidden">{question}</summary>
                        <p className="mt-4 border-t border-white/10 pt-4 text-sm text-gray-400">{answer}</p>
                    </details>
                ))}
            </div>
        </InfoPageLayout>
    );
}
