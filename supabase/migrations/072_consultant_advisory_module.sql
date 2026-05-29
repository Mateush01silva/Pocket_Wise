-- ============================================================
-- Migration 072: Consultant Advisory Module
-- Phases 1-3: diagnostics, goals, debts, session notes
-- ADDITIVE ONLY — no ALTER, no DROP
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PHASE 1: Diagnostic sessions
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consultant_diagnostics (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id                     UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  consultant_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  renda_liquida_mensal          DECIMAL(12,2) NOT NULL CHECK (renda_liquida_mensal >= 0),
  gastos_fixos_mensais          DECIMAL(12,2) NOT NULL CHECK (gastos_fixos_mensais >= 0),
  -- Calculated fields stored at snapshot time
  total_parcelas_dividas        DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total_parcelas_dividas >= 0),
  percentual_comprometimento    DECIMAL(5,2),
  saldo_disponivel              DECIMAL(12,2),
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consultant_diagnostic_goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id   UUID NOT NULL REFERENCES consultant_diagnostics(id) ON DELETE CASCADE,
  family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  descricao       TEXT NOT NULL,
  prazo_meses     INT,
  valor_alvo      DECIMAL(12,2),
  prioridade      INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- PHASE 2: Structured debts
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consultant_debts (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id                 UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  diagnostic_id             UUID REFERENCES consultant_diagnostics(id) ON DELETE SET NULL,
  -- Debt details
  credor                    VARCHAR(100) NOT NULL,
  saldo_devedor             DECIMAL(12,2) NOT NULL CHECK (saldo_devedor >= 0),
  taxa_juros                DECIMAL(8,4),
  taxa_juros_tipo           TEXT NOT NULL DEFAULT 'mensal' CHECK (taxa_juros_tipo IN ('mensal', 'anual')),
  parcelas_restantes        INT CHECK (parcelas_restantes >= 0),
  valor_parcela             DECIMAL(12,2) CHECK (valor_parcela >= 0),
  data_vencimento           DATE,
  -- Envelope suggestion (set by consultant)
  envelope_mensal_sugerido  DECIMAL(12,2),
  envelope_ajustado         DECIMAL(12,2),
  -- Link to existing envelope system (categoria created specifically for this debt)
  categoria_id              UUID REFERENCES categorias(id) ON DELETE SET NULL,
  -- Lifecycle
  status                    TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'quitada', 'renegociada')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- PHASE 3: Session notes (private to consultant)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consultant_session_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  consultant_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  content         TEXT NOT NULL,
  next_steps      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_consultant_diagnostics_family
  ON consultant_diagnostics(family_id);

CREATE INDEX IF NOT EXISTS idx_consultant_diagnostics_consultant
  ON consultant_diagnostics(consultant_id);

CREATE INDEX IF NOT EXISTS idx_consultant_diagnostic_goals_diagnostic
  ON consultant_diagnostic_goals(diagnostic_id);

CREATE INDEX IF NOT EXISTS idx_consultant_debts_family
  ON consultant_debts(family_id);

CREATE INDEX IF NOT EXISTS idx_consultant_debts_diagnostic
  ON consultant_debts(diagnostic_id);

CREATE INDEX IF NOT EXISTS idx_consultant_session_notes_family_date
  ON consultant_session_notes(family_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_consultant_session_notes_consultant
  ON consultant_session_notes(consultant_id);

-- ────────────────────────────────────────────────────────────
-- RLS POLICIES
-- ────────────────────────────────────────────────────────────

ALTER TABLE consultant_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultant_diagnostic_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultant_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultant_session_notes ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a consultant for a given family?
-- Reuses family_members table (existing, no changes)

-- consultant_diagnostics
CREATE POLICY "Consultor pode ver diagnósticos dos seus clientes"
  ON consultant_diagnostics FOR SELECT
  USING (
    family_id IN (
      SELECT fm.family_id FROM family_members fm
      WHERE fm.user_id = auth.uid()
      AND fm.member_type = 'consultor'
    )
    OR consultant_id = auth.uid()
  );

CREATE POLICY "Consultor pode criar diagnósticos para seus clientes"
  ON consultant_diagnostics FOR INSERT
  WITH CHECK (
    consultant_id = auth.uid()
    AND family_id IN (
      SELECT fm.family_id FROM family_members fm
      WHERE fm.user_id = auth.uid()
      AND fm.member_type = 'consultor'
    )
  );

CREATE POLICY "Consultor pode atualizar diagnósticos que criou"
  ON consultant_diagnostics FOR UPDATE
  USING (consultant_id = auth.uid())
  WITH CHECK (consultant_id = auth.uid());

-- consultant_diagnostic_goals
CREATE POLICY "Consultor pode ver metas dos seus clientes"
  ON consultant_diagnostic_goals FOR SELECT
  USING (
    family_id IN (
      SELECT fm.family_id FROM family_members fm
      WHERE fm.user_id = auth.uid()
      AND fm.member_type = 'consultor'
    )
  );

CREATE POLICY "Consultor pode criar metas"
  ON consultant_diagnostic_goals FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT fm.family_id FROM family_members fm
      WHERE fm.user_id = auth.uid()
      AND fm.member_type = 'consultor'
    )
  );

CREATE POLICY "Consultor pode atualizar metas"
  ON consultant_diagnostic_goals FOR UPDATE
  USING (
    family_id IN (
      SELECT fm.family_id FROM family_members fm
      WHERE fm.user_id = auth.uid()
      AND fm.member_type = 'consultor'
    )
  );

CREATE POLICY "Consultor pode excluir metas"
  ON consultant_diagnostic_goals FOR DELETE
  USING (
    family_id IN (
      SELECT fm.family_id FROM family_members fm
      WHERE fm.user_id = auth.uid()
      AND fm.member_type = 'consultor'
    )
  );

-- consultant_debts
CREATE POLICY "Consultor pode ver dívidas dos seus clientes"
  ON consultant_debts FOR SELECT
  USING (
    family_id IN (
      SELECT fm.family_id FROM family_members fm
      WHERE fm.user_id = auth.uid()
      AND fm.member_type = 'consultor'
    )
  );

CREATE POLICY "Consultor pode criar dívidas"
  ON consultant_debts FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT fm.family_id FROM family_members fm
      WHERE fm.user_id = auth.uid()
      AND fm.member_type = 'consultor'
    )
  );

CREATE POLICY "Consultor pode atualizar dívidas"
  ON consultant_debts FOR UPDATE
  USING (
    family_id IN (
      SELECT fm.family_id FROM family_members fm
      WHERE fm.user_id = auth.uid()
      AND fm.member_type = 'consultor'
    )
  );

CREATE POLICY "Consultor pode excluir dívidas"
  ON consultant_debts FOR DELETE
  USING (
    family_id IN (
      SELECT fm.family_id FROM family_members fm
      WHERE fm.user_id = auth.uid()
      AND fm.member_type = 'consultor'
    )
  );

-- consultant_session_notes (PRIVATE — only consultant, never client)
CREATE POLICY "Consultor vê apenas suas próprias notas"
  ON consultant_session_notes FOR SELECT
  USING (consultant_id = auth.uid());

CREATE POLICY "Consultor cria notas vinculadas a clientes seus"
  ON consultant_session_notes FOR INSERT
  WITH CHECK (
    consultant_id = auth.uid()
    AND family_id IN (
      SELECT fm.family_id FROM family_members fm
      WHERE fm.user_id = auth.uid()
      AND fm.member_type = 'consultor'
    )
  );

CREATE POLICY "Consultor atualiza suas próprias notas"
  ON consultant_session_notes FOR UPDATE
  USING (consultant_id = auth.uid())
  WITH CHECK (consultant_id = auth.uid());

CREATE POLICY "Consultor exclui suas próprias notas"
  ON consultant_session_notes FOR DELETE
  USING (consultant_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- updated_at triggers
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_consultant_diagnostics
  BEFORE UPDATE ON consultant_diagnostics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_consultant_debts
  BEFORE UPDATE ON consultant_debts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_consultant_session_notes
  BEFORE UPDATE ON consultant_session_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
