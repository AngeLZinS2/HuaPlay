# HuaPlay Streaming Platform

HuaPlay é uma plataforma de streaming moderna e intuitiva especializada em doramas e séries asiáticas, equipada com um **Motor de Recomendação por Machine Learning**, gerenciamento de **Múltiplos Perfis de Usuário** e um **Painel Administrativo Completo**.

---

## 🚀 Funcionalidades Principais

### 🎬 Plataforma Pública & Interface de Usuário
- **Hero Banner Dinâmico**: Rotação automática de doramas em destaque em Full HD com reprodução de trailers em alta definição.
- **Motor de Recomendação por Machine Learning (`recommender.py`)**:
  - Algoritmo baseado em **TF-IDF** e **Similaridade de Cosseno (Cosine Similarity)**.
  - Seleção personalizada baseada no histórico de exibição (`watch_history`), curtidas (`likes`) e lista de conteúdos (`user_list`).
  - Seções inteligentes *"Recomendados para Você"* e *"Porque Você Assistiu [Nome do Dorama]"*.
- **Múltiplos Perfis de Usuário**: Suporte a criação e troca de perfis (estilo Netflix) com avatares customizáveis.
- **Player de Vídeo Universal**: Suporte a embutimento automático de vídeos do YouTube, Google Drive, Mega, Mediafire, Pixeldrain e servidores externos.
- **Exploração Avançada de Tags & Gêneros**: Filtros estritos por tags originais da WeiFansub (*Wuxia, Xianxia, Ação/Mistério, Coabitação, Age Gap, LGBTQIA+, Escolar, República*, etc.).
- **Filtro por Ano de Lançamento & País**: Suporte a navegação por ano (2026 a 2002+) e país de origem (Coreia do Sul, China, Japão, Tailândia, etc.).

### ⚙️ Painel Administrativo (`/admin`)
- **Dashboard de Métricas**: Indicadores de total de séries, obras concluídas, em andamento e por tipo.
- **Gerenciamento de Séries**: Criação, edição, busca com paginação e filtro por Ano de Lançamento.
- **Gerenciamento de Episódios**: Upload e vinculação de múltiplos provedores de vídeo e download por episódio.
- **Elenco e Atores**: Cadastro e vinculação de atores com perfis individuais.

---

## 🛠 Tecnologia

### Frontend
- **Framework**: React 18 (Vite)
- **Linguagem**: TypeScript
- **Estilização**: Vanilla CSS / Tailwind CSS
- **Animações**: Framer Motion
- **Ícones**: Lucide React
- **HTTP Client**: Axios

### Backend
- **Framework**: FastAPI (Python 3.13)
- **Inteligência**: Scikit-learn / Counter Vector TF-IDF Cosine Math Engine
- **Banco de Dados**: SQLite (`weifansub.db`) via SQLAlchemy ORM
- **Autenticação**: JWT Tokens & Bcrypt Direct Hashing

---

## 📦 Estrutura do Repositório

```bash
HuaPlay/
├── backend/            # API FastAPI & Recomendador ML
│   ├── routers/        # Rotas da API (series, users, auth, actors)
│   ├── scripts/        # Scripts utilitários de scraping e TMDb HD
│   ├── recommender.py  # Motor de Inteligência ML (TF-IDF + Cosine Sim)
│   ├── auth.py         # Módulo de Autenticação Bcrypt
│   ├── main.py         # Ponto de entrada da aplicação
│   ├── models.py       # Modelos de dados SQLAlchemy
│   ├── schemas.py      # Esquemas Pydantic
│   └── weifansub.db    # Banco de dados SQLite de Produção
├── frontend/           # Aplicação React + Vite
│   ├── src/
│   │   ├── components/ # Componentes reutilizáveis (Hero, SeriesRow, Navbar)
│   │   ├── pages/      # Páginas (Home, SeriesDetail, Admin, CategoryExplore)
│   │   ├── context/    # Contextos globais (AuthContext, ModalContext)
│   │   └── services/   # Cliente API Axios
│   └── index.html
└── docs/               # Documentação técnica detalhada
```

---

## 🏁 Inicialização Rápida

### Backend (Servidor API)
```bash
cd backend
.\venv\Scripts\activate
uvicorn main:app --reload --port 8000
# Ou execute diretamente:
.\run_server.bat
```

### Frontend (Aplicação Web)
```bash
cd frontend
npm install
npm run dev
```

---

## 📚 Documentação Adicional

- [Documentação do Backend](docs/BACKEND.md)
- [Documentação do Frontend](docs/FRONTEND.md)
