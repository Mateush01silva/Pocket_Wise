-- ============================================================================
-- MIGRATION: Adicionar campos Asaas na tabela de assinaturas (plano SaaS)
-- ============================================================================
-- Substitui campos Stripe por campos Asaas para integração de pagamentos
-- ============================================================================

-- 1. Adicionar campos Asaas
DO $$
BEGIN
  -- ID do cliente na Asaas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='assinaturas' AND column_name='asaas_customer_id') THEN
    ALTER TABLE assinaturas ADD COLUMN asaas_customer_id VARCHAR(255);
  END IF;

  -- ID da assinatura na Asaas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='assinaturas' AND column_name='asaas_subscription_id') THEN
    ALTER TABLE assinaturas ADD COLUMN asaas_subscription_id VARCHAR(255);
  END IF;

  -- URL de pagamento (checkout da Asaas)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='assinaturas' AND column_name='asaas_payment_url') THEN
    ALTER TABLE assinaturas ADD COLUMN asaas_payment_url TEXT;
  END IF;
END $$;

-- 2. Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_assinaturas_asaas_customer ON assinaturas(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_asaas_subscription ON assinaturas(asaas_subscription_id);

-- 3. Remover campos Stripe antigos (se existirem)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='assinaturas' AND column_name='stripe_customer_id') THEN
    -- Remover índice primeiro
    DROP INDEX IF EXISTS idx_assinaturas_stripe_customer;
    ALTER TABLE assinaturas DROP COLUMN stripe_customer_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='assinaturas' AND column_name='stripe_subscription_id') THEN
    ALTER TABLE assinaturas DROP COLUMN stripe_subscription_id;
  END IF;
END $$;

-- ============================================================================
-- 4. FUNÇÃO: Ativar assinatura após pagamento confirmado
-- ============================================================================
-- Chamada pelo webhook da Asaas quando o pagamento é confirmado

CREATE OR REPLACE FUNCTION activate_subscription(
  p_user_id UUID,
  p_plan VARCHAR(20),
  p_asaas_customer_id VARCHAR(255),
  p_asaas_subscription_id VARCHAR(255)
)
RETURNS VOID AS $$
BEGIN
  UPDATE assinaturas
  SET
    status = 'active',
    plan = p_plan,
    asaas_customer_id = p_asaas_customer_id,
    asaas_subscription_id = p_asaas_subscription_id,
    current_period_start = NOW(),
    current_period_end = CASE
      WHEN p_plan = 'monthly' THEN NOW() + INTERVAL '1 month'
      WHEN p_plan = 'annual' THEN NOW() + INTERVAL '1 year'
      ELSE NOW() + INTERVAL '1 month'
    END,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. FUNÇÃO: Cancelar assinatura
-- ============================================================================

CREATE OR REPLACE FUNCTION cancel_subscription(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE assinaturas
  SET
    status = 'canceled',
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. FUNÇÃO: Renovar período da assinatura (chamada pelo webhook)
-- ============================================================================

CREATE OR REPLACE FUNCTION renew_subscription(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  sub assinaturas%ROWTYPE;
BEGIN
  SELECT * INTO sub FROM assinaturas WHERE user_id = p_user_id;

  IF sub IS NULL THEN
    RETURN;
  END IF;

  UPDATE assinaturas
  SET
    current_period_start = NOW(),
    current_period_end = CASE
      WHEN sub.plan = 'monthly' THEN NOW() + INTERVAL '1 month'
      WHEN sub.plan = 'annual' THEN NOW() + INTERVAL '1 year'
      ELSE NOW() + INTERVAL '1 month'
    END,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Campos Asaas adicionados com sucesso à tabela assinaturas!';
  RAISE NOTICE '📝 Campos adicionados: asaas_customer_id, asaas_subscription_id, asaas_payment_url';
  RAISE NOTICE '📝 Campos removidos: stripe_customer_id, stripe_subscription_id';
  RAISE NOTICE '📝 Funções criadas: activate_subscription, cancel_subscription, renew_subscription';
END $$;
