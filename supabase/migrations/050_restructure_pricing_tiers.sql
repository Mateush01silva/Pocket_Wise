-- ============================================================================
-- MIGRATION 050: Reestruturação de Planos e Tiers
-- ============================================================================
-- Introduz três tiers: explorador, planejador, mestre
-- Migração 100% aditiva — sem ALTER em colunas existentes, sem DROP
-- ============================================================================

-- ============================================================================
-- 1. TABELA plans — catálogo de planos disponíveis
-- ============================================================================

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('explorador', 'planejador', 'mestre')),
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'annual')),
  price_cents INTEGER NOT NULL,
  asaas_plan_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plans (id, name, tier, billing_cycle, price_cents) VALUES
  ('explorador',         'Explorador 14 dias',  'explorador', null,      0),
  ('planejador_monthly', 'Planejador Mensal',    'planejador', 'monthly', 1290),
  ('planejador_annual',  'Planejador Anual',     'planejador', 'annual',  11990),
  ('mestre_monthly',     'Mestre Mensal',        'mestre',     'monthly', 1890),
  ('mestre_annual',      'Mestre Anual',         'mestre',     'annual',  17590)
ON CONFLICT (id) DO NOTHING;

-- RLS para plans (leitura pública — dados de marketing)
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans: leitura pública" ON plans;
CREATE POLICY "plans: leitura pública"
  ON plans FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "plans: service role gerencia" ON plans;
CREATE POLICY "plans: service role gerencia"
  ON plans FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2. ADICIONAR COLUNAS A plano_usuario (aditivo)
-- ============================================================================

ALTER TABLE plano_usuario
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'explorador'
    CHECK (tier IN ('explorador', 'planejador', 'mestre'));

ALTER TABLE plano_usuario
  ADD COLUMN IF NOT EXISTS plan_id TEXT REFERENCES plans(id);

-- Índices para os novos campos
CREATE INDEX IF NOT EXISTS idx_plano_usuario_tier ON plano_usuario(tier);
CREATE INDEX IF NOT EXISTS idx_plano_usuario_plan_id ON plano_usuario(plan_id);

-- ============================================================================
-- 3. BACKFILL — atribuir tier a registros existentes
-- ============================================================================

-- Trial/explorador: usuários em trial
UPDATE plano_usuario
SET tier = 'explorador',
    plan_id = 'explorador'
WHERE status = 'trial'
  AND (tier IS NULL OR tier = 'explorador');

-- Planejador mensal: assinatura ativa mensal
UPDATE plano_usuario
SET tier = 'planejador',
    plan_id = 'planejador_monthly'
WHERE status = 'active'
  AND plan = 'monthly'
  AND (tier IS NULL OR tier = 'explorador');

-- Planejador anual: assinatura ativa anual
UPDATE plano_usuario
SET tier = 'planejador',
    plan_id = 'planejador_annual'
WHERE status = 'active'
  AND plan = 'annual'
  AND (tier IS NULL OR tier = 'explorador');

-- Admins: tier mestre
UPDATE plano_usuario pu
SET tier = 'mestre'
FROM users u
WHERE pu.user_id = u.id
  AND u.role = 'admin';

-- ============================================================================
-- 4. ATUALIZAR TRIGGER handle_new_user — trial de 14 dias + tier explorador
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_family_id UUID;
  user_name TEXT;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário');

  -- 1. Criar família pessoal do usuário
  INSERT INTO public.families (nome)
  VALUES ('Família de ' || user_name)
  RETURNING id INTO new_family_id;

  -- 2. Criar perfil do usuário
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

  -- 3. Criar plano trial de 14 dias com tier explorador
  INSERT INTO public.plano_usuario (user_id, status, tier, plan_id, trial_ends_at)
  VALUES (
    NEW.id,
    'trial',
    'explorador',
    'explorador',
    NOW() + INTERVAL '14 days'
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
-- 5. ATUALIZAR FUNÇÃO user_has_access para considerar tier
-- ============================================================================

CREATE OR REPLACE FUNCTION user_has_access(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role VARCHAR(20);
  sub plano_usuario%ROWTYPE;
BEGIN
  -- Admins têm acesso total
  SELECT role INTO user_role FROM users WHERE id = user_uuid;
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  SELECT * INTO sub FROM plano_usuario WHERE user_id = user_uuid;

  IF sub IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Trial ativo
  IF sub.status = 'trial' AND sub.trial_ends_at > NOW() THEN
    RETURN TRUE;
  END IF;

  -- Assinatura ativa
  IF sub.status = 'active' THEN
    IF sub.cancel_at_period_end = TRUE AND sub.current_period_end IS NOT NULL THEN
      RETURN sub.current_period_end > NOW();
    END IF;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. ATUALIZAR FUNÇÃO expire_trials
-- ============================================================================

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
-- 7. FUNÇÃO: get_user_tier — retorna o tier atual do usuário
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_tier(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  user_role VARCHAR(20);
  sub plano_usuario%ROWTYPE;
BEGIN
  SELECT role INTO user_role FROM users WHERE id = user_uuid;
  IF user_role = 'admin' THEN
    RETURN 'mestre';
  END IF;

  SELECT * INTO sub FROM plano_usuario WHERE user_id = user_uuid;

  IF sub IS NULL THEN
    RETURN 'explorador';
  END IF;

  -- Trial expirado ou subscription expirada = explorador sem acesso
  IF sub.status IN ('expired', 'canceled') THEN
    RETURN 'explorador';
  END IF;

  RETURN COALESCE(sub.tier, 'explorador');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FIM
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 050 aplicada com sucesso!';
  RAISE NOTICE '📋 Tabela plans criada com 5 planos (explorador, planejador_monthly, planejador_annual, mestre_monthly, mestre_annual)';
  RAISE NOTICE '📋 Colunas tier e plan_id adicionadas a plano_usuario';
  RAISE NOTICE '📋 Trial atualizado para 14 dias';
  RAISE NOTICE '📋 Backfill de tier realizado para registros existentes';
  RAISE NOTICE '⚠️  Preencher plans.asaas_plan_id após configurar planos no painel Asaas';
END $$;
