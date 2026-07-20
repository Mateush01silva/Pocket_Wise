-- =====================================================
-- Migration: Corrigir search_path de handle_new_user (cadastro quebrado)
-- Description: A migration 074 passou a chamar create_default_categories()
--              (schema public) de dentro de handle_new_user() sem qualificar
--              o schema. O trigger de signup (on_auth_user_created) roda como
--              supabase_auth_admin, cujo search_path é fixado em "auth" apenas
--              — não inclui "public". Sem SET search_path pinado na função, a
--              chamada não qualificada falha com "function
--              create_default_categories(uuid) does not exist", a exceção
--              desfaz toda a transação (incluindo o INSERT em auth.users) e o
--              Supabase Auth responde "Database error saving new user" para
--              TODO cadastro novo — reproduzido diretamente:
--                SET search_path = auth;
--                SELECT create_default_categories('00000000-...'::uuid);
--                -- ERROR: function create_default_categories(uuid) does not exist
--              Fix: pinar SET search_path = public nas funções envolvidas, para
--              que resolvam as referências independente do search_path do
--              caller (também elimina o warning do linter do Supabase sobre
--              "function search path mutable").
-- =====================================================

CREATE OR REPLACE FUNCTION create_default_categories(p_family_id UUID)
RETURNS VOID AS $$
DECLARE
  r RECORD;
  v_pai_id UUID;
BEGIN
  -- Categorias principais
  FOR r IN
    SELECT * FROM (VALUES
      -- Despesas
      ('Alimentação',   'utensils',        'despesa', '#ef4444'),
      ('Transporte',    'car',             'despesa', '#f59e0b'),
      ('Moradia',       'home',            'despesa', '#3b82f6'),
      ('Saúde',         'heart',           'despesa', '#10b981'),
      ('Lazer',         'smile',           'despesa', '#ec4899'),
      ('Educação',      'book',            'despesa', '#6366f1'),
      ('Vestuário',     'shirt',           'despesa', '#f97316'),
      ('Outros',        'more-horizontal', 'despesa', '#6b7280'),
      -- Receitas
      ('Salário',       'briefcase',       'receita', '#10b981'),
      ('Investimentos', 'trending-up',     'receita', '#3b82f6'),
      ('Freelance',     'code',            'receita', '#8b5cf6'),
      ('Presente',      'gift',            'receita', '#ec4899'),
      ('Reembolso',     'refresh-ccw',     'receita', '#f59e0b'),
      ('Outros',        'more-horizontal', 'receita', '#6b7280')
    ) AS t(nome, icone, tipo, cor)
  LOOP
    INSERT INTO categorias (family_id, nome, icone, tipo, cor)
    SELECT p_family_id, r.nome, r.icone, r.tipo::transaction_type, r.cor
    WHERE NOT EXISTS (
      SELECT 1 FROM categorias
      WHERE family_id = p_family_id
        AND nome = r.nome
        AND tipo = r.tipo::transaction_type
        AND categoria_pai_id IS NULL
    );
  END LOOP;

  -- Subcategorias
  FOR r IN
    SELECT * FROM (VALUES
      -- Alimentação
      ('Supermercado',             'shopping-cart',  'despesa', '#ef4444', 'Alimentação'),
      ('Restaurante/Jantar Fora',  'utensils',       'despesa', '#ef4444', 'Alimentação'),
      ('Delivery',                 'bike',           'despesa', '#ef4444', 'Alimentação'),
      ('Marmita',                  'package',        'despesa', '#ef4444', 'Alimentação'),
      ('Lanche/Cafeteria',         'coffee',         'despesa', '#ef4444', 'Alimentação'),
      ('Padaria',                  'cake',           'despesa', '#ef4444', 'Alimentação'),
      -- Transporte
      ('Combustível',              'fuel',           'despesa', '#f59e0b', 'Transporte'),
      ('Uber/99',                  'smartphone',     'despesa', '#f59e0b', 'Transporte'),
      ('Estacionamento',           'square-parking', 'despesa', '#f59e0b', 'Transporte'),
      ('Manutenção Veículo',       'wrench',         'despesa', '#f59e0b', 'Transporte'),
      ('IPVA/Seguro',              'file-text',      'despesa', '#f59e0b', 'Transporte'),
      ('Transporte Público',       'bus',            'despesa', '#f59e0b', 'Transporte'),
      -- Moradia
      ('Aluguel/Financiamento',    'home',           'despesa', '#3b82f6', 'Moradia'),
      ('Condomínio',               'building',       'despesa', '#3b82f6', 'Moradia'),
      ('Luz',                      'lightbulb',      'despesa', '#3b82f6', 'Moradia'),
      ('Água',                     'droplet',        'despesa', '#3b82f6', 'Moradia'),
      ('Internet',                 'wifi',           'despesa', '#3b82f6', 'Moradia'),
      ('Gás',                      'flame',          'despesa', '#3b82f6', 'Moradia'),
      ('IPTU',                     'file-text',      'despesa', '#3b82f6', 'Moradia'),
      -- Saúde
      ('Farmácia',                 'pill',           'despesa', '#10b981', 'Saúde'),
      ('Consultas',                'stethoscope',    'despesa', '#10b981', 'Saúde'),
      ('Exames',                   'activity',       'despesa', '#10b981', 'Saúde'),
      ('Plano de Saúde',           'shield',         'despesa', '#10b981', 'Saúde'),
      ('Academia',                 'dumbbell',       'despesa', '#10b981', 'Saúde'),
      -- Lazer
      ('Streaming',                'tv',             'despesa', '#ec4899', 'Lazer'),
      ('Cinema',                   'film',           'despesa', '#ec4899', 'Lazer'),
      ('Viagens',                  'plane',          'despesa', '#ec4899', 'Lazer'),
      ('Jogos',                    'gamepad',        'despesa', '#ec4899', 'Lazer'),
      ('Hobbies',                  'palette',        'despesa', '#ec4899', 'Lazer'),
      -- Educação
      ('Cursos Online',            'graduation-cap', 'despesa', '#6366f1', 'Educação'),
      ('Livros',                   'book-open',      'despesa', '#6366f1', 'Educação'),
      ('Material Escolar',         'pencil',         'despesa', '#6366f1', 'Educação'),
      ('Mensalidade',              'school',         'despesa', '#6366f1', 'Educação'),
      -- Vestuário
      ('Roupas',                   'shirt',          'despesa', '#f97316', 'Vestuário'),
      ('Calçados',                 'footprints',     'despesa', '#f97316', 'Vestuário'),
      ('Acessórios',               'watch',          'despesa', '#f97316', 'Vestuário'),
      -- Outros (despesa)
      ('Presentes',                'gift',           'despesa', '#6b7280', 'Outros'),
      ('Doações',                  'heart-handshake','despesa', '#6b7280', 'Outros'),
      ('Pets',                     'dog',            'despesa', '#6b7280', 'Outros'),
      ('Beleza/Cuidados Pessoais', 'sparkles',       'despesa', '#6b7280', 'Outros')
    ) AS t(nome, icone, tipo, cor, pai)
  LOOP
    SELECT id INTO v_pai_id
    FROM categorias
    WHERE family_id = p_family_id
      AND nome = r.pai
      AND tipo = r.tipo::transaction_type
      AND categoria_pai_id IS NULL
    LIMIT 1;

    IF v_pai_id IS NOT NULL THEN
      INSERT INTO categorias (family_id, nome, icone, tipo, cor, categoria_pai_id)
      SELECT p_family_id, r.nome, r.icone, r.tipo::transaction_type, r.cor, v_pai_id
      WHERE NOT EXISTS (
        SELECT 1 FROM categorias
        WHERE family_id = p_family_id
          AND nome = r.nome
          AND tipo = r.tipo::transaction_type
          AND categoria_pai_id = v_pai_id
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION ensure_default_categories()
RETURNS VOID AS $$
DECLARE
  v_family_id UUID;
BEGIN
  SELECT family_id INTO v_family_id
  FROM public.users
  WHERE id = auth.uid();

  IF v_family_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM categorias WHERE family_id = v_family_id) THEN
    BEGIN
      PERFORM create_default_categories(v_family_id);
    EXCEPTION WHEN unique_violation THEN
      -- Outra sessão (ex.: segundo dispositivo do casal) criou ao mesmo tempo
      NULL;
    END;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION ensure_default_categories() TO authenticated;

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

  -- 5. Criar categorias padrão da família pessoal
  PERFORM public.create_default_categories(new_family_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
