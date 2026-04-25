-- ============================================================================
-- MIGRATION 064: Corrigir personal_family_id = NULL para usuários existentes
-- ============================================================================
-- Usuários criados antes ou durante falhas de migration podem ter
-- personal_family_id = NULL. Isso impede que o consultor identifique
-- sua família pessoal para voltar ao contexto pessoal.
-- ============================================================================

-- 1. Backfill: definir personal_family_id para usuários que não têm,
--    usando a família onde são admin com member_type = 'familiar' (a própria família)
UPDATE public.users u
SET personal_family_id = (
  SELECT fm.family_id
  FROM public.family_members fm
  WHERE fm.user_id = u.id
    AND fm.role = 'admin'
    AND COALESCE(fm.member_type, 'familiar') = 'familiar'
  ORDER BY fm.joined_at ASC
  LIMIT 1
)
WHERE u.personal_family_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.user_id = u.id
      AND fm.role = 'admin'
      AND COALESCE(fm.member_type, 'familiar') = 'familiar'
  );

-- 2. Fallback: se ainda null, usar qualquer família onde é admin
UPDATE public.users u
SET personal_family_id = (
  SELECT fm.family_id
  FROM public.family_members fm
  WHERE fm.user_id = u.id
    AND fm.role = 'admin'
  ORDER BY fm.joined_at ASC
  LIMIT 1
)
WHERE u.personal_family_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.user_id = u.id AND fm.role = 'admin'
  );

-- 3. Último fallback: usar family_id atual (pode ser família de cliente,
--    mas é melhor que nada para evitar erros de UI)
UPDATE public.users u
SET personal_family_id = u.family_id
WHERE u.personal_family_id IS NULL
  AND u.family_id IS NOT NULL;

-- ============================================================================
-- FIM DA MIGRATION 064
-- ============================================================================
