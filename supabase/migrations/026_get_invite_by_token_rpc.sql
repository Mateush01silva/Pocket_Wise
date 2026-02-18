-- Migration 026: RPC SECURITY DEFINER para buscar convite por token
-- ============================================================================
--
-- PROBLEMA:
--   A view family_invites_with_details com security_invoker=true gera o erro
--   PGRST103 "Cannot coerce the result to a single JSON object" ao ser
--   consultada com .single(). Este erro ocorre quando o PostgREST retorna
--   múltiplas linhas (schema cache desatualizado ou duplicatas inesperadas)
--   ou quando a configuração do PostgREST conflita com a view.
--
-- SOLUÇÃO:
--   Criar uma função SECURITY DEFINER específica para o lookup por token,
--   exatamente como accept_family_invite já faz para o aceite.
--   A função:
--     1. Bypassa RLS — necessário para anon ver family_name e invited_by_name
--     2. Retorna exatamente 1 objeto JSON ou NULL (sem risco de PGRST103)
--     3. Funciona para usuários anônimos e autenticados
--
-- SEGURANÇA:
--   O token é uma string aleatória de 32 caracteres (62^32 combinações),
--   impossível de adivinhar por força bruta. A função só expõe dados de
--   um convite específico, nenhum dado sensível de outros registros.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_invite_by_token(invite_token TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id',              fi.id,
    'family_id',       fi.family_id,
    'invited_by',      fi.invited_by,
    'invited_email',   fi.invited_email,
    'token',           fi.token,
    'role',            fi.role,
    'status',          fi.status,
    'message',         fi.message,
    'expires_at',      fi.expires_at,
    'accepted_at',     fi.accepted_at,
    'accepted_by',     fi.accepted_by,
    'created_at',      fi.created_at,
    'family_name',     f.nome,
    'invited_by_name', u.nome
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

-- Permitir chamada por usuários anônimos (link de convite) e autenticados
GRANT EXECUTE ON FUNCTION get_invite_by_token(TEXT) TO anon, authenticated;
