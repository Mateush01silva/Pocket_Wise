# Migration: Assinaturas Tables (Versão Simplificada)

## ⚠️ Versão Simplificada - Sem Family Support

Esta é a **versão 2.0** da migration de assinaturas, **SEM** suporte a famílias compartilhadas.

**Diferenças da versão original:**
- ❌ Removida coluna `family_id`
- ✅ Campo `user_id` é obrigatório (NOT NULL)
- ❌ Removido CONSTRAINT `assinaturas_owner_check`
- ✅ Políticas RLS simplificadas (somente user_id)

**Quando usar:**
- Use esta versão se a **Feature 3 (Famílias Compartilhadas)** ainda não foi implementada
- Quando implementar a Feature 3, rode uma migration adicional para adicionar a coluna `family_id`

---

## 📋 Pré-requisitos

Antes de executar esta migration, verifique se você tem:

1. ✅ Tabela `auth.users` (criada automaticamente pelo Supabase Auth)
2. ✅ Tabela `categorias` (criada nas migrations anteriores)
3. ✅ Tabela `lancamentos` (criada nas migrations anteriores)

---

## 🚀 Como Aplicar a Migration

### Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse o **Supabase Dashboard**: https://app.supabase.com
2. Selecione seu projeto
3. No menu lateral, vá em **SQL Editor**
4. Clique em **New Query**
5. Copie e cole o conteúdo do arquivo `008_create_assinaturas_tables_v2.sql`
6. Clique em **Run** (ou pressione `Ctrl/Cmd + Enter`)
7. Verifique os logs de sucesso no painel de saída

### Opção 2: Via Supabase CLI

```bash
# 1. Navegue até a raiz do projeto
cd /home/user/Pocket_Wise

# 2. Execute a migration
supabase db push

# Ou execute diretamente o arquivo SQL:
supabase db execute -f supabase/migrations/008_create_assinaturas_tables_v2.sql
```

### Opção 3: Via SQL direto no psql

```bash
psql postgresql://[seu-database-url] -f supabase/migrations/008_create_assinaturas_tables_v2.sql
```

---

## ✅ Verificação Pós-Migration

Após executar a migration, rode estas queries para verificar:

```sql
-- 1. Verificar se as tabelas foram criadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('assinaturas', 'historico_valor_assinaturas');

-- 2. Verificar estrutura da tabela assinaturas
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'assinaturas'
ORDER BY ordinal_position;

-- 3. Verificar se a coluna assinatura_id foi adicionada em lancamentos
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'lancamentos'
AND column_name = 'assinatura_id';

-- 4. Verificar políticas RLS
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('assinaturas', 'historico_valor_assinaturas');

-- 5. Testar inserção de dados (opcional)
INSERT INTO assinaturas (user_id, nome, valor, frequencia, dia_cobranca, primeira_cobranca, logo_url)
VALUES (
    auth.uid(),
    'Netflix',
    39.90,
    'mensal',
    15,
    CURRENT_DATE,
    '🎬'
) RETURNING *;
```

---

## 📊 Estrutura das Tabelas Criadas

### Tabela: `assinaturas`

| Coluna | Tipo | Restrições | Descrição |
|--------|------|------------|-----------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | ID único da assinatura |
| `user_id` | UUID | NOT NULL, FK → auth.users(id) | Proprietário da assinatura |
| `nome` | VARCHAR(100) | NOT NULL | Nome da assinatura (ex: Netflix) |
| `logo_url` | TEXT | NULLABLE | URL do logo (emoji ou imagem) |
| `valor` | DECIMAL(10,2) | NOT NULL, CHECK > 0 | Valor da assinatura |
| `frequencia` | VARCHAR(20) | NOT NULL, CHECK IN ('mensal', 'anual') | Frequência de cobrança |
| `dia_cobranca` | INTEGER | NOT NULL, CHECK 1-31 | Dia do mês da cobrança |
| `categoria_id` | UUID | NULLABLE, FK → categorias(id) | Categoria da despesa |
| `primeira_cobranca` | DATE | NOT NULL | Data da primeira cobrança |
| `ultima_cobranca` | DATE | NULLABLE | Data da última cobrança (quando cancelada) |
| `ativa` | BOOLEAN | NOT NULL, DEFAULT true | Se está ativa |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Data de criação |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Data de atualização |

**Índices:**
- `idx_assinaturas_user_id` → `user_id`
- `idx_assinaturas_categoria_id` → `categoria_id`
- `idx_assinaturas_ativa` → `ativa`
- `idx_assinaturas_primeira_cobranca` → `primeira_cobranca`

### Tabela: `historico_valor_assinaturas`

| Coluna | Tipo | Restrições | Descrição |
|--------|------|------------|-----------|
| `id` | UUID | PRIMARY KEY | ID único do histórico |
| `assinatura_id` | UUID | NOT NULL, FK → assinaturas(id) | Assinatura relacionada |
| `valor_antigo` | DECIMAL(10,2) | NOT NULL | Valor anterior |
| `valor_novo` | DECIMAL(10,2) | NOT NULL | Novo valor |
| `vigencia_inicio` | DATE | NOT NULL | Data de início do novo valor |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Data do registro |

**Índices:**
- `idx_historico_valor_assinaturas_assinatura_id` → `assinatura_id`
- `idx_historico_valor_assinaturas_vigencia_inicio` → `vigencia_inicio`

### Modificação: `lancamentos`

Foi adicionada a coluna:
- `assinatura_id` (UUID, NULLABLE, FK → assinaturas(id))

**Índice adicionado:**
- `idx_lancamentos_assinatura_id` → `assinatura_id`

---

## 🔒 Políticas RLS Criadas

### Para `assinaturas`:
1. **SELECT**: Usuários podem ver suas próprias assinaturas
2. **INSERT**: Usuários podem criar suas próprias assinaturas
3. **UPDATE**: Usuários podem atualizar suas próprias assinaturas
4. **DELETE**: Usuários podem deletar suas próprias assinaturas

### Para `historico_valor_assinaturas`:
1. **SELECT**: Usuários podem ver histórico de suas assinaturas
2. **INSERT**: Usuários podem criar registros de histórico para suas assinaturas

---

## 🔄 Migration Futura (Quando implementar Feature 3)

Quando a **Feature 3 - Famílias Compartilhadas** for implementada, rode esta migration adicional:

```sql
-- Adicionar coluna family_id
ALTER TABLE public.assinaturas
ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;

-- Adicionar índice
CREATE INDEX idx_assinaturas_family_id ON public.assinaturas(family_id);

-- Modificar constraint para permitir family_id OU user_id
ALTER TABLE public.assinaturas
DROP CONSTRAINT IF EXISTS assinaturas_user_id_not_null;

ALTER TABLE public.assinaturas
ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.assinaturas
ADD CONSTRAINT assinaturas_owner_check CHECK (
    user_id IS NOT NULL OR family_id IS NOT NULL
);

-- Adicionar políticas RLS para famílias
-- (ver arquivo 008_create_assinaturas_tables.sql original)
```

---

## 🗑️ Rollback (Reverter Migration)

Se precisar reverter as mudanças:

```sql
-- CUIDADO: Isso vai deletar TODOS os dados de assinaturas!

-- 1. Dropar políticas RLS
DROP POLICY IF EXISTS "Users can view their own assinaturas" ON public.assinaturas;
DROP POLICY IF EXISTS "Users can create their own assinaturas" ON public.assinaturas;
DROP POLICY IF EXISTS "Users can update their own assinaturas" ON public.assinaturas;
DROP POLICY IF EXISTS "Users can delete their own assinaturas" ON public.assinaturas;
DROP POLICY IF EXISTS "Users can view historico of their own assinaturas" ON public.historico_valor_assinaturas;
DROP POLICY IF EXISTS "Users can create historico for their own assinaturas" ON public.historico_valor_assinaturas;

-- 2. Remover coluna de lancamentos
ALTER TABLE public.lancamentos DROP COLUMN IF EXISTS assinatura_id;

-- 3. Dropar tabelas (CASCADE vai dropar historico_valor_assinaturas também)
DROP TABLE IF EXISTS public.historico_valor_assinaturas CASCADE;
DROP TABLE IF EXISTS public.assinaturas CASCADE;

-- 4. Dropar trigger function (se não for usado em outras tabelas)
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
```

---

## ❓ Troubleshooting

### Erro: "relation 'categorias' does not exist"
**Solução**: Execute as migrations anteriores que criam a tabela `categorias`.

### Erro: "permission denied for table assinaturas"
**Solução**: Verifique se você está executando como um usuário com permissões adequadas. No Supabase Dashboard, isso geralmente não é problema.

### Erro: "column 'assinatura_id' already exists"
**Solução**: A migration é idempotente. Se a coluna já existe, a migration vai pular essa parte automaticamente.

### Como verificar se RLS está funcionando?
```sql
-- Tentar inserir uma assinatura sem auth (deve falhar)
SET LOCAL ROLE anon;
INSERT INTO assinaturas (user_id, nome, valor, frequencia, dia_cobranca, primeira_cobranca)
VALUES (gen_random_uuid(), 'Teste', 10.00, 'mensal', 1, CURRENT_DATE);
-- Deve retornar erro de permissão
```

---

## 📝 Notas Importantes

- Esta migration é **idempotente** - pode ser executada múltiplas vezes sem causar erros
- As políticas RLS garantem que cada usuário só veja suas próprias assinaturas
- A coluna `ativa` permite "soft delete" de assinaturas (cancelar sem deletar do banco)
- O histórico de valores preserva todas as mudanças de preço ao longo do tempo
- Triggers atualizam automaticamente o campo `updated_at` quando houver modificações

---

## ✅ Checklist Pós-Migration

- [ ] Migration executada sem erros
- [ ] Tabelas `assinaturas` e `historico_valor_assinaturas` criadas
- [ ] Coluna `assinatura_id` adicionada em `lancamentos`
- [ ] Políticas RLS ativas e funcionando
- [ ] Índices criados para performance
- [ ] Teste de inserção/leitura funcionando
- [ ] Frontend consegue conectar e listar assinaturas

---

**Versão:** 2.0 (Simplificada - sem family_id)
**Data:** 2026-01-19
**Autor:** Claude Code
**Feature:** #4 - Gestão de Assinaturas
