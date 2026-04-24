-- ============================================================================
-- MIGRATION 057: Suporte a Consultor Financeiro
-- Estritamente aditiva — não altera nem remove nada existente
-- ============================================================================

-- ============================================================================
-- 1. Coluna member_type em family_invites
--    DEFAULT 'familiar' preserva todos os registros existentes sem alteração
-- ============================================================================
ALTER TABLE family_invites
  ADD COLUMN IF NOT EXISTS member_type TEXT NOT NULL DEFAULT 'familiar'
    CHECK (member_type IN ('familiar', 'consultor'));

-- Permissões do consultor embutidas no convite (JSONB, null para convites familiares)
ALTER TABLE family_invites
  ADD COLUMN IF NOT EXISTS consultant_permissions JSONB;

-- ============================================================================
-- 2. Coluna member_type em family_members
--    DEFAULT 'familiar' preserva todos os registros existentes sem alteração
-- ============================================================================
ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS member_type TEXT NOT NULL DEFAULT 'familiar'
    CHECK (member_type IN ('familiar', 'consultor'));

-- ============================================================================
-- 3. Índice único parcial: no máximo 1 consultor ativo por família
--    Não afeta membros familiares (WHERE member_type = 'consultor')
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_consultant_per_family
  ON family_members (family_id)
  WHERE member_type = 'consultor';

-- ============================================================================
-- 4. Tabela consultant_permissions
--    Armazena as permissões granulares do consultor após aceitar o convite
-- ============================================================================
CREATE TABLE IF NOT EXISTS consultant_permissions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_member_id      UUID NOT NULL UNIQUE REFERENCES family_members(id) ON DELETE CASCADE,
  family_id             UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,

  -- Permissões de edição/criação
  can_create_envelopes  BOOLEAN NOT NULL DEFAULT false,
  can_create_categories BOOLEAN NOT NULL DEFAULT false,
  can_manage_accounts   BOOLEAN NOT NULL DEFAULT false,

  -- Permissões de visualização
  can_view_envelopes    BOOLEAN NOT NULL DEFAULT true,
  can_view_pocks        BOOLEAN NOT NULL DEFAULT true,
  can_view_caixinhas    BOOLEAN NOT NULL DEFAULT true,

  -- Transações e Posso Comprar? são sempre bloqueados por design
  -- (não há colunas para eles — ausência é a restrição)

  -- Perfil base selecionado ao gerar o convite (informativo)
  profile_preset        TEXT CHECK (profile_preset IN ('configurador', 'acompanhador', 'custom')),

  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_consultant_permissions_family_id
  ON consultant_permissions (family_id);

CREATE INDEX IF NOT EXISTS idx_consultant_permissions_family_member_id
  ON consultant_permissions (family_member_id);

-- Trigger updated_at (reutiliza função existente update_updated_at_column)
CREATE TRIGGER trigger_update_consultant_permissions_updated_at
  BEFORE UPDATE ON consultant_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. RLS para consultant_permissions
-- ============================================================================
ALTER TABLE consultant_permissions ENABLE ROW LEVEL SECURITY;

-- Admin da família pode ver e gerenciar permissões do consultor
CREATE POLICY "Admins can manage consultant permissions"
  ON consultant_permissions
  USING (
    family_id IN (
      SELECT fm.family_id FROM family_members fm
      WHERE fm.user_id = auth.uid() AND fm.role = 'admin'
    )
  )
  WITH CHECK (
    family_id IN (
      SELECT fm.family_id FROM family_members fm
      WHERE fm.user_id = auth.uid() AND fm.role = 'admin'
    )
  );

-- Consultor pode ver suas próprias permissões
CREATE POLICY "Consultants can view their own permissions"
  ON consultant_permissions FOR SELECT
  USING (
    family_member_id IN (
      SELECT id FROM family_members
      WHERE user_id = auth.uid() AND member_type = 'consultor'
    )
  );

-- ============================================================================
-- FIM DA MIGRATION 057
-- ============================================================================
