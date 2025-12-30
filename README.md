# 💰 PocketWise - Sistema de Gestão Financeira Pessoal/Familiar

PocketWise é um SaaS B2C para controle financeiro pessoal e familiar. Permite que famílias compartilhem e gerenciem suas finanças juntas, com múltiplos usuários editando os mesmos dados.

## ✨ Funcionalidades Principais

- 📊 **Dashboard Interativo**: Visão geral completa do patrimônio e finanças
- 💸 **Gestão de Transações**: Lançamento de despesas e receitas de qualquer lugar
- 💳 **Controle de Cartões**: Gerenciamento de cartões de crédito e parcelamentos
- 📈 **Projeções Financeiras**: Projeção de gastos futuros baseada no histórico
- 👨‍👩‍👧‍👦 **Compartilhamento Familiar**: Múltiplos usuários gerenciando as mesmas finanças
- 🎯 **Orçamentos**: Definição e acompanhamento de limites de gastos por categoria

## 🚀 Stack Tecnológica

### Frontend
- **React 18** - Framework principal
- **TypeScript** - Type safety
- **Vite** - Build tool e dev server
- **TailwindCSS 3** - Estilização com design system dark mode
- **React Router DOM** - Navegação
- **Zustand** - State management
- **Recharts** - Gráficos e visualizações
- **Lucide React** - Ícones
- **Sonner** - Toast notifications
- **date-fns** - Manipulação de datas

### Backend & Infraestrutura (Próximas Fases)
- **Supabase** - Banco de dados PostgreSQL + Auth + RLS
- **Stripe** - Sistema de pagamentos e assinaturas
- **Vercel** - Hospedagem e deploy

## 🎨 Design System

- **Tema**: Dark mode com estética tech moderna
- **Cores**:
  - Background: `#0f0f0f` (dark-900)
  - Primary: `#0ea5e9` (Azul tech)
  - Secondary: `#a855f7` (Roxo)
- **Estilo**: Cards com glassmorphism, bordas arredondadas, sombras suaves
- **Tipografia**: Inter

## 📁 Estrutura do Projeto

```
src/
├── components/
│   ├── ui/              # Componentes de UI reutilizáveis (Button, Card, Input)
│   ├── layout/          # Componentes de layout (Sidebar, Layout)
│   └── features/        # Componentes específicos de features
├── pages/               # Páginas da aplicação
├── hooks/               # Custom React hooks
├── store/               # Zustand stores
├── types/               # TypeScript types e interfaces
├── utils/               # Funções utilitárias (currency, date)
├── lib/                 # Configurações de bibliotecas
└── services/            # Serviços (localStorage, futuramente Supabase)
```

## 🛠️ Como Executar

### Pré-requisitos
- Node.js 18+ instalado
- npm ou yarn

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/Mateush01silva/Pocket_Wise.git
cd Pocket_Wise
```

2. Instale as dependências:
```bash
npm install
```

3. Execute o projeto em modo desenvolvimento:
```bash
npm run dev
```

4. Acesse no navegador:
```
http://localhost:5173
```

### Scripts Disponíveis

```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Compila para produção
npm run preview      # Preview da build de produção
npm run lint         # Executa o ESLint
```

## 🌐 Deploy na Vercel

O projeto está configurado para deploy automático na Vercel!

### Deploy Rápido

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique em **"Add New..."** → **"Project"**
3. Importe o repositório **"Pocket_Wise"**
4. Adicione a variável de ambiente:
   ```
   VITE_USE_LOCAL_STORAGE=true
   ```
5. Clique em **"Deploy"**
6. 🎉 Pronto! Seu site estará no ar em poucos minutos

### Documentação Completa

Para instruções detalhadas, veja o arquivo [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md)

### Atualizações Automáticas

Após o primeiro deploy, toda vez que você fizer `git push`, a Vercel:
- ✅ Detecta as mudanças automaticamente
- ✅ Faz build da nova versão
- ✅ Atualiza o site em produção

## 🗺️ Roadmap de Desenvolvimento

### ✅ Fase 1 - Setup Inicial (Concluído)
- [x] Configuração do projeto com Vite + React + TypeScript
- [x] Setup do TailwindCSS e design system
- [x] Criação de componentes base de UI
- [x] Layout com sidebar e navegação
- [x] Estrutura de pastas organizada
- [x] Tipos TypeScript para entidades principais

### 🚧 Fase 2 - MVP com LocalStorage (Em Planejamento)
- [ ] CRUD de transações (receitas/despesas)
- [ ] CRUD de cartões de crédito
- [ ] Sistema de categorias
- [ ] Dashboard com estatísticas básicas
- [ ] Gráficos de gastos por categoria
- [ ] Lista de transações recentes
- [ ] Sistema de orçamentos

### 📋 Fase 3 - Funcionalidades Avançadas
- [ ] Transações recorrentes
- [ ] Parcelamentos de cartão de crédito
- [ ] Projeções financeiras
- [ ] Filtros e busca avançada
- [ ] Exportação de dados (CSV, PDF)

### 🔐 Fase 4 - Integração Supabase
- [ ] Migração do LocalStorage para Supabase
- [ ] Sistema de autenticação
- [ ] Compartilhamento familiar com RLS
- [ ] Sincronização em tempo real

### 💳 Fase 5 - Monetização
- [ ] Integração com Stripe
- [ ] Sistema de planos (Free, Premium, Family)
- [ ] Gestão de assinaturas
- [ ] Webhooks para pagamentos

### 🚀 Fase 6 - Deploy
- [ ] Deploy na Vercel
- [ ] Configuração de domínio
- [ ] Analytics e monitoramento
- [ ] CI/CD pipeline

## 🤝 Contribuindo

Este é um projeto em desenvolvimento. Contribuições são bem-vindas!

## 📄 Licença

Este projeto está sob a licença MIT.

---

Desenvolvido com 💜 usando Claude Code
