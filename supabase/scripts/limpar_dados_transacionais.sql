-- ================================================================
-- Script de Limpeza de Dados Transacionais - VERSÃO SEGURA
-- ================================================================
-- Este script remove todos os dados de transações, orçamentos e
-- envelopes, mas mantém as configurações (cartões, contas, categorias)
--
-- USO: Execute este script no Supabase SQL Editor
-- IMPORTANTE: Verifica se as tabelas existem antes de deletar
-- ================================================================

BEGIN;

-- 1. Deletar todos os lançamentos (transações)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'lancamentos') THEN
        DELETE FROM lancamentos;
        RAISE NOTICE '✓ Lançamentos deletados';
    ELSE
        RAISE NOTICE '⊘ Tabela lancamentos não existe';
    END IF;
END $$;

-- 2. Deletar todos os orçamentos
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'orcamentos') THEN
        DELETE FROM orcamentos;
        RAISE NOTICE '✓ Orçamentos deletados';
    ELSE
        RAISE NOTICE '⊘ Tabela orcamentos não existe';
    END IF;
END $$;

-- 3. Deletar todos os envelopes digitais
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'envelopes_digitais') THEN
        DELETE FROM envelopes_digitais;
        RAISE NOTICE '✓ Envelopes digitais deletados';
    ELSE
        RAISE NOTICE '⊘ Tabela envelopes_digitais não existe';
    END IF;
END $$;

-- 4. Deletar todos os orçamentos por categoria
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'orcamentos_categorias') THEN
        DELETE FROM orcamentos_categorias;
        RAISE NOTICE '✓ Orçamentos categorias deletados';
    ELSE
        RAISE NOTICE '⊘ Tabela orcamentos_categorias não existe';
    END IF;
END $$;

-- 5. Deletar planejamentos (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'planejamentos') THEN
        DELETE FROM planejamentos;
        RAISE NOTICE '✓ Planejamentos deletados';
    ELSE
        RAISE NOTICE '⊘ Tabela planejamentos não existe';
    END IF;
END $$;

-- 6. Deletar receitas projetadas (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'receitas_projetadas') THEN
        DELETE FROM receitas_projetadas;
        RAISE NOTICE '✓ Receitas projetadas deletadas';
    ELSE
        RAISE NOTICE '⊘ Tabela receitas_projetadas não existe';
    END IF;
END $$;

-- 7. Resetar saldos das contas bancárias para o saldo inicial
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contas_bancarias') THEN
        UPDATE contas_bancarias SET saldo_atual = saldo_inicial;
        RAISE NOTICE '✓ Saldos das contas resetados';
    ELSE
        RAISE NOTICE '⊘ Tabela contas_bancarias não existe';
    END IF;
END $$;

-- 8. Deletar histórico de patrimônio (OPCIONAL - descomente se quiser)
-- DO $$
-- BEGIN
--     IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'patrimonio') THEN
--         DELETE FROM patrimonio;
--         RAISE NOTICE '✓ Patrimônio deletado';
--     END IF;
-- END $$;

-- 9. Deletar assinaturas (OPCIONAL - descomente se quiser)
-- DO $$
-- BEGIN
--     IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'assinaturas') THEN
--         DELETE FROM assinaturas;
--         RAISE NOTICE '✓ Assinaturas deletadas';
--     END IF;
-- END $$;

COMMIT;

RAISE NOTICE '═══════════════════════════════════════════════';
RAISE NOTICE '🎉 Limpeza concluída com sucesso!';
RAISE NOTICE '═══════════════════════════════════════════════';

-- ================================================================
-- Verificação dos dados restantes
-- ================================================================

SELECT
  'lancamentos' as tabela,
  CASE
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'lancamentos')
    THEN (SELECT COUNT(*)::text FROM lancamentos)
    ELSE 'tabela não existe'
  END as registros
UNION ALL
SELECT
  'orcamentos',
  CASE
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'orcamentos')
    THEN (SELECT COUNT(*)::text FROM orcamentos)
    ELSE 'tabela não existe'
  END
UNION ALL
SELECT
  'envelopes_digitais',
  CASE
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'envelopes_digitais')
    THEN (SELECT COUNT(*)::text FROM envelopes_digitais)
    ELSE 'tabela não existe'
  END
UNION ALL
SELECT
  'orcamentos_categorias',
  CASE
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'orcamentos_categorias')
    THEN (SELECT COUNT(*)::text FROM orcamentos_categorias)
    ELSE 'tabela não existe'
  END
UNION ALL
SELECT
  'cartoes (mantidos)',
  CASE
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cartoes')
    THEN (SELECT COUNT(*)::text FROM cartoes)
    ELSE 'tabela não existe'
  END
UNION ALL
SELECT
  'contas_bancarias (mantidas)',
  CASE
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contas_bancarias')
    THEN (SELECT COUNT(*)::text FROM contas_bancarias)
    ELSE 'tabela não existe'
  END
UNION ALL
SELECT
  'categorias (mantidas)',
  CASE
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categorias')
    THEN (SELECT COUNT(*)::text FROM categorias)
    ELSE 'tabela não existe'
  END;

-- ================================================================
-- O que foi MANTIDO:
-- ================================================================
-- ✅ Cartões de crédito
-- ✅ Contas bancárias (com saldo resetado para inicial)
-- ✅ Categorias e subcategorias
-- ✅ Configurações de usuário/família
-- ✅ Assinaturas (se não descomentou)
-- ✅ Patrimônio (se não descomentou)

-- ================================================================
-- O que foi REMOVIDO (se existiam):
-- ================================================================
-- ❌ Todas as transações/lançamentos
-- ❌ Todos os orçamentos
-- ❌ Todos os envelopes digitais
-- ❌ Todas as projeções
-- ❌ Todos os planejamentos
