-- =============================================================================
-- MIGRATION 056: valor_orcado_original em categorias_budget
-- Armazena o valor planejado no momento da criação do envelope para que o
-- score Pocks de Aderência ao Orçamento use o valor original, não o editado.
--
-- Regra: só punir inflação do total. Rebalanceamentos entre categorias
-- (total inalterado) não afetam o score.
-- =============================================================================

-- 1. Adiciona coluna
ALTER TABLE categorias_budget
  ADD COLUMN IF NOT EXISTS valor_orcado_original NUMERIC(12,2);

-- 2. Trigger: captura o valor no INSERT e nunca o altera em UPDATE
CREATE OR REPLACE FUNCTION fn_set_valor_orcado_original()
RETURNS TRIGGER AS $$
BEGIN
  NEW.valor_orcado_original := NEW.valor_orcado;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_valor_orcado_original ON categorias_budget;
CREATE TRIGGER trg_set_valor_orcado_original
  BEFORE INSERT ON categorias_budget
  FOR EACH ROW EXECUTE FUNCTION fn_set_valor_orcado_original();

-- 3. Backfill para registros existentes:
--    Usa o valor_anterior mais antigo do log de ajustes (= valor original antes
--    de qualquer edição). Se não houver log, usa o valor atual (sem edições).
UPDATE categorias_budget cb
SET valor_orcado_original = COALESCE(
  (
    SELECT valor_anterior
    FROM orcamento_ajustes_log
    WHERE categoria_id = cb.categoria_id
      AND orcamento_id = cb.orcamento_id
    ORDER BY ajustado_em ASC
    LIMIT 1
  ),
  cb.valor_orcado
)
WHERE valor_orcado_original IS NULL;

-- 4. Adiciona status 'fechado' como opção válida caso não exista
-- (verifica antes para não falhar se já existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'orcamento_status' AND e.enumlabel = 'fechado'
  ) THEN
    ALTER TYPE orcamento_status ADD VALUE 'fechado';
  END IF;
EXCEPTION WHEN others THEN
  NULL; -- ignora se o tipo não for enum ou já existir
END$$;
