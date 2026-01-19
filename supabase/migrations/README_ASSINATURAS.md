# 📱 Migration: Assinaturas (Feature #4)

## 📋 Descrição

Esta migration cria toda a estrutura necessária para o sistema de gestão de assinaturas recorrentes no Supabase.

## 🗄️ Estrutura Criada

### 1. Tabela `assinaturas`
- Armazena informações das assinaturas (Netflix, Spotify, etc)
- Campos: nome, logo, valor, frequência, dia de cobrança, categoria
- Suporte para usuário individual ou família
- Status ativo/inativo

### 2. Tabela `historico_valor_assinaturas`
- Rastreia mudanças de valor ao longo do tempo
- Mantém histórico completo de reajustes

### 3. Coluna `assinatura_id` em `lancamentos`
- Vincula lançamentos às assinaturas que os geraram
- Permite rastreamento e gestão automática

### 4. Triggers
- `update_assinaturas_updated_at`: Atualiza timestamp automaticamente

### 5. Row Level Security (RLS)
- Políticas completas de segurança
- Usuários só veem suas assinaturas ou da família

## 🚀 Como Aplicar

### Opção 1: Supabase CLI (Recomendado)

```bash
# Na raiz do projeto
supabase db push
```

### Opção 2: Dashboard do Supabase

1. Acesse o dashboard do Supabase
2. Vá em **SQL Editor**
3. Copie o conteúdo de `008_create_assinaturas_tables.sql`
4. Execute o SQL
5. Verifique se apareceu a mensagem: "✅ Migration 008: Assinaturas tables created successfully"

### Opção 3: Aplicar via API

```bash
# Conecte ao seu banco
psql -h db.xxxxx.supabase.co -U postgres -d postgres

# Execute o arquivo
\i supabase/migrations/008_create_assinaturas_tables.sql
```

## ✅ Verificação

Após aplicar a migration, verifique se foi criado:

```sql
-- Verificar tabelas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('assinaturas', 'historico_valor_assinaturas');

-- Verificar coluna assinatura_id
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'lancamentos'
AND column_name = 'assinatura_id';

-- Verificar RLS
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('assinaturas', 'historico_valor_assinaturas');
```

## 🔄 Rollback (se necessário)

Se precisar reverter a migration:

```sql
-- Remover políticas RLS
DROP POLICY IF EXISTS "Users can view own assinaturas" ON public.assinaturas;
DROP POLICY IF EXISTS "Users can insert own assinaturas" ON public.assinaturas;
DROP POLICY IF EXISTS "Users can update own assinaturas" ON public.assinaturas;
DROP POLICY IF EXISTS "Users can delete own assinaturas" ON public.assinaturas;
DROP POLICY IF EXISTS "Users can view own historico_valor" ON public.historico_valor_assinaturas;
DROP POLICY IF EXISTS "Users can insert own historico_valor" ON public.historico_valor_assinaturas;

-- Remover trigger
DROP TRIGGER IF EXISTS trigger_assinaturas_updated_at ON public.assinaturas;
DROP FUNCTION IF EXISTS public.update_assinaturas_updated_at();

-- Remover coluna
ALTER TABLE public.lancamentos DROP COLUMN IF EXISTS assinatura_id;

-- Remover tabelas
DROP TABLE IF EXISTS public.historico_valor_assinaturas;
DROP TABLE IF EXISTS public.assinaturas;
```

## 📊 Dados de Teste (Opcional)

Se quiser testar com dados de exemplo:

```sql
-- Inserir assinatura de teste
INSERT INTO public.assinaturas (
    family_id,
    nome,
    logo_url,
    valor,
    frequencia,
    dia_cobranca,
    categoria_id,
    primeira_cobranca,
    ativa
) VALUES (
    'sua-family-id-aqui',
    'Netflix',
    '🎬',
    49.90,
    'mensal',
    10,
    'sua-categoria-id-aqui',
    '2026-01-10',
    true
);
```

## 🐛 Troubleshooting

### Erro: "relation already exists"
A tabela já foi criada. Você pode:
- Ignorar o erro (migration é idempotente)
- Ou verificar se já está tudo configurado

### Erro: "permission denied"
Certifique-se de estar conectado como usuário `postgres` ou com permissões de admin.

### Erro: "foreign key constraint"
Certifique-se que as tabelas `families`, `categorias` e `lancamentos` existem.

## 📝 Notas

- Esta migration é **idempotente** (pode ser executada múltiplas vezes)
- Usa `IF NOT EXISTS` para evitar erros se já executada
- Compatível com migrations anteriores
- Não afeta dados existentes

## 🔗 Links Úteis

- [Documentação Supabase Migrations](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [SQL Reference](https://www.postgresql.org/docs/current/sql.html)
