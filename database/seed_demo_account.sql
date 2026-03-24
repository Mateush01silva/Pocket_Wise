-- ============================================================================
-- SCRIPT: Clonar dados para conta de demonstração
-- ============================================================================
-- Copia todos os dados financeiros de silva.mateush01@gmail.com para
-- tufo.henrique@hotmail.com, reduzindo todos os valores monetários em 0,63%.
--
-- O script é IDEMPOTENTE: limpa os dados anteriores da conta destino antes
-- de reinserir. Pode ser executado múltiplas vezes sem duplicar dados.
-- ============================================================================

DO $$
DECLARE
  -- Usuários
  v_src_email  TEXT := 'silva.mateush01@gmail.com';
  v_dst_email  TEXT := 'tufo.henrique@hotmail.com';

  v_src_user_id   UUID;
  v_src_family_id UUID;
  v_dst_user_id   UUID;
  v_dst_family_id UUID;

  -- Fator: 63% do valor original (redução de 37%)
  FACTOR CONSTANT DECIMAL := 0.63;

BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE ' SEED CONTA DEMO - tufo.henrique@hotmail.com';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';

  -- ============================================================================
  -- 1. RESOLVER IDs DE ORIGEM E DESTINO
  -- ============================================================================

  SELECT id, family_id INTO v_src_user_id, v_src_family_id
  FROM users WHERE email = v_src_email;

  IF v_src_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário origem não encontrado: %', v_src_email;
  END IF;
  IF v_src_family_id IS NULL THEN
    RAISE EXCEPTION 'Usuário origem sem family_id: %', v_src_email;
  END IF;

  SELECT id, family_id INTO v_dst_user_id, v_dst_family_id
  FROM users WHERE email = v_dst_email;

  IF v_dst_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário destino não encontrado: %', v_dst_email;
  END IF;
  IF v_dst_family_id IS NULL THEN
    RAISE EXCEPTION 'Usuário destino sem family_id: %', v_dst_email;
  END IF;

  RAISE NOTICE 'Origem : % (user: %, family: %)', v_src_email, v_src_user_id, v_src_family_id;
  RAISE NOTICE 'Destino: % (user: %, family: %)', v_dst_email, v_dst_user_id, v_dst_family_id;
  RAISE NOTICE '';

  -- ============================================================================
  -- 2. LIMPAR DADOS ANTERIORES DA CONTA DESTINO (ordem inversa de dependência)
  -- ============================================================================

  RAISE NOTICE 'Limpando dados anteriores da conta destino...';

  DELETE FROM categorias_budget
  WHERE orcamento_id IN (SELECT id FROM orcamentos_mensais WHERE family_id = v_dst_family_id);

  DELETE FROM alertas_orcamento    WHERE family_id = v_dst_family_id;
  DELETE FROM orcamentos_mensais   WHERE family_id = v_dst_family_id;

  DELETE FROM transacoes_caixinhas
  WHERE caixinha_id IN (SELECT id FROM caixinhas WHERE family_id = v_dst_family_id);

  DELETE FROM caixinhas            WHERE family_id = v_dst_family_id;
  DELETE FROM planejamentos        WHERE family_id = v_dst_family_id;
  DELETE FROM receitas_projetadas  WHERE family_id = v_dst_family_id;
  DELETE FROM lancamentos          WHERE family_id = v_dst_family_id;
  DELETE FROM assinaturas          WHERE user_id   = v_dst_user_id;
  DELETE FROM contas_bancarias     WHERE family_id = v_dst_family_id;
  DELETE FROM cartoes              WHERE family_id = v_dst_family_id;
  DELETE FROM categorias           WHERE family_id = v_dst_family_id;

  RAISE NOTICE 'Dados anteriores removidos.';
  RAISE NOTICE '';

  -- ============================================================================
  -- 3. CATEGORIAS (com mapeamento de IDs, duas passadas para suportar subcats)
  -- ============================================================================

  RAISE NOTICE 'Copiando categorias...';

  -- Tabela temporária de mapeamento: old_id → new_id
  CREATE TEMP TABLE IF NOT EXISTS tmp_cat_map (
    old_id UUID PRIMARY KEY,
    new_id UUID NOT NULL
  ) ON COMMIT DELETE ROWS;
  TRUNCATE tmp_cat_map;

  -- Passada 1: categorias raiz (sem pai)
  INSERT INTO categorias (id, family_id, nome, icone, tipo, categoria_pai_id, cor, despesa_fixa, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    v_dst_family_id,
    c.nome,
    c.icone,
    c.tipo,
    NULL,  -- pai ainda não mapeado
    c.cor,
    c.despesa_fixa,
    NOW(),
    NOW()
  FROM categorias c
  WHERE c.family_id = v_src_family_id
    AND c.categoria_pai_id IS NULL;

  -- Popula mapeamento para categorias raiz (por nome+tipo, garantindo unicidade)
  INSERT INTO tmp_cat_map (old_id, new_id)
  SELECT s.id, d.id
  FROM categorias s
  JOIN categorias d
    ON d.family_id = v_dst_family_id
   AND d.nome = s.nome
   AND d.tipo = s.tipo
   AND d.categoria_pai_id IS NULL
  WHERE s.family_id = v_src_family_id
    AND s.categoria_pai_id IS NULL
  ON CONFLICT DO NOTHING;

  -- Passada 2: subcategorias (com pai mapeado)
  INSERT INTO categorias (id, family_id, nome, icone, tipo, categoria_pai_id, cor, despesa_fixa, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    v_dst_family_id,
    c.nome,
    c.icone,
    c.tipo,
    m.new_id,   -- pai mapeado
    c.cor,
    c.despesa_fixa,
    NOW(),
    NOW()
  FROM categorias c
  JOIN tmp_cat_map m ON m.old_id = c.categoria_pai_id
  WHERE c.family_id = v_src_family_id
    AND c.categoria_pai_id IS NOT NULL;

  -- Popula mapeamento para subcategorias
  INSERT INTO tmp_cat_map (old_id, new_id)
  SELECT s.id, d.id
  FROM categorias s
  JOIN tmp_cat_map pm ON pm.old_id = s.categoria_pai_id
  JOIN categorias d
    ON d.family_id = v_dst_family_id
   AND d.nome = s.nome
   AND d.tipo = s.tipo
   AND d.categoria_pai_id = pm.new_id
  WHERE s.family_id = v_src_family_id
    AND s.categoria_pai_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '  Categorias copiadas: %', (SELECT COUNT(*) FROM tmp_cat_map);

  -- ============================================================================
  -- 4. CARTÕES
  -- ============================================================================

  RAISE NOTICE 'Copiando cartões...';

  CREATE TEMP TABLE IF NOT EXISTS tmp_cartao_map (
    old_id UUID PRIMARY KEY,
    new_id UUID NOT NULL
  ) ON COMMIT DELETE ROWS;
  TRUNCATE tmp_cartao_map;

  -- Insere novos cartões e guarda mapeamento
  WITH inserted AS (
    INSERT INTO cartoes (id, family_id, nome, dia_fechamento, dia_vencimento, limite, cor, ativo, created_at, updated_at)
    SELECT
      gen_random_uuid(),
      v_dst_family_id,
      c.nome,
      c.dia_fechamento,
      c.dia_vencimento,
      ROUND(c.limite * FACTOR, 2),
      c.cor,
      c.ativo,
      NOW(),
      NOW()
    FROM cartoes c
    WHERE c.family_id = v_src_family_id
    RETURNING id, nome
  )
  INSERT INTO tmp_cartao_map (old_id, new_id)
  SELECT s.id, i.id
  FROM cartoes s
  JOIN inserted i ON i.nome = s.nome
  WHERE s.family_id = v_src_family_id
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '  Cartões copiados: %', (SELECT COUNT(*) FROM tmp_cartao_map);

  -- ============================================================================
  -- 5. CONTAS BANCÁRIAS
  -- ============================================================================

  RAISE NOTICE 'Copiando contas bancárias...';

  CREATE TEMP TABLE IF NOT EXISTS tmp_conta_map (
    old_id UUID PRIMARY KEY,
    new_id UUID NOT NULL
  ) ON COMMIT DELETE ROWS;
  TRUNCATE tmp_conta_map;

  WITH inserted AS (
    INSERT INTO contas_bancarias (id, family_id, nome, tipo, saldo_inicial, saldo_atual, cor, icone, ativo, instituicao, agencia, numero_conta, created_at, updated_at)
    SELECT
      gen_random_uuid(),
      v_dst_family_id,
      cb.nome,
      cb.tipo,
      ROUND(cb.saldo_inicial * FACTOR, 2),
      ROUND(cb.saldo_atual   * FACTOR, 2),
      cb.cor,
      cb.icone,
      cb.ativo,
      cb.instituicao,
      cb.agencia,
      cb.numero_conta,
      NOW(),
      NOW()
    FROM contas_bancarias cb
    WHERE cb.family_id = v_src_family_id
    RETURNING id, nome
  )
  INSERT INTO tmp_conta_map (old_id, new_id)
  SELECT s.id, i.id
  FROM contas_bancarias s
  JOIN inserted i ON i.nome = s.nome
  WHERE s.family_id = v_src_family_id
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '  Contas bancárias copiadas: %', (SELECT COUNT(*) FROM tmp_conta_map);

  -- ============================================================================
  -- 6. LANÇAMENTOS
  -- ============================================================================

  RAISE NOTICE 'Copiando lançamentos...';

  -- Mapa para grupos de parcelas
  CREATE TEMP TABLE IF NOT EXISTS tmp_parcela_map (
    old_grupo UUID PRIMARY KEY,
    new_grupo UUID NOT NULL
  ) ON COMMIT DELETE ROWS;
  TRUNCATE tmp_parcela_map;

  INSERT INTO tmp_parcela_map (old_grupo, new_grupo)
  SELECT DISTINCT grupo_parcelas_id, gen_random_uuid()
  FROM lancamentos
  WHERE family_id = v_src_family_id
    AND grupo_parcelas_id IS NOT NULL;

  INSERT INTO lancamentos (
    id, family_id, criado_por, tipo, data, valor,
    categoria_id, subcategoria_id, observacao, forma_pagamento,
    cartao_id, parcela_atual, parcela_total, grupo_parcelas_id,
    status, data_vencimento_fatura, conta_id,
    created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    v_dst_family_id,
    v_dst_user_id,
    l.tipo,
    l.data,
    ROUND(l.valor * FACTOR, 2),
    cm.new_id,                              -- categoria mapeada
    scm.new_id,                             -- subcategoria mapeada (pode ser NULL)
    l.observacao,
    l.forma_pagamento,
    ctm.new_id,                             -- cartão mapeado (pode ser NULL)
    l.parcela_atual,
    l.parcela_total,
    pm.new_grupo,                           -- grupo parcelas mapeado (pode ser NULL)
    l.status,
    l.data_vencimento_fatura,
    cotm.new_id,                            -- conta mapeada (pode ser NULL)
    NOW(),
    NOW()
  FROM lancamentos l
  LEFT JOIN tmp_cat_map    cm  ON cm.old_id  = l.categoria_id
  LEFT JOIN tmp_cat_map    scm ON scm.old_id = l.subcategoria_id
  LEFT JOIN tmp_cartao_map ctm ON ctm.old_id = l.cartao_id
  LEFT JOIN tmp_conta_map  cotm ON cotm.old_id = l.conta_id
  LEFT JOIN tmp_parcela_map pm ON pm.old_grupo = l.grupo_parcelas_id
  WHERE l.family_id = v_src_family_id;

  RAISE NOTICE '  Lançamentos copiados: %',
    (SELECT COUNT(*) FROM lancamentos WHERE family_id = v_dst_family_id);

  -- ============================================================================
  -- 7. CAIXINHAS + TRANSAÇÕES DE CAIXINHAS
  -- ============================================================================

  RAISE NOTICE 'Copiando caixinhas...';

  CREATE TEMP TABLE IF NOT EXISTS tmp_caixinha_map (
    old_id UUID PRIMARY KEY,
    new_id UUID NOT NULL
  ) ON COMMIT DELETE ROWS;
  TRUNCATE tmp_caixinha_map;

  WITH inserted AS (
    INSERT INTO caixinhas (
      id, family_id, criado_por, nome, tipo, meta_valor, prazo_data,
      icone, saldo_atual, ativa, cor, descricao,
      investimento_categoria, mes_referencia,
      created_at, updated_at
    )
    SELECT
      gen_random_uuid(),
      v_dst_family_id,
      v_dst_user_id,
      cx.nome,
      cx.tipo,
      CASE WHEN cx.meta_valor IS NOT NULL THEN ROUND(cx.meta_valor * FACTOR, 2) END,
      cx.prazo_data,
      cx.icone,
      ROUND(cx.saldo_atual * FACTOR, 2),
      cx.ativa,
      cx.cor,
      cx.descricao,
      cx.investimento_categoria,
      cx.mes_referencia,
      NOW(),
      NOW()
    FROM caixinhas cx
    WHERE cx.family_id = v_src_family_id
    RETURNING id, nome
  )
  INSERT INTO tmp_caixinha_map (old_id, new_id)
  SELECT s.id, i.id
  FROM caixinhas s
  JOIN inserted i ON i.nome = s.nome
  WHERE s.family_id = v_src_family_id
  ON CONFLICT DO NOTHING;

  -- Transações das caixinhas
  INSERT INTO transacoes_caixinhas (id, caixinha_id, realizado_por, valor, tipo, descricao, origem_mes_referencia, created_at)
  SELECT
    gen_random_uuid(),
    m.new_id,
    v_dst_user_id,
    ROUND(tc.valor * FACTOR, 2),
    tc.tipo,
    tc.descricao,
    tc.origem_mes_referencia,
    tc.created_at
  FROM transacoes_caixinhas tc
  JOIN tmp_caixinha_map m ON m.old_id = tc.caixinha_id;

  RAISE NOTICE '  Caixinhas copiadas: %', (SELECT COUNT(*) FROM tmp_caixinha_map);

  -- ============================================================================
  -- 8. ASSINATURAS
  -- ============================================================================

  RAISE NOTICE 'Copiando assinaturas...';

  INSERT INTO assinaturas (
    id, user_id, nome, logo_url, valor, frequencia, dia_cobranca,
    categoria_id, subcategoria_id, primeira_cobranca, ultima_cobranca,
    ativa, cartao_id, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    v_dst_user_id,
    a.nome,
    a.logo_url,
    ROUND(a.valor * FACTOR, 2),
    a.frequencia,
    a.dia_cobranca,
    cm.new_id,
    scm.new_id,
    a.primeira_cobranca,
    a.ultima_cobranca,
    a.ativa,
    ctm.new_id,
    NOW(),
    NOW()
  FROM assinaturas a
  LEFT JOIN tmp_cat_map    cm  ON cm.old_id  = a.categoria_id
  LEFT JOIN tmp_cat_map    scm ON scm.old_id = a.subcategoria_id
  LEFT JOIN tmp_cartao_map ctm ON ctm.old_id = a.cartao_id
  WHERE a.user_id = v_src_user_id;

  RAISE NOTICE '  Assinaturas copiadas: %',
    (SELECT COUNT(*) FROM assinaturas WHERE user_id = v_dst_user_id);

  -- ============================================================================
  -- 9. ORÇAMENTOS MENSAIS + CATEGORIAS BUDGET
  -- ============================================================================

  RAISE NOTICE 'Copiando orçamentos mensais...';

  CREATE TEMP TABLE IF NOT EXISTS tmp_orcamento_map (
    old_id UUID PRIMARY KEY,
    new_id UUID NOT NULL
  ) ON COMMIT DELETE ROWS;
  TRUNCATE tmp_orcamento_map;

  WITH inserted AS (
    INSERT INTO orcamentos_mensais (
      id, family_id, criado_por, mes_referencia,
      meta_poupanca, meta_poupanca_percentual,
      dia_inicio_ciclo, metodo_calculo, status,
      created_at, updated_at
    )
    SELECT
      gen_random_uuid(),
      v_dst_family_id,
      v_dst_user_id,
      om.mes_referencia,
      CASE WHEN om.meta_poupanca IS NOT NULL THEN ROUND(om.meta_poupanca * FACTOR, 2) END,
      om.meta_poupanca_percentual,
      om.dia_inicio_ciclo,
      om.metodo_calculo,
      om.status,
      NOW(),
      NOW()
    FROM orcamentos_mensais om
    WHERE om.family_id = v_src_family_id
    RETURNING id, mes_referencia
  )
  INSERT INTO tmp_orcamento_map (old_id, new_id)
  SELECT s.id, i.id
  FROM orcamentos_mensais s
  JOIN inserted i ON i.mes_referencia = s.mes_referencia
  WHERE s.family_id = v_src_family_id
  ON CONFLICT DO NOTHING;

  -- Envelopes de categorias dos orçamentos
  INSERT INTO categorias_budget (id, orcamento_id, categoria_id, valor_orcado, prioridade, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    om.new_id,
    cm.new_id,
    ROUND(cb.valor_orcado * FACTOR, 2),
    cb.prioridade,
    NOW(),
    NOW()
  FROM categorias_budget cb
  JOIN tmp_orcamento_map om ON om.old_id = cb.orcamento_id
  JOIN tmp_cat_map       cm ON cm.old_id = cb.categoria_id;

  RAISE NOTICE '  Orçamentos copiados: %', (SELECT COUNT(*) FROM tmp_orcamento_map);

  -- ============================================================================
  -- 10. PLANEJAMENTOS
  -- ============================================================================

  RAISE NOTICE 'Copiando planejamentos...';

  INSERT INTO planejamentos (id, family_id, criado_por, nome, valor, data_prevista, categoria_id, observacoes, status, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    v_dst_family_id,
    v_dst_user_id,
    p.nome,
    ROUND(p.valor * FACTOR, 2),
    p.data_prevista,
    cm.new_id,
    p.observacoes,
    p.status,
    NOW(),
    NOW()
  FROM planejamentos p
  LEFT JOIN tmp_cat_map cm ON cm.old_id = p.categoria_id
  WHERE p.family_id = v_src_family_id;

  RAISE NOTICE '  Planejamentos copiados: %',
    (SELECT COUNT(*) FROM planejamentos WHERE family_id = v_dst_family_id);

  -- ============================================================================
  -- 11. RECEITAS PROJETADAS
  -- ============================================================================

  RAISE NOTICE 'Copiando receitas projetadas...';

  INSERT INTO receitas_projetadas (id, family_id, criado_por, descricao, valor, data_prevista, categoria_id, recorrente, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    v_dst_family_id,
    v_dst_user_id,
    rp.descricao,
    ROUND(rp.valor * FACTOR, 2),
    rp.data_prevista,
    cm.new_id,
    rp.recorrente,
    NOW(),
    NOW()
  FROM receitas_projetadas rp
  LEFT JOIN tmp_cat_map cm ON cm.old_id = rp.categoria_id
  WHERE rp.family_id = v_src_family_id;

  RAISE NOTICE '  Receitas projetadas copiadas: %',
    (SELECT COUNT(*) FROM receitas_projetadas WHERE family_id = v_dst_family_id);

  -- ============================================================================
  -- RESUMO FINAL
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE ' CONCLUÍDO COM SUCESSO!';
  RAISE NOTICE '  Conta demo: %', v_dst_email;
  RAISE NOTICE '  Fator aplicado: % (63%% do valor original)', FACTOR;
  RAISE NOTICE '================================================';
  RAISE NOTICE '';

END $$;
