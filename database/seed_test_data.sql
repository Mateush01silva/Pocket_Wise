-- ============================================================================
-- SCRIPT DE SEED - Dados de Teste para Pocket Wise
-- ============================================================================
-- Este script popula o banco com dados realistas de 2 meses
-- Para o usuário: silva.mateush01@gmail.com
-- ============================================================================
-- IMPORTANTE: Execute o script fix_family_id_issue.sql ANTES deste
-- ============================================================================

-- ============================================================================
-- 1. BUSCAR DADOS DO USUÁRIO
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_family_id UUID;
  v_user_email VARCHAR := 'silva.mateush01@gmail.com';

  -- IDs que serão criados
  v_cartao1_id UUID;
  v_cartao2_id UUID;
  v_cartao3_id UUID;

  -- IDs de categorias (buscaremos do banco)
  v_cat_alimentacao_id UUID;
  v_cat_transporte_id UUID;
  v_cat_moradia_id UUID;
  v_cat_saude_id UUID;
  v_cat_lazer_id UUID;
  v_cat_educacao_id UUID;
  v_cat_salario_id UUID;
  v_cat_outros_id UUID;

  -- Contadores
  v_total_categorias INTEGER;
  v_total_subcategorias INTEGER;
  v_total_cartoes INTEGER;
  v_total_lancamentos INTEGER;
  v_total_orcamentos INTEGER;

BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====================================';
  RAISE NOTICE '🚀 INICIANDO SEED DE DADOS';
  RAISE NOTICE '====================================';
  RAISE NOTICE '';

  -- Buscar user_id e family_id
  SELECT id, family_id INTO v_user_id, v_family_id
  FROM users
  WHERE email = v_user_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '❌ Usuário % não encontrado!', v_user_email;
  END IF;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION '❌ Usuário não tem family_id! Execute fix_family_id_issue.sql primeiro';
  END IF;

  RAISE NOTICE '✅ Usuário encontrado: %', v_user_email;
  RAISE NOTICE '   User ID: %', v_user_id;
  RAISE NOTICE '   Family ID: %', v_family_id;
  RAISE NOTICE '';

  -- ============================================================================
  -- 2. CRIAR CARTÕES DE CRÉDITO
  -- ============================================================================

  RAISE NOTICE '💳 Criando cartões de crédito...';

  -- Cartão 1: Nubank
  v_cartao1_id := gen_random_uuid();
  INSERT INTO cartoes (id, family_id, nome, dia_fechamento, dia_vencimento, limite, cor, ativo)
  VALUES (
    v_cartao1_id,
    v_family_id,
    'Nubank',
    15,  -- Fecha dia 15
    23,  -- Vence dia 23
    5000.00,
    '#8A05BE',
    true
  )
  ON CONFLICT DO NOTHING;

  -- Cartão 2: Inter
  v_cartao2_id := gen_random_uuid();
  INSERT INTO cartoes (id, family_id, nome, dia_fechamento, dia_vencimento, limite, cor, ativo)
  VALUES (
    v_cartao2_id,
    v_family_id,
    'Inter',
    10,  -- Fecha dia 10
    20,  -- Vence dia 20
    3000.00,
    '#FF7A00',
    true
  )
  ON CONFLICT DO NOTHING;

  -- Cartão 3: Itaú
  v_cartao3_id := gen_random_uuid();
  INSERT INTO cartoes (id, family_id, nome, dia_fechamento, dia_vencimento, limite, cor, ativo)
  VALUES (
    v_cartao3_id,
    v_family_id,
    'Itaú',
    5,   -- Fecha dia 5
    15,  -- Vence dia 15
    8000.00,
    '#003D7A',
    true
  )
  ON CONFLICT DO NOTHING;

  SELECT COUNT(*) INTO v_total_cartoes FROM cartoes WHERE family_id = v_family_id;
  RAISE NOTICE '   ✅ % cartões criados', v_total_cartoes;
  RAISE NOTICE '';

  -- ============================================================================
  -- 3. BUSCAR CATEGORIAS EXISTENTES E CRIAR SUBCATEGORIAS
  -- ============================================================================

  RAISE NOTICE '📂 Criando subcategorias...';

  -- Buscar IDs das categorias principais
  SELECT id INTO v_cat_alimentacao_id FROM categorias WHERE nome ILIKE '%alimenta%' AND tipo = 'despesa' AND categoria_pai_id IS NULL LIMIT 1;
  SELECT id INTO v_cat_transporte_id FROM categorias WHERE nome ILIKE '%transport%' AND tipo = 'despesa' AND categoria_pai_id IS NULL LIMIT 1;
  SELECT id INTO v_cat_moradia_id FROM categorias WHERE nome ILIKE '%morad%' AND tipo = 'despesa' AND categoria_pai_id IS NULL LIMIT 1;
  SELECT id INTO v_cat_saude_id FROM categorias WHERE nome ILIKE '%sa%de%' AND tipo = 'despesa' AND categoria_pai_id IS NULL LIMIT 1;
  SELECT id INTO v_cat_lazer_id FROM categorias WHERE nome ILIKE '%lazer%' OR nome ILIKE '%entretenimento%' AND tipo = 'despesa' AND categoria_pai_id IS NULL LIMIT 1;
  SELECT id INTO v_cat_educacao_id FROM categorias WHERE nome ILIKE '%educa%' AND tipo = 'despesa' AND categoria_pai_id IS NULL LIMIT 1;
  SELECT id INTO v_cat_salario_id FROM categorias WHERE nome ILIKE '%sal%rio%' AND tipo = 'receita' AND categoria_pai_id IS NULL LIMIT 1;

  -- Subcategorias de Alimentação
  IF v_cat_alimentacao_id IS NOT NULL THEN
    INSERT INTO categorias (family_id, nome, icone, tipo, categoria_pai_id, cor)
    VALUES
      (v_family_id, 'Supermercado', '🛒', 'despesa', v_cat_alimentacao_id, '#10b981'),
      (v_family_id, 'Restaurantes', '🍽️', 'despesa', v_cat_alimentacao_id, '#f59e0b'),
      (v_family_id, 'Delivery', '🛵', 'despesa', v_cat_alimentacao_id, '#ef4444'),
      (v_family_id, 'Padaria', '🥖', 'despesa', v_cat_alimentacao_id, '#f97316'),
      (v_family_id, 'Lanchonete', '🍔', 'despesa', v_cat_alimentacao_id, '#eab308')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Subcategorias de Transporte
  IF v_cat_transporte_id IS NOT NULL THEN
    INSERT INTO categorias (family_id, nome, icone, tipo, categoria_pai_id, cor)
    VALUES
      (v_family_id, 'Combustível', '⛽', 'despesa', v_cat_transporte_id, '#ef4444'),
      (v_family_id, 'Uber/Taxi', '🚕', 'despesa', v_cat_transporte_id, '#000000'),
      (v_family_id, 'Ônibus/Metrô', '🚌', 'despesa', v_cat_transporte_id, '#3b82f6'),
      (v_family_id, 'Manutenção Carro', '🔧', 'despesa', v_cat_transporte_id, '#64748b'),
      (v_family_id, 'Estacionamento', '🅿️', 'despesa', v_cat_transporte_id, '#6b7280')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Subcategorias de Moradia
  IF v_cat_moradia_id IS NOT NULL THEN
    INSERT INTO categorias (family_id, nome, icone, tipo, categoria_pai_id, cor)
    VALUES
      (v_family_id, 'Aluguel', '🏠', 'despesa', v_cat_moradia_id, '#dc2626'),
      (v_family_id, 'Condomínio', '🏘️', 'despesa', v_cat_moradia_id, '#f59e0b'),
      (v_family_id, 'Energia', '💡', 'despesa', v_cat_moradia_id, '#eab308'),
      (v_family_id, 'Água', '💧', 'despesa', v_cat_moradia_id, '#06b6d4'),
      (v_family_id, 'Internet', '📡', 'despesa', v_cat_moradia_id, '#8b5cf6'),
      (v_family_id, 'Gás', '🔥', 'despesa', v_cat_moradia_id, '#f97316')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Subcategorias de Saúde
  IF v_cat_saude_id IS NOT NULL THEN
    INSERT INTO categorias (family_id, nome, icone, tipo, categoria_pai_id, cor)
    VALUES
      (v_family_id, 'Farmácia', '💊', 'despesa', v_cat_saude_id, '#10b981'),
      (v_family_id, 'Consultas', '👨‍⚕️', 'despesa', v_cat_saude_id, '#3b82f6'),
      (v_family_id, 'Exames', '🔬', 'despesa', v_cat_saude_id, '#06b6d4'),
      (v_family_id, 'Plano de Saúde', '🏥', 'despesa', v_cat_saude_id, '#0ea5e9')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Subcategorias de Lazer
  IF v_cat_lazer_id IS NOT NULL THEN
    INSERT INTO categorias (family_id, nome, icone, tipo, categoria_pai_id, cor)
    VALUES
      (v_family_id, 'Cinema', '🎬', 'despesa', v_cat_lazer_id, '#a855f7'),
      (v_family_id, 'Streaming', '📺', 'despesa', v_cat_lazer_id, '#ec4899'),
      (v_family_id, 'Viagens', '✈️', 'despesa', v_cat_lazer_id, '#06b6d4'),
      (v_family_id, 'Eventos', '🎉', 'despesa', v_cat_lazer_id, '#f59e0b'),
      (v_family_id, 'Hobbies', '🎨', 'despesa', v_cat_lazer_id, '#8b5cf6')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Subcategorias de Educação
  IF v_cat_educacao_id IS NOT NULL THEN
    INSERT INTO categorias (family_id, nome, icone, tipo, categoria_pai_id, cor)
    VALUES
      (v_family_id, 'Cursos Online', '💻', 'despesa', v_cat_educacao_id, '#3b82f6'),
      (v_family_id, 'Livros', '📚', 'despesa', v_cat_educacao_id, '#10b981'),
      (v_family_id, 'Material Escolar', '✏️', 'despesa', v_cat_educacao_id, '#f59e0b')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Subcategorias de Receita (Salário)
  IF v_cat_salario_id IS NOT NULL THEN
    INSERT INTO categorias (family_id, nome, icone, tipo, categoria_pai_id, cor)
    VALUES
      (v_family_id, 'Salário CLT', '💼', 'receita', v_cat_salario_id, '#10b981'),
      (v_family_id, 'Freelance', '💻', 'receita', v_cat_salario_id, '#3b82f6'),
      (v_family_id, 'Bônus', '💰', 'receita', v_cat_salario_id, '#f59e0b')
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT COUNT(*) INTO v_total_subcategorias FROM categorias WHERE family_id = v_family_id AND categoria_pai_id IS NOT NULL;
  RAISE NOTICE '   ✅ % subcategorias criadas', v_total_subcategorias;
  RAISE NOTICE '';

  -- ============================================================================
  -- 4. CRIAR LANÇAMENTOS - NOVEMBRO 2024
  -- ============================================================================

  RAISE NOTICE '💰 Criando lançamentos de NOVEMBRO/2024...';

  -- Buscar IDs de subcategorias para usar nos lançamentos
  -- (vamos usar as categorias principais caso não encontre subcategorias)

  -- RECEITAS NOVEMBRO
  INSERT INTO lancamentos (family_id, criado_por, tipo, data, valor, categoria_id, forma_pagamento, status, observacao)
  VALUES
    -- Salário
    (v_family_id, v_user_id, 'receita', '2024-11-05', 5500.00, v_cat_salario_id, 'transferencia', 'pago', 'Salário CLT'),
    (v_family_id, v_user_id, 'receita', '2024-11-15', 1200.00, v_cat_salario_id, 'pix', 'pago', 'Freelance - Projeto X');

  -- DESPESAS NOVEMBRO - Alimentação
  INSERT INTO lancamentos (family_id, criado_por, tipo, data, valor, categoria_id, forma_pagamento, cartao_id, status, observacao)
  VALUES
    (v_family_id, v_user_id, 'despesa', '2024-11-03', 320.50, v_cat_alimentacao_id, 'debito', NULL, 'pago', 'Supermercado - Compras do mês'),
    (v_family_id, v_user_id, 'despesa', '2024-11-05', 45.00, v_cat_alimentacao_id, 'credito', v_cartao1_id, 'pago', 'Almoço no restaurante'),
    (v_family_id, v_user_id, 'despesa', '2024-11-08', 89.90, v_cat_alimentacao_id, 'credito', v_cartao1_id, 'pago', 'Delivery - Pizza'),
    (v_family_id, v_user_id, 'despesa', '2024-11-10', 150.00, v_cat_alimentacao_id, 'debito', NULL, 'pago', 'Feira orgânica'),
    (v_family_id, v_user_id, 'despesa', '2024-11-12', 35.50, v_cat_alimentacao_id, 'pix', NULL, 'pago', 'Padaria'),
    (v_family_id, v_user_id, 'despesa', '2024-11-15', 280.00, v_cat_alimentacao_id, 'debito', NULL, 'pago', 'Supermercado'),
    (v_family_id, v_user_id, 'despesa', '2024-11-18', 67.80, v_cat_alimentacao_id, 'credito', v_cartao2_id, 'pago', 'Lanchonete'),
    (v_family_id, v_user_id, 'despesa', '2024-11-22', 120.00, v_cat_alimentacao_id, 'credito', v_cartao1_id, 'pago', 'Jantar no restaurante'),
    (v_family_id, v_user_id, 'despesa', '2024-11-25', 55.00, v_cat_alimentacao_id, 'dinheiro', NULL, 'pago', 'Delivery - Japonês');

  -- DESPESAS NOVEMBRO - Transporte
  IF v_cat_transporte_id IS NOT NULL THEN
    INSERT INTO lancamentos (family_id, criado_por, tipo, data, valor, categoria_id, forma_pagamento, cartao_id, status, observacao)
    VALUES
      (v_family_id, v_user_id, 'despesa', '2024-11-02', 250.00, v_cat_transporte_id, 'debito', NULL, 'pago', 'Combustível'),
      (v_family_id, v_user_id, 'despesa', '2024-11-06', 35.00, v_cat_transporte_id, 'pix', NULL, 'pago', 'Uber para o trabalho'),
      (v_family_id, v_user_id, 'despesa', '2024-11-10', 180.00, v_cat_transporte_id, 'debito', NULL, 'pago', 'Recarga Bilhete Único'),
      (v_family_id, v_user_id, 'despesa', '2024-11-16', 280.00, v_cat_transporte_id, 'credito', v_cartao2_id, 'pago', 'Combustível'),
      (v_family_id, v_user_id, 'despesa', '2024-11-20', 150.00, v_cat_transporte_id, 'credito', v_cartao3_id, 'pago', 'Troca de óleo');
  END IF;

  -- DESPESAS NOVEMBRO - Moradia
  IF v_cat_moradia_id IS NOT NULL THEN
    INSERT INTO lancamentos (family_id, criado_por, tipo, data, valor, categoria_id, forma_pagamento, status, observacao)
    VALUES
      (v_family_id, v_user_id, 'despesa', '2024-11-01', 1500.00, v_cat_moradia_id, 'transferencia', 'pago', 'Aluguel'),
      (v_family_id, v_user_id, 'despesa', '2024-11-05', 350.00, v_cat_moradia_id, 'boleto', 'pago', 'Condomínio'),
      (v_family_id, v_user_id, 'despesa', '2024-11-08', 180.50, v_cat_moradia_id, 'debito', 'pago', 'Conta de luz'),
      (v_family_id, v_user_id, 'despesa', '2024-11-10', 95.00, v_cat_moradia_id, 'debito', 'pago', 'Conta de água'),
      (v_family_id, v_user_id, 'despesa', '2024-11-12', 119.90, v_cat_moradia_id, 'debito', 'pago', 'Internet fibra');
  END IF;

  -- DESPESAS NOVEMBRO - Saúde
  IF v_cat_saude_id IS NOT NULL THEN
    INSERT INTO lancamentos (family_id, criado_por, tipo, data, valor, categoria_id, forma_pagamento, cartao_id, status, observacao)
    VALUES
      (v_family_id, v_user_id, 'despesa', '2024-11-07', 85.50, v_cat_saude_id, 'credito', v_cartao1_id, 'pago', 'Farmácia - Medicamentos'),
      (v_family_id, v_user_id, 'despesa', '2024-11-14', 250.00, v_cat_saude_id, 'debito', NULL, 'pago', 'Consulta dentista'),
      (v_family_id, v_user_id, 'despesa', '2024-11-20', 450.00, v_cat_saude_id, 'credito', v_cartao3_id, 'pago', 'Plano de saúde');
  END IF;

  -- DESPESAS NOVEMBRO - Lazer
  IF v_cat_lazer_id IS NOT NULL THEN
    INSERT INTO lancamentos (family_id, criado_por, tipo, data, valor, categoria_id, forma_pagamento, cartao_id, status, observacao)
    VALUES
      (v_family_id, v_user_id, 'despesa', '2024-11-09', 45.00, v_cat_lazer_id, 'credito', v_cartao1_id, 'pago', 'Cinema'),
      (v_family_id, v_user_id, 'despesa', '2024-11-15', 29.90, v_cat_lazer_id, 'credito', v_cartao2_id, 'pago', 'Netflix'),
      (v_family_id, v_user_id, 'despesa', '2024-11-23', 180.00, v_cat_lazer_id, 'pix', NULL, 'pago', 'Show de música');
  END IF;

  -- DESPESAS NOVEMBRO - Educação
  IF v_cat_educacao_id IS NOT NULL THEN
    INSERT INTO lancamentos (family_id, criado_por, tipo, data, valor, categoria_id, forma_pagamento, cartao_id, status, observacao)
    VALUES
      (v_family_id, v_user_id, 'despesa', '2024-11-05', 89.90, v_cat_educacao_id, 'credito', v_cartao1_id, 'pago', 'Curso Udemy'),
      (v_family_id, v_user_id, 'despesa', '2024-11-18', 125.00, v_cat_educacao_id, 'pix', NULL, 'pago', 'Livro técnico');
  END IF;

  RAISE NOTICE '   ✅ Lançamentos de NOVEMBRO criados';

  -- ============================================================================
  -- 5. CRIAR LANÇAMENTOS - DEZEMBRO 2024
  -- ============================================================================

  RAISE NOTICE '💰 Criando lançamentos de DEZEMBRO/2024...';

  -- RECEITAS DEZEMBRO
  INSERT INTO lancamentos (family_id, criado_por, tipo, data, valor, categoria_id, forma_pagamento, status, observacao)
  VALUES
    (v_family_id, v_user_id, 'receita', '2024-12-05', 5500.00, v_cat_salario_id, 'transferencia', 'pago', 'Salário CLT'),
    (v_family_id, v_user_id, 'receita', '2024-12-10', 800.00, v_cat_salario_id, 'pix', 'pago', 'Freelance'),
    (v_family_id, v_user_id, 'receita', '2024-12-20', 1500.00, v_cat_salario_id, 'transferencia', 'pago', '13º Salário');

  -- DESPESAS DEZEMBRO - Alimentação (mais gastos devido às festas)
  INSERT INTO lancamentos (family_id, criado_por, tipo, data, valor, categoria_id, forma_pagamento, cartao_id, status, observacao)
  VALUES
    (v_family_id, v_user_id, 'despesa', '2024-12-02', 380.00, v_cat_alimentacao_id, 'debito', NULL, 'pago', 'Supermercado'),
    (v_family_id, v_user_id, 'despesa', '2024-12-05', 52.00, v_cat_alimentacao_id, 'credito', v_cartao1_id, 'pago', 'Almoço'),
    (v_family_id, v_user_id, 'despesa', '2024-12-08', 95.00, v_cat_alimentacao_id, 'pix', NULL, 'pago', 'Delivery'),
    (v_family_id, v_user_id, 'despesa', '2024-12-12', 180.00, v_cat_alimentacao_id, 'debito', NULL, 'pago', 'Feira'),
    (v_family_id, v_user_id, 'despesa', '2024-12-15', 420.00, v_cat_alimentacao_id, 'credito', v_cartao2_id, 'pago', 'Supermercado - Compras de Natal'),
    (v_family_id, v_user_id, 'despesa', '2024-12-18', 75.00, v_cat_alimentacao_id, 'dinheiro', NULL, 'pago', 'Padaria'),
    (v_family_id, v_user_id, 'despesa', '2024-12-20', 250.00, v_cat_alimentacao_id, 'credito', v_cartao1_id, 'pago', 'Ceia de Natal - Ingredientes'),
    (v_family_id, v_user_id, 'despesa', '2024-12-22', 89.90, v_cat_alimentacao_id, 'credito', v_cartao3_id, 'pago', 'Delivery - Pizza'),
    (v_family_id, v_user_id, 'despesa', '2024-12-26', 150.00, v_cat_alimentacao_id, 'pix', NULL, 'pago', 'Almoço em família'),
    (v_family_id, v_user_id, 'despesa', '2024-12-28', 68.50, v_cat_alimentacao_id, 'dinheiro', NULL, 'pago', 'Lanchonete');

  -- DESPESAS DEZEMBRO - Transporte
  IF v_cat_transporte_id IS NOT NULL THEN
    INSERT INTO lancamentos (family_id, criado_por, tipo, data, valor, categoria_id, forma_pagamento, cartao_id, status, observacao)
    VALUES
      (v_family_id, v_user_id, 'despesa', '2024-12-03', 270.00, v_cat_transporte_id, 'debito', NULL, 'pago', 'Combustível'),
      (v_family_id, v_user_id, 'despesa', '2024-12-07', 45.00, v_cat_transporte_id, 'pix', NULL, 'pago', 'Uber'),
      (v_family_id, v_user_id, 'despesa', '2024-12-11', 180.00, v_cat_transporte_id, 'debito', NULL, 'pago', 'Recarga transporte'),
      (v_family_id, v_user_id, 'despesa', '2024-12-18', 300.00, v_cat_transporte_id, 'credito', v_cartao2_id, 'pago', 'Combustível'),
      (v_family_id, v_user_id, 'despesa', '2024-12-22', 80.00, v_cat_transporte_id, 'dinheiro', NULL, 'pago', 'Uber - Festas');
  END IF;

  -- DESPESAS DEZEMBRO - Moradia
  IF v_cat_moradia_id IS NOT NULL THEN
    INSERT INTO lancamentos (family_id, criado_por, tipo, data, valor, categoria_id, forma_pagamento, status, observacao)
    VALUES
      (v_family_id, v_user_id, 'despesa', '2024-12-01', 1500.00, v_cat_moradia_id, 'transferencia', 'pago', 'Aluguel'),
      (v_family_id, v_user_id, 'despesa', '2024-12-05', 350.00, v_cat_moradia_id, 'boleto', 'pago', 'Condomínio'),
      (v_family_id, v_user_id, 'despesa', '2024-12-10', 215.80, v_cat_moradia_id, 'debito', 'pago', 'Conta de luz (mais alta no verão)'),
      (v_family_id, v_user_id, 'despesa', '2024-12-12', 98.50, v_cat_moradia_id, 'debito', 'pago', 'Conta de água'),
      (v_family_id, v_user_id, 'despesa', '2024-12-15', 119.90, v_cat_moradia_id, 'debito', 'pago', 'Internet');
  END IF;

  -- DESPESAS DEZEMBRO - Saúde
  IF v_cat_saude_id IS NOT NULL THEN
    INSERT INTO lancamentos (family_id, criado_por, tipo, data, valor, categoria_id, forma_pagamento, cartao_id, status, observacao)
    VALUES
      (v_family_id, v_user_id, 'despesa', '2024-12-06', 65.00, v_cat_saude_id, 'debito', NULL, 'pago', 'Farmácia'),
      (v_family_id, v_user_id, 'despesa', '2024-12-15', 450.00, v_cat_saude_id, 'credito', v_cartao3_id, 'pago', 'Plano de saúde'),
      (v_family_id, v_user_id, 'despesa', '2024-12-28', 180.00, v_cat_saude_id, 'pix', NULL, 'pago', 'Consulta médica');
  END IF;

  -- DESPESAS DEZEMBRO - Lazer (mais gastos com festas e presentes)
  IF v_cat_lazer_id IS NOT NULL THEN
    INSERT INTO lancamentos (family_id, criado_por, tipo, data, valor, categoria_id, forma_pagamento, cartao_id, status, observacao)
    VALUES
      (v_family_id, v_user_id, 'despesa', '2024-12-08', 50.00, v_cat_lazer_id, 'credito', v_cartao1_id, 'pago', 'Cinema'),
      (v_family_id, v_user_id, 'despesa', '2024-12-14', 29.90, v_cat_lazer_id, 'credito', v_cartao2_id, 'pago', 'Netflix'),
      (v_family_id, v_user_id, 'despesa', '2024-12-18', 350.00, v_cat_lazer_id, 'credito', v_cartao1_id, 'pago', 'Presente de Natal - Eletrônico'),
      (v_family_id, v_user_id, 'despesa', '2024-12-20', 180.00, v_cat_lazer_id, 'credito', v_cartao2_id, 'pago', 'Presente de Natal - Roupas'),
      (v_family_id, v_user_id, 'despesa', '2024-12-24', 200.00, v_cat_lazer_id, 'pix', NULL, 'pago', 'Amigo secreto'),
      (v_family_id, v_user_id, 'despesa', '2024-12-31', 300.00, v_cat_lazer_id, 'pix', NULL, 'pago', 'Reveillon');
  END IF;

  -- DESPESAS DEZEMBRO - Educação
  IF v_cat_educacao_id IS NOT NULL THEN
    INSERT INTO lancamentos (family_id, criado_por, tipo, data, valor, categoria_id, forma_pagamento, cartao_id, status, observacao)
    VALUES
      (v_family_id, v_user_id, 'despesa', '2024-12-10', 49.90, v_cat_educacao_id, 'credito', v_cartao1_id, 'pago', 'Curso online'),
      (v_family_id, v_user_id, 'despesa', '2024-12-20', 95.00, v_cat_educacao_id, 'pix', NULL, 'pago', 'Livro');
  END IF;

  RAISE NOTICE '   ✅ Lançamentos de DEZEMBRO criados';
  RAISE NOTICE '';

  -- ============================================================================
  -- 6. CRIAR ORÇAMENTOS MENSAIS
  -- ============================================================================

  RAISE NOTICE '📊 Criando orçamentos mensais...';

  -- Orçamento de NOVEMBRO
  INSERT INTO orcamentos_mensais (family_id, criado_por, mes_referencia, meta_poupanca, dia_inicio_ciclo, status)
  VALUES
    (v_family_id, v_user_id, '2024-11-01', 1000.00, 1, 'fechado')
  ON CONFLICT (family_id, mes_referencia) DO NOTHING;

  -- Adicionar categorias ao orçamento de novembro
  INSERT INTO categorias_budget (orcamento_id, categoria_id, valor_orcado, prioridade)
  SELECT
    o.id,
    c.id,
    CASE
      WHEN c.nome ILIKE '%alimenta%' THEN 1200.00
      WHEN c.nome ILIKE '%morad%' THEN 2300.00
      WHEN c.nome ILIKE '%transport%' THEN 800.00
      WHEN c.nome ILIKE '%sa%de%' THEN 600.00
      WHEN c.nome ILIKE '%lazer%' THEN 400.00
      WHEN c.nome ILIKE '%educa%' THEN 300.00
      ELSE 200.00
    END,
    (CASE
      WHEN c.nome ILIKE '%morad%' OR c.nome ILIKE '%alimenta%' OR c.nome ILIKE '%sa%de%' THEN 'essencial'
      WHEN c.nome ILIKE '%transport%' OR c.nome ILIKE '%educa%' THEN 'importante'
      ELSE 'desejavel'
    END)::categoria_prioridade
  FROM orcamentos_mensais o
  CROSS JOIN categorias c
  WHERE o.family_id = v_family_id
    AND o.mes_referencia = '2024-11-01'
    AND c.family_id = v_family_id
    AND c.tipo = 'despesa'
    AND c.categoria_pai_id IS NULL
  ON CONFLICT (orcamento_id, categoria_id) DO NOTHING;

  -- Orçamento de DEZEMBRO
  INSERT INTO orcamentos_mensais (family_id, criado_por, mes_referencia, meta_poupanca, dia_inicio_ciclo, status)
  VALUES
    (v_family_id, v_user_id, '2024-12-01', 1500.00, 1, 'ativo')
  ON CONFLICT (family_id, mes_referencia) DO NOTHING;

  -- Adicionar categorias ao orçamento de dezembro (valores maiores devido às festas)
  INSERT INTO categorias_budget (orcamento_id, categoria_id, valor_orcado, prioridade)
  SELECT
    o.id,
    c.id,
    CASE
      WHEN c.nome ILIKE '%alimenta%' THEN 1800.00  -- Maior para festas
      WHEN c.nome ILIKE '%morad%' THEN 2300.00
      WHEN c.nome ILIKE '%transport%' THEN 900.00
      WHEN c.nome ILIKE '%sa%de%' THEN 700.00
      WHEN c.nome ILIKE '%lazer%' THEN 1200.00  -- Maior para presentes
      WHEN c.nome ILIKE '%educa%' THEN 200.00
      ELSE 300.00
    END,
    (CASE
      WHEN c.nome ILIKE '%morad%' OR c.nome ILIKE '%alimenta%' OR c.nome ILIKE '%sa%de%' THEN 'essencial'
      WHEN c.nome ILIKE '%transport%' OR c.nome ILIKE '%educa%' THEN 'importante'
      ELSE 'desejavel'
    END)::categoria_prioridade
  FROM orcamentos_mensais o
  CROSS JOIN categorias c
  WHERE o.family_id = v_family_id
    AND o.mes_referencia = '2024-12-01'
    AND c.family_id = v_family_id
    AND c.tipo = 'despesa'
    AND c.categoria_pai_id IS NULL
  ON CONFLICT (orcamento_id, categoria_id) DO NOTHING;

  SELECT COUNT(*) INTO v_total_orcamentos FROM orcamentos_mensais WHERE family_id = v_family_id;
  RAISE NOTICE '   ✅ % orçamentos criados', v_total_orcamentos;
  RAISE NOTICE '';

  -- ============================================================================
  -- 7. RELATÓRIO FINAL
  -- ============================================================================

  SELECT COUNT(*) INTO v_total_categorias FROM categorias WHERE family_id = v_family_id;
  SELECT COUNT(*) INTO v_total_lancamentos FROM lancamentos WHERE family_id = v_family_id;

  RAISE NOTICE '';
  RAISE NOTICE '====================================';
  RAISE NOTICE '✅ SEED CONCLUÍDO COM SUCESSO!';
  RAISE NOTICE '====================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 RESUMO:';
  RAISE NOTICE '   • Cartões: %', v_total_cartoes;
  RAISE NOTICE '   • Categorias: %', v_total_categorias;
  RAISE NOTICE '   • Subcategorias: %', v_total_subcategorias;
  RAISE NOTICE '   • Lançamentos: %', v_total_lancamentos;
  RAISE NOTICE '   • Orçamentos: %', v_total_orcamentos;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Dados criados para:';
  RAISE NOTICE '   • Novembro/2024: ~30 lançamentos';
  RAISE NOTICE '   • Dezembro/2024: ~35 lançamentos';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Agora você pode:';
  RAISE NOTICE '   1. Explorar o Dashboard com dados reais';
  RAISE NOTICE '   2. Ver gráficos e estatísticas';
  RAISE NOTICE '   3. Testar filtros e buscas';
  RAISE NOTICE '   4. Acompanhar orçamentos';
  RAISE NOTICE '';

END $$;
