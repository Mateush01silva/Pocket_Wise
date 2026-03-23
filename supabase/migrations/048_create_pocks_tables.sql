-- ============================================================
-- Migration 048: Sistema Pocks — Score de Saúde Financeira
-- Apenas CREATE (nunca ALTER/DROP em tabelas existentes)
-- ============================================================

-- Scores mensais por família
CREATE TABLE IF NOT EXISTS pocks_monthly_scores (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id          UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  month              DATE NOT NULL,              -- primeiro dia do mês (YYYY-MM-01)
  total_score        INTEGER NOT NULL DEFAULT 0,
  criteria_breakdown JSONB NOT NULL DEFAULT '{}',
  bonuses            JSONB NOT NULL DEFAULT '[]',
  calculated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT uq_pocks_family_month UNIQUE (family_id, month)
);

-- Dados de streak por família
CREATE TABLE IF NOT EXISTS pocks_streak_data (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id            UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE UNIQUE,
  current_streak       INTEGER NOT NULL DEFAULT 0,
  best_streak          INTEGER NOT NULL DEFAULT 0,
  last_on_budget_month DATE,
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pocks_scores_family_month
  ON pocks_monthly_scores(family_id, month DESC);

-- ============================================================
-- RLS — Row Level Security
-- Padrão idêntico ao de historico_rebalanceamentos (migration 007)
-- ============================================================

ALTER TABLE pocks_monthly_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pocks_streak_data    ENABLE ROW LEVEL SECURITY;

-- pocks_monthly_scores: membros da família podem ver e modificar
CREATE POLICY "Family members can view pocks scores"
  ON pocks_monthly_scores FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Family members can insert pocks scores"
  ON pocks_monthly_scores FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Family members can update pocks scores"
  ON pocks_monthly_scores FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- pocks_streak_data: membros da família podem ver e modificar
CREATE POLICY "Family members can view pocks streak"
  ON pocks_streak_data FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Family members can insert pocks streak"
  ON pocks_streak_data FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Family members can update pocks streak"
  ON pocks_streak_data FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );
