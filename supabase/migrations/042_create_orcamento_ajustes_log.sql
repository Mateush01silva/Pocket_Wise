-- =============================================================================
-- MIGRATION 042: orcamento_ajustes_log  [OPCIONAL — gatilho rebalanceamentos]
-- Auditoria de alterações em categorias_budget.valor_orcado para detectar
-- rebalanceamentos manuais no orçamento corrente.
--
-- Este migration habilita o gatilho "3 ou mais rebalanceamentos no mês".
-- Sem ele, esse gatilho específico na Edge Function proativa fica DESABILITADO
-- (skip gracioso) e todos os outros gatilhos funcionam normalmente.
--
-- Recomendação de deploy:
--   Aplicar ANTES de habilitar o gatilho 'rebalanceamentos_3x' na Edge Function.
--   Uma vez ativo, começa a gravar histórico; só gatilhará após >3 registros
--   no mês corrente.
-- =============================================================================

CREATE TABLE IF NOT EXISTS orcamento_ajustes_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id       UUID NOT NULL,
  orcamento_id    UUID NOT NULL REFERENCES orcamentos_mensais(id) ON DELETE CASCADE,
  categoria_id    UUID NOT NULL REFERENCES categorias(id)         ON DELETE CASCADE,
  valor_anterior  NUMERIC(12,2) NOT NULL,
  valor_novo      NUMERIC(12,2) NOT NULL,
  ajustado_por    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ajustado_em     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lookup por família + mês (para contar rebalanceamentos no mês corrente)
CREATE INDEX IF NOT EXISTS idx_orcamento_ajustes_log_familia_mes
  ON orcamento_ajustes_log(family_id, ajustado_em DESC);

-- SQL Trigger que alimenta o log automaticamente quando valor_orcado muda
CREATE OR REPLACE FUNCTION fn_log_orcamento_ajuste()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.valor_orcado IS DISTINCT FROM NEW.valor_orcado THEN
    INSERT INTO orcamento_ajustes_log (
      family_id, orcamento_id, categoria_id, valor_anterior, valor_novo
    )
    SELECT
      om.family_id,
      NEW.orcamento_id,
      NEW.categoria_id,
      OLD.valor_orcado,
      NEW.valor_orcado
    FROM orcamentos_mensais om
    WHERE om.id = NEW.orcamento_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger no AFTER UPDATE para não bloquear a transação principal
DROP TRIGGER IF EXISTS trg_log_orcamento_ajuste ON categorias_budget;
CREATE TRIGGER trg_log_orcamento_ajuste
  AFTER UPDATE OF valor_orcado ON categorias_budget
  FOR EACH ROW EXECUTE FUNCTION fn_log_orcamento_ajuste();

-- RLS
ALTER TABLE orcamento_ajustes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orcamento_ajustes_log: service role acesso total"
  ON orcamento_ajustes_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "orcamento_ajustes_log: família lê o próprio"
  ON orcamento_ajustes_log FOR SELECT
  USING (
    family_id IN (SELECT family_id FROM users WHERE id = auth.uid())
  );

GRANT SELECT ON orcamento_ajustes_log TO authenticated;
