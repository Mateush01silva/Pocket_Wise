-- ============================================================================
-- MIGRATION 022: GRANT EXECUTE para RPCs de multi-família (migration 016)
-- ============================================================================
--
-- PROBLEMA:
--   As funções get_user_families() e switch_active_family() foram criadas na
--   migration 016 sem GRANT EXECUTE para o role 'authenticated'. Isso impede
--   que usuários autenticados (como membros convidados) chamem essas funções,
--   causando:
--     - FamilySwitcher não aparecer após aceitar convite (userFamilies fica [])
--     - Impossibilidade de trocar de família
--
-- SOLUÇÃO:
--   Adicionar GRANT EXECUTE para o role 'authenticated'.
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_user_families() TO authenticated;
GRANT EXECUTE ON FUNCTION switch_active_family(UUID) TO authenticated;
