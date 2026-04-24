-- ============================================================================
-- MIGRATION 059: Corrigir get_invite_by_token para manter formato plano
-- ============================================================================
-- PROBLEMA:
--   A migration 058 substituiu get_invite_by_token por uma versão que envolve
--   o resultado em { success, data } — mas familyInvitesService.getInviteByToken
--   espera o objeto do convite diretamente (data.status, data.expires_at, etc.).
--   Isso causava "Invite is undefined" ao acessar links de convite.
--
-- SOLUÇÃO:
--   Restaurar o formato plano original (igual à migration 026), adicionando
--   apenas os dois novos campos: member_type e consultant_permissions.
--   familyService.ts continua funcionando sem nenhuma alteração.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_invite_by_token(invite_token TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Marcar convites expirados primeiro
  UPDATE family_invites
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();

  SELECT json_build_object(
    'id',                    fi.id,
    'family_id',             fi.family_id,
    'invited_by',            fi.invited_by,
    'invited_email',         fi.invited_email,
    'token',                 fi.token,
    'role',                  fi.role,
    'status',                fi.status,
    'message',               fi.message,
    'expires_at',            fi.expires_at,
    'accepted_at',           fi.accepted_at,
    'accepted_by',           fi.accepted_by,
    'created_at',            fi.created_at,
    'family_name',           f.nome,
    'invited_by_name',       u.nome,
    -- Novos campos para suporte ao consultor (null para convites familiares)
    'member_type',           COALESCE(fi.member_type, 'familiar'),
    'consultant_permissions', fi.consultant_permissions
  )
  INTO result
  FROM family_invites fi
  JOIN families f ON fi.family_id = f.id
  JOIN users    u ON fi.invited_by  = u.id
  WHERE fi.token = invite_token;

  -- Retorna NULL se o token não existir (frontend trata como "Invite not found")
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Manter grants existentes
GRANT EXECUTE ON FUNCTION get_invite_by_token(TEXT) TO anon, authenticated;

-- ============================================================================
-- FIM DA MIGRATION 059
-- ============================================================================
