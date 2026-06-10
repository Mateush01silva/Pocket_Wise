-- =====================================================
-- Migration: Um lançamento por assinatura por mês
-- Description: A sincronização de assinaturas verificava "já existe
--              lançamento neste mês?" contra a lista em memória do cliente
--              (Zustand), não contra o banco — um segundo dispositivo (ou
--              estado desatualizado) gerava lançamentos duplicados da mesma
--              assinatura. Esta migration:
--                1. Remove duplicatas existentes (mantendo, por mês, o
--                   lançamento pago — se houver — ou o mais antigo; o trigger
--                   de saldo reverte corretamente os pagos removidos)
--                2. Cria índice UNIQUE parcial (assinatura_id, mês da data)
--              O cliente também passa a checar no banco antes de criar.
-- =====================================================

DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN
    SELECT
      (array_agg(id ORDER BY (status = 'pago') DESC, created_at, id)) AS ids
    FROM lancamentos
    WHERE assinatura_id IS NOT NULL
    GROUP BY assinatura_id, date_trunc('month', data)
    HAVING COUNT(*) > 1
  LOOP
    DELETE FROM lancamentos WHERE id = ANY(dup.ids[2:]);
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_lancamento_assinatura_mes
  ON lancamentos (assinatura_id, date_trunc('month', data))
  WHERE assinatura_id IS NOT NULL;
