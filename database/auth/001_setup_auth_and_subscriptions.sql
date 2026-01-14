-- ============================================================================
-- SETUP: Autenticação e Sistema de Assinaturas
-- ============================================================================
-- Este script configura todo o sistema de auth e assinaturas do Pocket_Wise
-- Executar no Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. TABELA DE ASSINATURAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('trial', 'active', 'expired', 'canceled')),
  plan VARCHAR(20) CHECK (plan IN ('monthly', 'annual')),
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_assinaturas_user_id ON assinaturas(user_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_status ON assinaturas(status);
CREATE INDEX IF NOT EXISTS idx_assinaturas_stripe_customer ON assinaturas(stripe_customer_id);

-- ============================================================================
-- 2. TABELA DE PERFIS (estende auth.users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  family_id UUID REFERENCES families(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_users_family_id ON users(family_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- 3. TRIGGER: Criar perfil e assinatura trial ao cadastrar
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar perfil do usuário
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário')
  );

  -- Criar assinatura trial de 7 dias
  INSERT INTO public.assinaturas (user_id, status, trial_ends_at)
  VALUES (
    NEW.id,
    'trial',
    NOW() + INTERVAL '7 days'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger se já existe e recriar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE handle_new_user();

-- ============================================================================
-- 4. TRIGGER: Atualizar updated_at automaticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar em tabelas relevantes
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_assinaturas_updated_at ON assinaturas;
CREATE TRIGGER update_assinaturas_updated_at
  BEFORE UPDATE ON assinaturas
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinaturas ENABLE ROW LEVEL SECURITY;

-- Políticas para USERS
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Políticas para ASSINATURAS
DROP POLICY IF EXISTS "Users can view own subscription" ON assinaturas;
CREATE POLICY "Users can view own subscription"
  ON assinaturas FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON assinaturas;
CREATE POLICY "Service role can manage all subscriptions"
  ON assinaturas FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 6. FUNÇÃO: Verificar se usuário tem acesso
-- ============================================================================

CREATE OR REPLACE FUNCTION user_has_access(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sub assinaturas%ROWTYPE;
BEGIN
  SELECT * INTO sub
  FROM assinaturas
  WHERE user_id = user_uuid;

  -- Se não tem assinatura, não tem acesso
  IF sub IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Se está em trial e ainda não expirou
  IF sub.status = 'trial' AND sub.trial_ends_at > NOW() THEN
    RETURN TRUE;
  END IF;

  -- Se tem assinatura ativa
  IF sub.status = 'active' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. FUNÇÃO: Calcular dias restantes de trial
-- ============================================================================

CREATE OR REPLACE FUNCTION trial_days_remaining(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  sub assinaturas%ROWTYPE;
  days_left INTEGER;
BEGIN
  SELECT * INTO sub
  FROM assinaturas
  WHERE user_id = user_uuid AND status = 'trial';

  IF sub IS NULL OR sub.trial_ends_at IS NULL THEN
    RETURN 0;
  END IF;

  days_left := CEIL(EXTRACT(EPOCH FROM (sub.trial_ends_at - NOW())) / 86400);

  RETURN GREATEST(0, days_left);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. JOB: Expirar trials automaticamente (executar diariamente)
-- ============================================================================

-- Nota: No Supabase, você pode configurar isso via cron job ou edge function
-- Por agora, criamos a função que pode ser chamada manualmente ou via webhook

CREATE OR REPLACE FUNCTION expire_trials()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE assinaturas
  SET status = 'expired'
  WHERE status = 'trial'
    AND trial_ends_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================

-- Log de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Sistema de autenticação e assinaturas configurado com sucesso!';
  RAISE NOTICE '📝 Próximos passos:';
  RAISE NOTICE '   1. Configure as variáveis de ambiente no seu projeto';
  RAISE NOTICE '   2. Teste criando um usuário via signup';
  RAISE NOTICE '   3. Verifique se o trial de 7 dias foi criado automaticamente';
END $$;
