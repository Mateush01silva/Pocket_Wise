-- ============================================================================
-- SCRIPT DE TESTE: Simular trial expirado para testar pagamento Asaas
-- ============================================================================
-- Executar no Supabase SQL Editor
-- Usuário: silva.mateush01@gmail.com
-- ============================================================================

-- 1. Remover role de admin (voltar para usuário normal)
UPDATE users
SET role = 'user'
WHERE email = 'silva.mateush01@gmail.com';

-- 2. Expirar o trial (colocar data no passado)
UPDATE assinaturas
SET
  status = 'expired',
  plan = NULL,
  trial_ends_at = NOW() - INTERVAL '1 day',
  current_period_start = NULL,
  current_period_end = NULL,
  asaas_customer_id = NULL,
  asaas_subscription_id = NULL,
  asaas_payment_url = NULL,
  updated_at = NOW()
WHERE user_id = (
  SELECT id FROM users WHERE email = 'silva.mateush01@gmail.com'
);

-- 3. Verificar resultado
SELECT
  u.email,
  u.role,
  a.status,
  a.plan,
  a.trial_ends_at,
  a.asaas_customer_id,
  a.asaas_subscription_id
FROM users u
JOIN assinaturas a ON a.user_id = u.id
WHERE u.email = 'silva.mateush01@gmail.com';
