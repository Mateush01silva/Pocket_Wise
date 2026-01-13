# 🗄️ Database Migrations - Pocket Wise

Este diretório contém os scripts SQL para criar e atualizar o banco de dados do Pocket Wise no Supabase.

## 📋 Pré-requisitos

- Acesso ao **Supabase Dashboard** do seu projeto
- As tabelas base já criadas: `users`, `families`, `categorias`

## 🚀 Como executar as migrations

### 🟢 PRIMEIRA VEZ ou SE TIVER ERRO

Use este script (idempotente - pode rodar múltiplas vezes):

**Arquivo:** `database/migrations/001_create_orcamentos_tables_v2.sql`

#### Passo 1: Acessar o SQL Editor

1. Acesse o [Supabase Dashboard](https://app.supabase.com/)
2. Selecione seu projeto **Pocket_Wise**
3. No menu lateral, clique em **SQL Editor**

#### Passo 2: Executar o script

1. Clique em **New Query** (ou use a aba vazia)
2. Abra o arquivo: `database/migrations/001_create_orcamentos_tables_v2.sql`
3. Copie **TODO** o conteúdo
4. Cole no editor SQL
5. Clique em **Run** (ou pressione `Ctrl/Cmd + Enter`)

✅ **Este script pode ser executado múltiplas vezes sem dar erro!**

#### Passo 3: Verificar se funcionou

Execute a seguinte query para verificar se as tabelas foram criadas:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'orcamentos_mensais',
    'categorias_budget',
    'alertas_orcamento',
    'patrimonio'
  );
```

Você deve ver as 4 tabelas listadas.

---

## 🔴 SE QUISER RECOMEÇAR DO ZERO (CUIDADO!)

**⚠️ ATENÇÃO: Isso vai APAGAR todos os dados de orçamento!**

Se você quer remover tudo e recriar do zero:

1. Execute primeiro: `database/migrations/000_cleanup_orcamentos.sql`
2. Depois execute: `database/migrations/001_create_orcamentos_tables_v2.sql`

## 📦 Tabelas criadas

### 1. `orcamentos_mensais`
Armazena o orçamento planejado para cada mês por família.

**Campos principais:**
- `mes_referencia`: Mês de referência (YYYY-MM-01)
- `meta_poupanca`: Valor que a família quer poupar no mês
- `status`: rascunho | ativo | fechado

### 2. `categorias_budget`
Valores orçados para cada categoria dentro de um orçamento (Envelopes Digitais).

**Campos principais:**
- `orcamento_id`: Referência ao orçamento mensal
- `categoria_id`: Categoria de despesa (ex: Alimentação)
- `valor_orcado`: Quanto foi alocado neste envelope
- `prioridade`: essencial | importante | desejavel

### 3. `alertas_orcamento`
Sistema de notificações inteligentes sobre gastos.

**Tipos de alertas:**
- `categoria_80/90/100`: Categoria atingiu 80%, 90% ou 100% do orçado
- `gasto_incomum`: Gasto acima do padrão detectado
- `meta_atingida`: Meta de poupança alcançada
- `fatura_proxima`: Fatura de cartão próxima do vencimento

### 4. `patrimonio`
Histórico de patrimônio líquido do usuário.

**Campos principais:**
- `valor_total`: Patrimônio líquido total
- `data_atualizacao`: Data desta atualização

## 🔒 Segurança (RLS)

Todas as tabelas possuem **Row Level Security (RLS)** habilitado:

- ✅ Usuários só veem dados da própria família
- ✅ Usuários só podem criar/editar dados da própria família
- ✅ Patrimônio é individual (não compartilhado com família)

## 🔄 Próximas migrations

Para adicionar novas migrations, crie arquivos numerados:
- `002_add_something.sql`
- `003_alter_something.sql`

## ⚠️ Importante

- **Sempre teste** em um ambiente de desenvolvimento primeiro
- **Faça backup** antes de executar em produção
- As migrations são **idempotentes** (podem ser executadas múltiplas vezes com segurança)

## 📞 Suporte

Se encontrar algum erro ao executar, verifique:
1. Se as tabelas de referência (`users`, `families`, `categorias`) existem
2. Se o RLS está habilitado no projeto Supabase
3. Se você tem permissões de admin no projeto
