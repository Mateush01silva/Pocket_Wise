-- ============================================================================
-- MIGRATION 067: Corrigir handle_new_user — personal_family_id e family_members
-- ============================================================================
-- A migration 050 (restructure_pricing_tiers) substituiu handle_new_user e
-- removeu duas operações críticas que a migration 023 havia introduzido:
--   1. Definir personal_family_id = new_family_id no INSERT do usuário
--   2. Criar entrada em family_members com role='admin' para a família pessoal
--
-- Resultado: usuários criados após a migration 050 ficam com:
--   - personal_family_id = NULL
--   - Nenhuma entrada em family_members para a própria família
--
-- Isso impede que um consultor identifique e acesse sua conta pessoal
-- ao tentar voltar de "Meus Clientes".
-- ============================================================================

-- ============================================================================
-- 1. Corrigir handle_new_user: restaurar personal_family_id e family_members
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

  -- 2. Criar perfil do usuário com personal_family_id definido
  INSERT INTO public.users (id, email, nome, full_name, family_id, personal_family_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    user_name,
    user_name,
    new_family_id,
    new_family_id
  )
  ON CONFLICT (id) DO UPDATE
  SET email             = EXCLUDED.email,
      nome              = EXCLUDED.nome,
      full_name         = EXCLUDED.full_name,
      family_id         = COALESCE(users.family_id, EXCLUDED.family_id),
      personal_family_id = COALESCE(users.personal_family_id, EXCLUDED.personal_family_id);

  -- 3. Inserir o usuário como admin da própria família
  INSERT INTO public.family_members (family_id, user_id, role)
  VALUES (new_family_id, NEW.id, 'admin')
  ON CONFLICT DO NOTHING;

  -- 4. Criar plano trial de 14 dias com tier explorador
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

-- ============================================================================
-- 2. Backfill: definir personal_family_id para usuários que não têm
--    Prioridade: família onde são admin com member_type='familiar'
-- ============================================================================
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

-- ============================================================================
-- 3. Backfill: para usuários ainda sem personal_family_id, criar nova família
--    (caso o usuário seja consultor cujo family_id já é a família do cliente)
-- ============================================================================
DO $$
DECLARE
  u_record    RECORD;
  new_fam_id  UUID;
BEGIN
  FOR u_record IN
    SELECT u.id, u.nome
    FROM public.users u
    WHERE u.personal_family_id IS NULL
  LOOP
    INSERT INTO public.families (nome)
    VALUES ('Família de ' || u_record.nome)
    RETURNING id INTO new_fam_id;

    UPDATE public.users
    SET personal_family_id = new_fam_id
    WHERE id = u_record.id;

    INSERT INTO public.family_members (family_id, user_id, role)
    VALUES (new_fam_id, u_record.id, 'admin')
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ============================================================================
-- 4. Backfill: garantir family_members para todos os usuários que têm
--    personal_family_id mas não têm entrada em family_members para ela
-- ============================================================================
INSERT INTO public.family_members (family_id, user_id, role)
SELECT u.personal_family_id, u.id, 'admin'
FROM public.users u
WHERE u.personal_family_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.user_id = u.id
      AND fm.family_id = u.personal_family_id
  )
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- FIM DA MIGRATION 067
-- ============================================================================
