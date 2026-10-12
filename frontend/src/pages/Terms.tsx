import { Link } from 'react-router-dom';
import InfoPageLayout from '../components/InfoPageLayout';

export default function Terms() {
    return (
        <InfoPageLayout eyebrow="Última atualização: 12 de outubro de 2026" title="Termos de uso" intro="Estes termos definem as condições para acessar e utilizar o HuaPlay.">
            <section><h2>1. Aceitação</h2><p>Ao acessar ou usar o HuaPlay, você concorda com estes Termos e com a Política de Privacidade. Se não concordar, não utilize o serviço.</p></section>
            <section><h2>2. Natureza do serviço</h2><p>O HuaPlay organiza catálogo, metadados e referências a conteúdos audiovisuais. Não hospedamos arquivos de vídeo em nossos servidores. Players, links, imagens e informações podem ser fornecidos por serviços externos e permanecer sujeitos aos termos desses terceiros.</p></section>
            <section><h2>3. Conta e perfis</h2><p>Você deve fornecer informações corretas, proteger suas credenciais e responder pelas atividades realizadas em sua conta. Informe-nos caso suspeite de acesso indevido. Perfis são vinculados à conta principal e não constituem contas independentes.</p></section>
            <section><h2>4. Uso permitido</h2><p>Você pode usar o serviço para fins pessoais e lícitos. É proibido tentar invadir, sobrecarregar ou contornar controles do sistema; automatizar acessos abusivos; distribuir malware; violar direitos de terceiros; manipular métricas; ou utilizar o HuaPlay para atividade ilegal.</p></section>
            <section><h2>5. Conteúdo e serviços de terceiros</h2><p>A presença de uma referência externa não representa garantia de autorização, qualidade, segurança ou disponibilidade. Podemos corrigir metadados, desabilitar players e remover referências a qualquer momento, especialmente após denúncia fundamentada.</p></section>
            <section><h2>6. Direitos autorais</h2><p>Marcas, interface e código próprio do HuaPlay permanecem protegidos. Obras e materiais de terceiros pertencem a seus respectivos titulares. Pedidos de remoção devem seguir a nossa <Link to="/copyright">Política de Direitos Autorais e Desindexação</Link>.</p></section>
            <section><h2>7. Disponibilidade</h2><p>Buscamos manter o serviço estável, mas não garantimos funcionamento contínuo, ausência de erros ou permanência de qualquer conteúdo. Podemos realizar manutenção, alterar funcionalidades ou encerrar partes do serviço.</p></section>
            <section><h2>8. Responsabilidade</h2><p>Na extensão permitida pela legislação aplicável, o HuaPlay não responde por indisponibilidade de fontes externas, decisões ou atos de terceiros, perdas indiretas ou uso contrário a estes Termos. Nada aqui exclui direitos que não possam ser afastados por lei.</p></section>
            <section><h2>9. Suspensão</h2><p>Podemos limitar ou suspender o acesso em caso de fraude, risco de segurança, exigência legal ou violação destes Termos, observada a proporcionalidade aplicável ao caso.</p></section>
            <section><h2>10. Alterações e contato</h2><p>Podemos atualizar estes Termos para refletir mudanças legais ou operacionais. A data acima indicará a versão vigente. Dúvidas podem ser enviadas para <a href="mailto:angelo.neri@playdb.info">angelo.neri@playdb.info</a>.</p></section>
        </InfoPageLayout>
    );
}
