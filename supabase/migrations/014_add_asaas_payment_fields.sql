-- ============================================================================
-- MIGRATION: Criar tabela plano_usuario + Integração Asaas
-- ============================================================================
-- A tabela "assinaturas" já é usada para assinaturas do usuário (Netflix, etc.)
-- Esta migration cria "plano_usuario" para o plano SaaS do Pocket Wise
-- (trial, monthly, annual) com integração Asaas.
-- ============================================================================

-- ============================================================================
-- 1. CRIAR TABELA PLANO_USUARIO (plano SaaS do app)
-- ============================================================================

CREATE TABLE IF NOT EXISTS plano_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('trial', 'active', 'expired', 'canceled')),
  plan VARCHAR(20) CHECK (plan IN ('monthly', 'annual')),
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  asaas_customer_id VARCHAR(255),
  asaas_subscription_id VARCHAR(255),
  asaas_payment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_plano_usuario_user_id ON plano_usuario(user_id);
CREATE INDEX IF NOT EXISTS idx_plano_usuario_status ON plano_usuario(status);
CREATE INDEX IF NOT EXISTS idx_plano_usuario_asaas_customer ON plano_usuario(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_plano_usuario_asaas_subscription ON plano_usuario(asaas_subscription_id);

-- ============================================================================
-- 2. RLS (Row Level Security)
-- ============================================================================

ALTER TABLE plano_usuario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own plan" ON plano_usuario;
CREATE POLICY "Users can view own plan"
  ON plano_usuario FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all plans" ON plano_usuario;
CREATE POLICY "Service role can manage all plans"
  ON plano_usuario FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 3. TRIGGER: updated_at automático
-- ============================================================================

DROP TRIGGER IF EXISTS update_plano_usuario_updated_at ON plano_usuario;
CREATE TRIGGER update_plano_usuario_updated_at
  BEFORE UPDATE ON plano_usuario
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================================
-- 4. ATUALIZAR TRIGGER de novo usuário para criar trial em plano_usuario
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_family_id UUID;
  user_name TEXT;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário');

  -- 1. Criar uma nova família para o usuário
  INSERT INTO public.families (nome)
  VALUES ('Família de ' || user_name)
  RETURNING id INTO new_family_id;

  -- 2. Criar perfil do usuário com family_id (inclui nome E full_name)
  INSERT INTO public.users (id, email, nome, full_name, family_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    user_name,
    user_name,
    new_family_id
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      nome = EXCLUDED.nome,
      full_name = EXCLUDED.full_name,
      family_id = COALESCE(users.family_id, EXCLUDED.family_id);

  -- 3. Criar plano trial de 7 dias (em plano_usuario, NÃO em assinaturas)
  INSERT INTO public.plano_usuario (user_id, status, trial_ends_at)
  VALUES (
    NEW.id,
    'trial',
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE handle_new_user();

-- ============================================================================
-- 5. FUNÇÕES DE ACESSO (atualizadas para plano_usuario)
-- ============================================================================

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
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trial_days_remaining(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  sub plano_usuario%ROWTYPE;
  days_left INTEGER;
BEGIN
  SELECT * INTO sub FROM plano_usuario WHERE user_id = user_uuid AND status = 'trial';

  IF sub IS NULL OR sub.trial_ends_at IS NULL THEN
    RETURN 0;
  END IF;

  days_left := CEIL(EXTRACT(EPOCH FROM (sub.trial_ends_at - NOW())) / 86400);
  RETURN GREATEST(0, days_left);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION expire_trials()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE plano_usuario
  SET status = 'expired'
  WHERE status = 'trial'
    AND trial_ends_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. FUNÇÃO: Tornar usuário admin (atualizada)
-- ============================================================================

CREATE OR REPLACE FUNCTION make_user_admin(user_email VARCHAR)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET role = 'admin' WHERE email = user_email;

  INSERT INTO plano_usuario (user_id, status, plan)
  SELECT id, 'active', 'annual'
  FROM users WHERE email = user_email
  ON CONFLICT (user_id) DO UPDATE
  SET status = 'active',
      plan = 'annual',
      current_period_start = NOW(),
      current_period_end = NOW() + INTERVAL '100 years',
      updated_at = NOW();

  RAISE NOTICE 'Usuário % agora é admin com acesso ilimitado', user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. MIGRAR DADOS: Criar trial para usuários que não têm plano
-- ============================================================================

INSERT INTO plano_usuario (user_id, status, trial_ends_at)
SELECT u.id, 'trial', NOW() + INTERVAL '7 days'
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM plano_usuario p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- FIM
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Tabela plano_usuario criada com sucesso!';
  RAISE NOTICE '📝 "assinaturas" = assinaturas do usuário (Netflix, Spotify, etc.)';
  RAISE NOTICE '📝 "plano_usuario" = plano SaaS do Pocket Wise (trial/active/expired)';
END $$;
