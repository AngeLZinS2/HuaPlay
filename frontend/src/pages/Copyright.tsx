import { Link } from 'react-router-dom';
import InfoPageLayout from '../components/InfoPageLayout';

export default function Copyright() {
    return (
        <InfoPageLayout eyebrow="Versão 1.2 — 12 de outubro de 2026" title="Direitos autorais e desindexação" intro="Canal para titulares e representantes solicitarem a análise e remoção de referências potencialmente infratoras.">
            <section><h2>1. Natureza do serviço</h2><p>O HuaPlay indexa e organiza referências a conteúdos audiovisuais disponibilizados por fontes externas. Não armazenamos arquivos de vídeo em nossos servidores. Essa característica não impede a análise responsável de referências, seleções, apresentações ou incorporações contestadas.</p></section>
            <section><h2>2. Respeito aos titulares</h2><p>Reconhecemos os direitos de autores, produtores, distribuidores, tradutores e demais titulares. A indexação de uma referência não prova que a fonte externa possui licença, e o HuaPlay não reivindica titularidade sobre obras de terceiros.</p></section>
            <section><h2>3. Como solicitar desindexação</h2><p>Envie a solicitação pelo <Link to="/contact">formulário de contato</Link>, selecionando “Direitos autorais”, e inclua:</p><ul><li>identificação clara da obra protegida;</li><li>URL exata da página ou referência no HuaPlay;</li><li>nome, e-mail e qualidade em que atua;</li><li>descrição objetiva da infração alegada;</li><li>declaração de boa-fé de que o uso não foi autorizado pelo titular, seu representante ou pela lei;</li><li>declaração de veracidade e legitimidade da representação;</li><li>assinatura física ou eletrônica, quando aplicável.</li></ul></section>
            <section><h2>4. Análise e medidas</h2><p>Notificações suficientemente fundamentadas serão analisadas sem demora injustificada. Conforme o caso, poderemos desabilitar preventivamente um player, remover uma referência ou página, bloquear uma fonte externa e registrar a decisão. A desindexação no HuaPlay não remove arquivos mantidos por terceiros.</p></section>
            <section><h2>5. Contestação e reindexação</h2><p>Uma medida poderá ser contestada com documentação de autorização ou outra base jurídica legítima. Quando a infração for confirmada, buscaremos impedir a reinclusão automática da mesma referência ou de alternativas tecnicamente identificáveis.</p></section>
            <section><h2>6. Legislação aplicável</h2><p>Este é um procedimento de notificação e desindexação. Ele não certifica conformidade com o Digital Millennium Copyright Act nem concede automaticamente limitações de responsabilidade. Quando aplicável, observaremos requisitos específicos e a legislação brasileira pertinente, incluindo a Lei nº 9.610/1998, o Marco Civil da Internet e a LGPD.</p></section>
            <section><h2>7. Canal responsável</h2><p>Responsável pelo canal: Angelo Neri. E-mail: <a href="mailto:angelo.neri@playdb.info">angelo.neri@playdb.info</a>.</p></section>
        </InfoPageLayout>
    );
}
