-- ============================================================================
-- MIGRATION 021: Garantir GRANT EXECUTE para accept_family_invite
-- ============================================================================
--
-- PROBLEMA:
--   A função accept_family_invite (migration 017) foi criada sem GRANT EXECUTE
--   para o role 'authenticated'. Isso faz com que usuários autenticados recebam
--   erro de permissão ao tentar aceitar convites, aparecendo como "Erro
--   desconhecido" no frontend devido a um bug de stale state.
--
-- SOLUÇÃO:
--   Adicionar GRANT EXECUTE para o role 'authenticated'.
-- ============================================================================

GRANT EXECUTE ON FUNCTION accept_family_invite(TEXT) TO authenticated;
