-- ============================================================================
-- MIGRATION: Adicionar cancel_at_period_end ao plano_usuario
-- ============================================================================
-- Quando o usuário cancela, mantém acesso até o fim do período pago.
-- cancel_at_period_end = true: assinatura será cancelada no fim do período
-- ============================================================================

ALTER TABLE plano_usuario
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- Atualizar função de acesso para considerar cancel_at_period_end
CREATE OR REPLACE FUNCTION user_has_access(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role VARCHAR(20);
  sub plano_usuario%ROWTYPE;
BEGIN
  SELECT role INTO user_role FROM users WHERE id = user_uuid;
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  SELECT * INTO sub FROM plano_usuario WHERE user_id = user_uuid;

  IF sub IS NULL THEN
    RETURN FALSE;
  END IF;

  IF sub.status = 'trial' AND sub.trial_ends_at > NOW() THEN
    RETURN TRUE;
  END IF;

  IF sub.status = 'active' THEN
    -- Se cancelou mas período ainda não acabou, mantém acesso
    IF sub.cancel_at_period_end = TRUE AND sub.current_period_end IS NOT NULL THEN
      RETURN sub.current_period_end > NOW();
    END IF;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
