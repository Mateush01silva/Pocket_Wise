-- ============================================================
-- PocketWise — Scripts de Gerenciamento de Planos (Admin)
-- Copie o trecho necessário e rode no Supabase SQL Editor
-- Substitua EMAIL_AQUI pelo e-mail real do usuário
-- ============================================================


-- ① Liberar plano MESTRE (manual, sem cobrar)
-- ────────────────────────────────────────────
UPDATE plano_usuario SET
  status                = 'active',
  tier                  = 'mestre',
  plan_id               = 'mestre_manual',
  current_period_start  = now(),
  current_period_end    = now() + interval '100 years',
  cancel_at_period_end  = false,
  updated_at            = now()
WHERE user_id = (SELECT id FROM users WHERE email = 'EMAIL_AQUI');


-- ② Liberar plano PLANEJADOR (manual, sem cobrar)
-- ─────────────────────────────────────────────────
UPDATE plano_usuario SET
  status                = 'active',
  tier                  = 'planejador',
  plan_id               = 'planejador_manual',
  current_period_start  = now(),
  current_period_end    = now() + interval '100 years',
  cancel_at_period_end  = false,
  updated_at            = now()
WHERE user_id = (SELECT id FROM users WHERE email = 'EMAIL_AQUI');


-- ③ Renovar TRIAL por 14 dias
-- ─────────────────────────────
UPDATE plano_usuario SET
  status                = 'trial',
  tier                  = 'explorador',
  trial_ends_at         = now() + interval '14 days',
  current_period_start  = null,
  current_period_end    = null,
  cancel_at_period_end  = false,
  updated_at            = now()
WHERE user_id = (SELECT id FROM users WHERE email = 'EMAIL_AQUI');


-- ④ BLOQUEAR acesso imediatamente (status expired)
-- ──────────────────────────────────────────────────
UPDATE plano_usuario SET
  status                = 'expired',
  current_period_end    = now(),
  cancel_at_period_end  = false,
  updated_at            = now()
WHERE user_id = (SELECT id FROM users WHERE email = 'EMAIL_AQUI');


-- ⑤ Ver situação completa de um usuário
-- ──────────────────────────────────────
SELECT
  u.email,
  u.full_name,
  p.status,
  p.tier,
  p.plan_id,
  p.trial_ends_at,
  p.current_period_start,
  p.current_period_end,
  p.cancel_at_period_end,
  p.created_at AS cliente_desde
FROM users u
JOIN plano_usuario p ON p.user_id = u.id
WHERE u.email = 'EMAIL_AQUI';


-- ⑥ Visão geral — distribuição de planos e status
-- ──────────────────────────────────────────────────
SELECT
  p.tier,
  p.status,
  count(*) AS total
FROM plano_usuario p
GROUP BY p.tier, p.status
ORDER BY p.tier, p.status;


-- ⑦ Listar todos os usuários com trial ativo (trial_ends_at no futuro)
-- ──────────────────────────────────────────────────────────────────────
SELECT
  u.email,
  u.full_name,
  p.trial_ends_at,
  (p.trial_ends_at - now()) AS tempo_restante
FROM users u
JOIN plano_usuario p ON p.user_id = u.id
WHERE p.status = 'trial'
  AND p.trial_ends_at > now()
ORDER BY p.trial_ends_at ASC;


-- ⑧ Listar assinantes ativos (status = active)
-- ─────────────────────────────────────────────
SELECT
  u.email,
  u.full_name,
  p.tier,
  p.plan_id,
  p.current_period_end,
  p.cancel_at_period_end
FROM users u
JOIN plano_usuario p ON p.user_id = u.id
WHERE p.status = 'active'
ORDER BY p.tier, u.email;
