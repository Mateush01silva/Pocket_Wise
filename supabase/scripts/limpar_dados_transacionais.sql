-- ================================================================
-- Script de Limpeza de Dados Transacionais
-- ================================================================
-- Este script remove todos os dados de transações, orçamentos e
-- envelopes, mas mantém as configurações (cartões, contas, categorias)
--
-- USO: Execute este script no Supabase SQL Editor
-- ================================================================

BEGIN;

-- 1. Deletar todos os lançamentos (transações)
DELETE FROM lancamentos;

-- 2. Deletar todos os orçamentos
DELETE FROM orcamentos;

-- 3. Deletar todos os envelopes digitais
DELETE FROM envelopes_digitais;

-- 4. Deletar todos os orçamentos por categoria
DELETE FROM orcamentos_categorias;

-- 5. Deletar planejamentos (se existir)
DELETE FROM planejamentos WHERE TRUE;

-- 6. Deletar receitas projetadas (se existir)
DELETE FROM receitas_projetadas WHERE TRUE;

-- 7. Resetar saldos das contas bancárias para o saldo inicial
UPDATE contas_bancarias
SET saldo_atual = saldo_inicial;

-- 8. Deletar histórico de patrimônio (opcional)
-- DELETE FROM patrimonio WHERE TRUE;

COMMIT;

-- ================================================================
-- Verificação dos dados restantes
-- ================================================================

-- Contar registros após limpeza
SELECT
  'Lançamentos' as tabela, COUNT(*) as registros FROM lancamentos
UNION ALL
SELECT 'Orçamentos', COUNT(*) FROM orcamentos
UNION ALL
SELECT 'Envelopes', COUNT(*) FROM envelopes_digitais
UNION ALL
SELECT 'Orçamentos Categorias', COUNT(*) FROM orcamentos_categorias
UNION ALL
SELECT 'Cartões (mantidos)', COUNT(*) FROM cartoes
UNION ALL
SELECT 'Contas (mantidas)', COUNT(*) FROM contas_bancarias
UNION ALL
SELECT 'Categorias (mantidas)', COUNT(*) FROM categorias;

-- ================================================================
-- O que foi MANTIDO:
-- ================================================================
-- ✅ Cartões de crédito
-- ✅ Contas bancárias (com saldo resetado para inicial)
-- ✅ Categorias e subcategorias
-- ✅ Configurações de usuário/família
-- ✅ Assinaturas (se quiser deletar também, descomente abaixo)

-- ================================================================
-- O que foi REMOVIDO:
-- ================================================================
-- ❌ Todas as transações/lançamentos
-- ❌ Todos os orçamentos
-- ❌ Todos os envelopes digitais
-- ❌ Todas as projeções
-- ❌ Todos os planejamentos

-- ================================================================
-- OPCIONAL: Deletar também assinaturas
-- ================================================================
-- Se quiser limpar assinaturas também, descomente:
-- DELETE FROM assinaturas;

-- ================================================================
-- OPCIONAL: Deletar patrimônio histórico
-- ================================================================
-- Se quiser resetar o patrimônio, descomente:
-- DELETE FROM patrimonio;
