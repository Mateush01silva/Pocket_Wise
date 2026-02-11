-- ============================================================================
-- SCRIPT DE TESTE: Simular trial expirado para testar pagamento Asaas
-- ============================================================================
-- Executar no Supabase SQL Editor
-- Usuário: silva.mateush01@gmail.com
-- ============================================================================
-- IMPORTANTE: Execute PRIMEIRO a migration 014_add_asaas_payment_fields.sql
-- para criar a tabela plano_usuario (se ainda não executou).
-- ============================================================================

-- 1. Remover role de admin (voltar para usuário normal)
UPDATE users
SET role = 'user'
WHERE email = 'silva.mateush01@gmail.com';

-- 2. Expirar o trial (colocar data no passado)
UPDATE plano_usuario
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
  p.status,
  p.plan,
  p.trial_ends_at,
  p.asaas_customer_id,
  p.asaas_subscription_id
FROM users u
JOIN plano_usuario p ON p.user_id = u.id
WHERE u.email = 'silva.mateush01@gmail.com';
