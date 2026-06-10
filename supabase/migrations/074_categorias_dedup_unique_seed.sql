-- =====================================================
-- Migration: Categorias — dedup, constraint UNIQUE e seed no banco
-- Description: O seed de categorias padrão era feito no cliente (43+ inserts
--              sequenciais resolvendo family_id a cada um). Quando o usuário
--              aceitava um convite de família durante o loop, o family_id
--              mudava no meio e as categorias restantes eram gravadas na
--              família do casal, que já tinha as do convidante → duplicação.
--              Esta migration:
--                1. Deduplica categorias existentes (re-apontando todas as FKs)
--                2. Cria índice UNIQUE para impedir reincidência
--                3. Move o seed para o banco: handle_new_user cria as categorias
--                   da família pessoal; ensure_default_categories() é a RPC
--                   idempotente que o cliente chama como rede de segurança
-- =====================================================

-- =====================================================
-- 1) Helper de dedup: re-aponta todas as referências de categorias
--    duplicadas para a categoria canônica (dropada ao final)
-- =====================================================
CREATE OR REPLACE FUNCTION __dedup_repontar_categoria(p_canonical UUID, p_dups UUID[])
RETURNS VOID AS $$
BEGIN
  -- Filhas das duplicatas passam para a categoria canônica
  UPDATE categorias SET categoria_pai_id = p_canonical WHERE categoria_pai_id = ANY(p_dups);

  UPDATE lancamentos SET categoria_id = p_canonical WHERE categoria_id = ANY(p_dups);
  UPDATE lancamentos SET subcategoria_id = p_canonical WHERE subcategoria_id = ANY(p_dups);
  UPDATE planejamentos SET categoria_id = p_canonical WHERE categoria_id = ANY(p_dups);
  UPDATE receitas_projetadas SET categoria_id = p_canonical WHERE categoria_id = ANY(p_dups);
  UPDATE assinaturas SET categoria_id = p_canonical WHERE categoria_id = ANY(p_dups);
  UPDATE assinaturas SET subcategoria_id = p_canonical WHERE subcategoria_id = ANY(p_dups);
  UPDATE orcamento_ajustes_log SET categoria_id = p_canonical WHERE categoria_id = ANY(p_dups);
  UPDATE historico_rebalanceamentos SET categoria_origem_id = p_canonical WHERE categoria_origem_id = ANY(p_dups);
  UPDATE historico_rebalanceamentos SET categoria_destino_id = p_canonical WHERE categoria_destino_id = ANY(p_dups);
  UPDATE consultant_debts SET categoria_id = p_canonical WHERE categoria_id = ANY(p_dups);

  -- categorias_budget tem UNIQUE (orcamento_id, categoria_id): quando o
  -- orçamento já tem alocação para a canônica, descartar a da duplicata
  -- (a duplicata foi criada por acidente; a alocação relevante é a canônica)
  DELETE FROM categorias_budget cb
  WHERE cb.categoria_id = ANY(p_dups)
    AND EXISTS (
      SELECT 1 FROM categorias_budget cb2
      WHERE cb2.orcamento_id = cb.orcamento_id
        AND cb2.categoria_id = p_canonical
    );
  UPDATE categorias_budget SET categoria_id = p_canonical WHERE categoria_id = ANY(p_dups);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2) Dedup — passada 1: categorias principais (sem pai)
--    Canônica = a mais antiga (created_at, id)
-- =====================================================
DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN
    SELECT
      (array_agg(id ORDER BY created_at, id))[1] AS canonical_id,
      (array_agg(id ORDER BY created_at, id))[2:] AS dup_ids
    FROM categorias
    WHERE family_id IS NOT NULL AND categoria_pai_id IS NULL
    GROUP BY family_id, nome, tipo
    HAVING COUNT(*) > 1
  LOOP
    PERFORM __dedup_repontar_categoria(dup.canonical_id, dup.dup_ids);
    DELETE FROM categorias WHERE id = ANY(dup.dup_ids);
  END LOOP;
END;
$$;

-- =====================================================
-- 3) Dedup — passada 2: subcategorias (agora todas apontando
--    para pais canônicos, duplicatas compartilham o mesmo pai)
-- =====================================================
DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN
    SELECT
      (array_agg(id ORDER BY created_at, id))[1] AS canonical_id,
      (array_agg(id ORDER BY created_at, id))[2:] AS dup_ids
    FROM categorias
    WHERE family_id IS NOT NULL AND categoria_pai_id IS NOT NULL
    GROUP BY family_id, nome, tipo, categoria_pai_id
    HAVING COUNT(*) > 1
  LOOP
    PERFORM __dedup_repontar_categoria(dup.canonical_id, dup.dup_ids);
    DELETE FROM categorias WHERE id = ANY(dup.dup_ids);
  END LOOP;
END;
$$;

DROP FUNCTION __dedup_repontar_categoria(UUID, UUID[]);

-- =====================================================
-- 4) Constraint UNIQUE: impede duplicação por (família, nome, tipo, pai)
--    COALESCE para que pai NULL também participe da unicidade.
--    Linhas com family_id NULL (escopo user_id legado) não conflitam.
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS uniq_categorias_family_nome_tipo_pai
  ON categorias (
    family_id,
    nome,
    tipo,
    COALESCE(categoria_pai_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- =====================================================
-- 5) Seed completo no banco (espelho de src/lib/defaultCategories.ts).
--    Idempotente: WHERE NOT EXISTS por linha + índice UNIQUE como garantia.
--    Substitui a versão reduzida de 13 categorias do schema inicial.
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
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6) RPC para o cliente: garante o seed da família ATIVA do usuário.
--    Idempotente e segura contra concorrência (índice UNIQUE).
--    Rede de segurança para famílias criadas antes desta migration.
-- =====================================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ensure_default_categories() TO authenticated;

-- =====================================================
-- 7) handle_new_user: criar as categorias padrão da família pessoal
--    no signup (mesma função da migration 067 + passo 5)
-- =====================================================
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

  -- 5. Criar categorias padrão da família pessoal (seed no banco — o
  --    cliente não faz mais o loop de inserts que causava duplicação
  --    quando o family_id mudava durante o aceite de convite)
  PERFORM create_default_categories(new_family_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
