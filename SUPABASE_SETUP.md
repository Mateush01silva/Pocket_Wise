# 🔧 Guia de Configuração do Supabase

Este guia vai te ajudar a configurar o Supabase para o PocketWise.

## 📋 Pré-requisitos

- Conta no [Supabase](https://supabase.com) (gratuita)
- Node.js 18+ instalado

## 🚀 Passo a Passo

### 1. Criar Projeto no Supabase

1. Acesse [app.supabase.com](https://app.supabase.com)
2. Clique em "New Project"
3. Preencha:
   - **Name**: PocketWise (ou o nome que preferir)
   - **Database Password**: Crie uma senha forte (guarde-a!)
   - **Region**: Escolha a região mais próxima (ex: South America - São Paulo)
4. Clique em "Create new project"
5. Aguarde alguns minutos enquanto o projeto é criado

### 2. Obter Credenciais do Projeto

1. No dashboard do seu projeto, vá em **Settings** (ícone de engrenagem) → **Chaves de API** (ou **API Keys**)
2. Copie os seguintes valores:
   - **Project URL**: `https://xxxxxxxxxxx.supabase.co` (encontrado em Settings → Project Settings → API)
   - **Chave publicável** (Publishable Key): Uma chave começando com `sb_publishable_...`

   ⚠️ **ATENÇÃO**: Use a "Chave publicável", NÃO use a "Chave secreta"! A chave secreta é apenas para backend/servidores.

### 3. Configurar Variáveis de Ambiente

1. Na raiz do projeto, copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

2. Edite o arquivo `.env` e adicione suas credenciais:
```env
VITE_SUPABASE_URL=https://seu-projeto-id.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_publica_aqui
VITE_USE_LOCAL_STORAGE=false
```

⚠️ **IMPORTANTE**: Nunca commite o arquivo `.env` no git! Ele já está no `.gitignore`.

### 4. Executar Migrations no Supabase

Agora você precisa criar as tabelas no banco de dados:

#### Opção A: Via Interface Web (Recomendado)

1. No dashboard do Supabase, vá em **SQL Editor** (ícone de código)
2. Clique em "New query"
3. Abra o arquivo `supabase/migrations/20250101000000_initial_schema.sql` deste projeto
4. Copie TODO o conteúdo do arquivo
5. Cole no editor SQL do Supabase
6. Clique em "Run" (ou pressione Ctrl/Cmd + Enter)
7. Aguarde a execução completar
8. Você deve ver mensagens de sucesso para cada comando

#### Opção B: Via CLI do Supabase (Avançado)

Se preferir usar o CLI:

```bash
# Instalar CLI do Supabase
npm install -g supabase

# Login no Supabase
supabase login

# Linkar o projeto local com o projeto remoto
supabase link --project-ref SEU_PROJECT_ID

# Aplicar migrations
supabase db push
```

### 5. Verificar Tabelas Criadas

1. No dashboard, vá em **Table Editor**
2. Você deve ver todas as tabelas criadas:
   - `families`
   - `users`
   - `categorias`
   - `cartoes`
   - `lancamentos`
   - `planejamentos`
   - `receitas_projetadas`

### 6. Configurar Autenticação (Opcional no MVP)

Por enquanto, você pode deixar a autenticação padrão. Mais tarde:

1. Vá em **Authentication** → **Providers**
2. Habilite os providers que desejar (Email, Google, etc)

### 7. Testar a Conexão

1. No seu projeto local, inicie o servidor:
```bash
npm run dev
```

2. Abra o console do navegador (F12)
3. Não deve haver erros de conexão com o Supabase

## 🔐 Row Level Security (RLS)

As políticas de RLS já foram configuradas na migration. Elas garantem que:

✅ Usuários só vejam dados da própria família
✅ Membros da mesma família compartilhem acesso aos dados
✅ Campos como "criado_por" sejam automaticamente preenchidos

Para ver as políticas:
1. Vá em **Authentication** → **Policies**
2. Selecione uma tabela para ver suas políticas

## 📊 Categorias Padrão

O schema inclui uma função `create_default_categories(p_family_id)` que cria categorias padrão quando uma nova família é criada.

Para executá-la manualmente (teste):
```sql
SELECT create_default_categories('UUID_DA_SUA_FAMILIA');
```

## 🔄 Modo Desenvolvimento: LocalStorage vs Supabase

O projeto suporta dois modos:

### Modo LocalStorage (MVP - Padrão Atual)
```env
VITE_USE_LOCAL_STORAGE=true
```
- Dados salvos no navegador
- Não precisa de Supabase configurado
- Ideal para desenvolvimento rápido
- Dados não compartilhados entre dispositivos

### Modo Supabase (Produção)
```env
VITE_USE_LOCAL_STORAGE=false
VITE_SUPABASE_URL=sua_url
VITE_SUPABASE_ANON_KEY=sua_chave
```
- Dados salvos no banco de dados na nuvem
- Sincronização em tempo real
- Compartilhamento familiar
- Autenticação de usuários

## 📝 Próximos Passos

Depois de configurar o Supabase:

1. ✅ Criar primeira família de teste via SQL:
```sql
INSERT INTO families (nome) VALUES ('Família Teste');
```

2. ✅ Criar usuário de teste (após implementar autenticação):
   - Ir em **Authentication** → **Users** → "Add user"

3. ✅ Testar as funcionalidades do app

4. ✅ Habilitar Realtime (opcional):
   - Database → Replication → Habilitar para as tabelas desejadas

## 🆘 Troubleshooting

### Erro: "Invalid API key"
- Verifique se copiou a chave `anon` correta (não a `service_role`)
- Confirme que não há espaços extras no arquivo `.env`

### Erro: "relation does not exist"
- As migrations não foram executadas
- Execute o SQL do arquivo de migration novamente

### Erro: "JWT expired"
- Reinicie o servidor de desenvolvimento: `npm run dev`

### Erro de RLS: "new row violates row-level security policy"
- Verifique se o usuário está autenticado
- Confirme que o usuário tem `family_id` configurado

## 📚 Recursos Úteis

- [Documentação do Supabase](https://supabase.com/docs)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)

## 🔄 Gerando Tipos Automaticamente

Depois que o banco estiver configurado, você pode gerar os tipos TypeScript automaticamente:

```bash
npx supabase gen types typescript --project-id SEU_PROJECT_ID > src/types/database.ts
```

Isso garante que os tipos TypeScript sempre correspondam ao schema do banco.

---

**Dúvidas?** Consulte a [documentação oficial do Supabase](https://supabase.com/docs) ou abra uma issue no GitHub.
