-- Função pública para retornar estatísticas da plataforma (landing page)
-- Usa SECURITY DEFINER para bypassar RLS e acessar dados agregados
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM users),
    'total_transactions', (SELECT COUNT(*) FROM lancamentos),
    'total_money_managed', (SELECT COALESCE(SUM(ABS(valor)), 0) FROM lancamentos)
  ) INTO result;

  RETURN result;
END;
$$;

-- Permitir que qualquer usuário (incluindo anon) chame esta função
GRANT EXECUTE ON FUNCTION get_platform_stats() TO anon;
GRANT EXECUTE ON FUNCTION get_platform_stats() TO authenticated;
