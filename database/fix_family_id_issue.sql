-- ============================================================================
-- FIX: Criar tabela families e configurar family_id automaticamente
-- ============================================================================
-- Este script corrige o problema de transações não sendo salvas
-- criando a tabela families e configurando triggers para auto-criar família
-- ============================================================================

-- ============================================================================
-- 1. CRIAR TABELA FAMILIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL DEFAULT 'Minha Família',
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_families_criado_por ON families(criado_por);

-- Habilitar RLS
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem gerenciar suas próprias famílias
DROP POLICY IF EXISTS "Users can manage own family" ON families;
CREATE POLICY "Users can manage own family"
  ON families FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.family_id = families.id
      AND u.id = auth.uid()
    )
  );

-- ============================================================================
-- 2. ATUALIZAR TRIGGER handle_new_user para criar família automaticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_family_id UUID;
BEGIN
  -- Criar uma nova família para o usuário
  INSERT INTO public.families (nome, criado_por)
  VALUES (
    'Família de ' || COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.id
  )
  RETURNING id INTO new_family_id;

  -- Criar perfil do usuário com family_id
  INSERT INTO public.users (id, email, full_name, family_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    new_family_id
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      family_id = COALESCE(users.family_id, EXCLUDED.family_id);

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

-- Recriar o trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE handle_new_user();

-- ============================================================================
-- 3. MIGRAÇÃO: Criar família para usuários existentes sem family_id
-- ============================================================================

DO $$
DECLARE
  user_record RECORD;
  new_family_id UUID;
BEGIN
  -- Para cada usuário sem family_id, criar uma família
  FOR user_record IN
    SELECT u.id, u.full_name
    FROM users u
    WHERE u.family_id IS NULL
  LOOP
    -- Criar família
    INSERT INTO families (nome, criado_por)
    VALUES (
      'Família de ' || COALESCE(user_record.full_name, 'Usuário'),
      user_record.id
    )
    RETURNING id INTO new_family_id;

    -- Atualizar usuário com o family_id
    UPDATE users
    SET family_id = new_family_id
    WHERE id = user_record.id;

    RAISE NOTICE 'Família criada para usuário %', user_record.id;
  END LOOP;
END $$;

-- ============================================================================
-- 4. VERIFICAÇÃO FINAL
-- ============================================================================

-- Verificar se todos os usuários têm family_id
DO $$
DECLARE
  users_sem_family INTEGER;
BEGIN
  SELECT COUNT(*) INTO users_sem_family
  FROM users
  WHERE family_id IS NULL;

  IF users_sem_family > 0 THEN
    RAISE WARNING '⚠️ Ainda existem % usuários sem family_id!', users_sem_family;
  ELSE
    RAISE NOTICE '✅ Todos os usuários têm family_id configurado!';
  END IF;
END $$;

RAISE NOTICE '✅ Script executado com sucesso!';
RAISE NOTICE '📝 Execute este script no Supabase SQL Editor';
RAISE NOTICE '🔄 Após executar, teste criar uma nova transação no app';
