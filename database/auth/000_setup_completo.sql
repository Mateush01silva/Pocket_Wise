-- ============================================================================
-- SETUP COMPLETO: Autenticação, Assinaturas e Admin
-- ============================================================================
-- Execute este script COMPLETO de uma vez no Supabase SQL Editor
-- Ele configura tudo do zero de forma segura
-- ============================================================================

-- ============================================================================
-- 1. CRIAR/ATUALIZAR TABELA DE ASSINATURAS
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
-- 2. CRIAR/ATUALIZAR TABELA DE USUÁRIOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar todas as colunas necessárias (se não existirem)
DO $$
BEGIN
  -- Coluna email
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name='users' AND column_name='email') THEN
    ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT '';
    RAISE NOTICE '✅ Coluna email adicionada';
  END IF;

  -- Coluna full_name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name='users' AND column_name='full_name') THEN
    ALTER TABLE users ADD COLUMN full_name VARCHAR(255) NOT NULL DEFAULT 'Usuário';
    RAISE NOTICE '✅ Coluna full_name adicionada';
  END IF;

  -- Coluna avatar_url
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name='users' AND column_name='avatar_url') THEN
    ALTER TABLE users ADD COLUMN avatar_url TEXT;
    RAISE NOTICE '✅ Coluna avatar_url adicionada';
  END IF;

  -- Coluna family_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name='users' AND column_name='family_id') THEN
    ALTER TABLE users ADD COLUMN family_id UUID;
    RAISE NOTICE '✅ Coluna family_id adicionada';
  END IF;

  -- Coluna role (para admin)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name='users' AND column_name='role') THEN
    ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin'));
    RAISE NOTICE '✅ Coluna role adicionada';
  END IF;
END $$;

-- Criar constraint de email único (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key') THEN
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE(email);
    RAISE NOTICE '✅ Constraint UNIQUE em email adicionada';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Constraint UNIQUE em email já existe ou erro: %', SQLERRM;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_users_family_id ON users(family_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- 3. FUNÇÕES E TRIGGERS
-- ============================================================================

-- Função: Criar perfil e assinatura trial ao cadastrar
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar perfil do usuário
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name;

  -- Criar assinatura trial de 7 dias
  INSERT INTO public.assinaturas (user_id, status, trial_ends_at)
  VALUES (
    NEW.id,
    'trial',
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Criar usuário automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE handle_new_user();

-- Função: Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Atualizar updated_at em users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- Trigger: Atualizar updated_at em assinaturas
DROP TRIGGER IF EXISTS update_assinaturas_updated_at ON assinaturas;
CREATE TRIGGER update_assinaturas_updated_at
  BEFORE UPDATE ON assinaturas
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
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
-- 5. FUNÇÕES DE NEGÓCIO
-- ============================================================================

-- Função: Verificar se usuário tem acesso (com suporte a admin)
CREATE OR REPLACE FUNCTION user_has_access(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role VARCHAR(20);
  sub assinaturas%ROWTYPE;
BEGIN
  -- Verificar se é admin
  SELECT role INTO user_role
  FROM users
  WHERE id = user_uuid;

  -- Admins têm acesso ilimitado
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Para usuários normais, verificar assinatura
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

-- Função: Calcular dias restantes de trial
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

-- Função: Expirar trials automaticamente
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

-- Função: Tornar usuário admin
CREATE OR REPLACE FUNCTION make_user_admin(user_email VARCHAR)
RETURNS VOID AS $$
BEGIN
  -- Atualizar role do usuário
  UPDATE users
  SET role = 'admin'
  WHERE email = user_email;

  -- Atualizar ou criar assinatura ativa
  INSERT INTO assinaturas (user_id, status, plan, current_period_start, current_period_end)
  SELECT id, 'active', 'annual', NOW(), NOW() + INTERVAL '100 years'
  FROM users
  WHERE email = user_email
  ON CONFLICT (user_id) DO UPDATE
  SET status = 'active',
      plan = 'annual',
      current_period_start = NOW(),
      current_period_end = NOW() + INTERVAL '100 years',
      updated_at = NOW();

  RAISE NOTICE '✅ Usuário % agora é admin com acesso ilimitado', user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FIM - MENSAGEM DE SUCESSO
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Sistema configurado com sucesso!';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Próximos passos:';
  RAISE NOTICE '   1. Execute: SELECT make_user_admin(''seu-email@exemplo.com'');';
  RAISE NOTICE '   2. Substitua pelo seu email real';
  RAISE NOTICE '   3. Recarregue a página e terá acesso ilimitado!';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
