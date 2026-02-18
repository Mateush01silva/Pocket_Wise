-- Migration 025: Corrigir visibilidade de membros e acesso anônimo a convites
-- Problemas identificados após migration 024:
--
-- BUG 1: Membros desaparecem da família
--   Causa: family_members_with_user usa INNER JOIN com users + security_invoker=true.
--   A policy RLS do users filtra por users.family_id, que é a família ATIVA do usuário.
--   Se um membro aceitou convite mas depois voltou para a família pessoal como ativa,
--   seu users.family_id ≠ família do admin → INNER JOIN descarta o membro.
--   Solução: LEFT JOIN em users para que todos os membros apareçam mesmo que
--   a policy de users bloqueie os detalhes daquele usuário.
--
-- BUG 2: "Cannot coerce the result to a single JSON object" na página de aceitar convite
--   Causa: O DROP VIEW CASCADE da migration 024 apagou os grants existentes na view.
--   A migration 024 só restaurou GRANT SELECT TO authenticated, mas a página de aceitar
--   convite é acessada por usuários anônimos (antes do login). O role anon perdeu acesso.
--   Solução: GRANT SELECT ON family_invites_with_details TO anon.

-- =====================================================
-- FIX 1: family_members_with_user - INNER JOIN → LEFT JOIN
-- =====================================================

DROP VIEW IF EXISTS family_members_with_user CASCADE;

CREATE VIEW family_members_with_user
WITH (security_invoker = true)
AS
SELECT
  fm.id,
  fm.family_id,
  fm.user_id,
  fm.role,
  fm.joined_at,
  u.nome as user_name,
  u.patrimonio_base,
  u.created_at as user_created_at
FROM family_members fm
LEFT JOIN users u ON fm.user_id = u.id;

GRANT SELECT ON family_members_with_user TO authenticated;

-- =====================================================
-- FIX 2: Restaurar acesso anônimo a family_invites_with_details
-- O DROP VIEW da migration 024 apagou o grant padrão para anon.
-- =====================================================

GRANT SELECT ON family_invites_with_details TO anon;

-- =====================================================
-- Forçar reload do schema cache do PostgREST
-- Garante que a API reflita imediatamente as mudanças nas views
-- =====================================================

NOTIFY pgrst, 'reload schema';
