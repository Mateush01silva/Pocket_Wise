-- Migration: Migrate Existing Families
-- Descrição: Adicionar usuários existentes como admins das suas famílias
-- Data: 2026-01-16

-- =====================================================
-- MIGRAR USUÁRIOS EXISTENTES PARA FAMILY_MEMBERS
-- =====================================================

-- Inserir todos os usuários que têm family_id como admins
-- Apenas se ainda não existem na tabela family_members
INSERT INTO family_members (family_id, user_id, role)
SELECT
  u.family_id,
  u.id,
  'admin'::family_role
FROM users u
WHERE u.family_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM family_members fm
    WHERE fm.user_id = u.id
      AND fm.family_id = u.family_id
  );

-- Comentário
COMMENT ON TABLE family_members IS 'Migração aplicada: usuários existentes adicionados como admins';
