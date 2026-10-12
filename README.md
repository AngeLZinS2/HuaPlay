# HuaPlay

<p align="center">
  <strong>Plataforma de streaming dedicada a doramas, filmes e produções asiáticas.</strong>
</p>

<p align="center">
  Experiência responsiva, catálogo editorial, perfis personalizados e um painel administrativo completo.
</p>

## Sobre o projeto

O HuaPlay reúne descoberta, organização e reprodução de conteúdos asiáticos em uma experiência inspirada nas principais plataformas de streaming. A aplicação possui interface adaptada para celular e desktop, autenticação com Firebase, múltiplos perfis, recomendações personalizadas e ferramentas editoriais para administrar todo o catálogo.

O projeto é composto por uma aplicação React, uma API FastAPI e um banco SQLite persistente. Todo o ambiente pode ser executado com Docker Compose.

## Principais recursos

### Experiência do usuário

- Home editorial com banner dinâmico e fileiras configuráveis.
- Layout responsivo para celulares, tablets e computadores.
- Barra de navegação flutuante exclusiva para dispositivos móveis.
- Pesquisa, filtros por categoria, gênero, país, ano, tags e status.
- Páginas de detalhes para obras, episódios e elenco.
- Lista pessoal, curtidas, histórico e recomendações por conteúdo.
- Múltiplos perfis de usuário com avatares personalizados.
- Player com suporte a diferentes provedores externos.
- Aplicação instalável como PWA e base Android com Capacitor.
- Recurso **Shake to Report** para enviar problemas pelo celular.

### Administração

- Dashboard com indicadores e visão recente do catálogo.
- Cadastro e edição de séries, filmes, atores e episódios.
- Organização visual das fileiras exibidas na página inicial.
- Seleção manual e ordenação dos conteúdos de cada fileira.
- Monitoramento da saúde dos serviços.
- Central de relatórios enviados pelos usuários.
- Proteção das rotas administrativas por autenticação.

### Institucional

- FAQ, Termos de Uso, Privacidade e Política de Direitos Autorais.
- Formulário de contato integrado ao e-mail do projeto.
- Footer com links institucionais e redes do responsável.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Framer Motion e Lucide |
| Backend | FastAPI, Python, SQLAlchemy e Pydantic |
| Autenticação | Firebase Authentication e JWT |
| Dados | SQLite com volume persistente |
| Recomendação | Scikit-learn, TF-IDF e similaridade de cosseno |
| Aplicativo | PWA e Capacitor para Android |
| Infraestrutura | Docker, Docker Compose e Nginx |

## Estrutura

```text
HuaPlay/
├── backend/
│   ├── routers/          # Rotas públicas e administrativas
│   ├── scripts/          # Importação e manutenção do catálogo
│   ├── main.py           # Inicialização da API
│   ├── models.py         # Modelos do banco de dados
│   ├── schemas.py        # Contratos da API
│   └── recommender.py    # Motor de recomendações
├── frontend/
│   ├── src/components/   # Componentes reutilizáveis
│   ├── src/context/      # Estado global da aplicação
│   ├── src/pages/        # Páginas públicas e administrativas
│   ├── src/services/     # Cliente da API
│   └── android/          # Projeto Android gerado pelo Capacitor
├── data/                 # Banco persistente usado pelo Docker
├── docs/                 # Documentação complementar
└── docker-compose.yml
```

## Executando com Docker

### Requisitos

- Docker Engine
- Docker Compose

Na raiz do projeto, execute:

```bash
docker compose up -d --build
```

A aplicação ficará disponível em `http://localhost:8084`. O frontend encaminha as chamadas de `/api` para o backend dentro da rede do Docker.

Para acompanhar os serviços:

```bash
docker compose ps
docker compose logs -f
```

## Desenvolvimento local

### Backend

```bash
cd backend
python -m venv venv
```

No Windows:

```powershell
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Para gerar a versão de produção:

```bash
npm run build
```

## Variáveis e configuração

Mantenha credenciais fora do repositório e configure os serviços por variáveis de ambiente. A URL da API usada no build do frontend pode ser definida com `VITE_API_URL`; no Docker, o valor padrão é `/api`.

O banco de produção deve ser armazenado em `data/weifansub.db`, montado como volume no container da API. Faça backup desse arquivo antes de atualizações estruturais.

## Rotas principais

| Rota | Finalidade |
| --- | --- |
| `/` | Página inicial e fileiras editoriais |
| `/explore` | Exploração e filtros do catálogo |
| `/my-list` | Lista pessoal do usuário |
| `/actors` e `/actresses` | Catálogo de elenco |
| `/faq` | Perguntas frequentes |
| `/terms` | Termos de uso |
| `/privacy` | Política de privacidade |
| `/copyright` | Direitos autorais e desindexação |
| `/contact` | Formulário de contato |
| `/admin` | Painel administrativo |

## Contato

- E-mail: [angelo.neri@playdb.info](mailto:angelo.neri@playdb.info)
- GitHub: [AngeLZinS2](https://github.com/AngeLZinS2)
- LinkedIn: [Angelo Neri](https://www.linkedin.com/in/angelo-neri-3921a72b9/)

## Aviso

O HuaPlay é um projeto de catálogo e experiência de streaming. Marcas, imagens e informações de terceiros pertencem aos seus respectivos titulares. Solicitações relacionadas a direitos autorais devem ser encaminhadas pelos canais informados na aplicação.
