-- ============================================================================
-- MIGRATION 065: Reverter personal_family_id incorretamente definido pela migration 064
-- ============================================================================
-- A migration 064 tinha um 3º fallback que fazia:
--   SET personal_family_id = family_id
-- para usuários sem entrada própria em family_members.
-- Isso afetou membros convidados (ex: cônjuge) cujo family_id ativo aponta
-- para a família de outra pessoa — tornando is_personal=true para essa família
-- e quebrando a verificação de isInvitedMember no AuthContext.
-- ============================================================================

-- Resetar personal_family_id para usuários que não são admin da família
-- apontada por personal_family_id (ou seja, não é a família deles)
UPDATE public.users u
SET personal_family_id = NULL
WHERE u.personal_family_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.user_id = u.id
      AND fm.family_id = u.personal_family_id
      AND fm.role = 'admin'
  );

-- ============================================================================
-- FIM DA MIGRATION 065
-- ============================================================================
