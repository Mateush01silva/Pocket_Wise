-- ============================================================================
-- SCRIPT: Ajustar valores monetários da conta de demonstração
-- ============================================================================
-- Aplica um fator multiplicador em todos os campos monetários da conta
-- tufo.henrique@hotmail.com.
--
-- ATENÇÃO: o FACTOR é relativo aos valores ATUAIS da conta.
--   Exemplos:
--     FACTOR := 0.80  → reduz 20% dos valores atuais
--     FACTOR := 1.20  → aumenta 20% dos valores atuais
--     FACTOR := 0.50  → reduz à metade dos valores atuais
--
-- O script pode ser executado múltiplas vezes sem efeitos colaterais.
-- ============================================================================

DO $$
DECLARE
  -- *** ALTERE AQUI ***
  FACTOR CONSTANT DECIMAL := 0.80;

  v_dst_email  TEXT := 'tufo.henrique@hotmail.com';
  v_dst_user_id   UUID;
  v_dst_family_id UUID;

BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE ' AJUSTE CONTA DEMO - tufo.henrique@hotmail.com';
  RAISE NOTICE ' Fator: %', FACTOR;
  RAISE NOTICE '================================================';
  RAISE NOTICE '';

  -- ============================================================================
  -- 1. RESOLVER IDs
  -- ============================================================================

  SELECT u.id, u.family_id INTO v_dst_user_id, v_dst_family_id
  FROM users u
  JOIN auth.users au ON au.id = u.id
  WHERE au.email = v_dst_email;

  IF v_dst_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado: %', v_dst_email;
  END IF;
  IF v_dst_family_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem family_id: %', v_dst_email;
  END IF;

  RAISE NOTICE 'user_id  : %', v_dst_user_id;
  RAISE NOTICE 'family_id: %', v_dst_family_id;
  RAISE NOTICE '';

  -- ============================================================================
  -- 2. LANÇAMENTOS
  -- Desabilitamos o trigger de update para que ele não recalcule o saldo das
  -- contas bancárias — nós atualizamos esse saldo diretamente no passo 3.
  -- ============================================================================

  ALTER TABLE lancamentos DISABLE TRIGGER trigger_atualizar_saldo_conta_update;

  UPDATE lancamentos
  SET valor = ROUND(valor * FACTOR, 2)
  WHERE family_id = v_dst_family_id;

  ALTER TABLE lancamentos ENABLE TRIGGER trigger_atualizar_saldo_conta_update;

  RAISE NOTICE 'Lançamentos atualizados: %',
    (SELECT COUNT(*) FROM lancamentos WHERE family_id = v_dst_family_id);

  -- ============================================================================
  -- 3. CONTAS BANCÁRIAS
  -- ============================================================================

  UPDATE contas_bancarias
  SET saldo_inicial = ROUND(saldo_inicial * FACTOR, 2),
      saldo_atual   = ROUND(saldo_atual   * FACTOR, 2)
  WHERE family_id = v_dst_family_id;

  RAISE NOTICE 'Contas bancárias atualizadas: %',
    (SELECT COUNT(*) FROM contas_bancarias WHERE family_id = v_dst_family_id);

  -- ============================================================================
  -- 4. CARTÕES
  -- ============================================================================

  UPDATE cartoes
  SET limite = CASE WHEN limite IS NOT NULL THEN ROUND(limite * FACTOR, 2) END
  WHERE family_id = v_dst_family_id;

  RAISE NOTICE 'Cartões atualizados: %',
    (SELECT COUNT(*) FROM cartoes WHERE family_id = v_dst_family_id);

  -- ============================================================================
  -- 5. CAIXINHAS
  -- O trigger de caixinhas dispara apenas em INSERT/DELETE, não em UPDATE —
  -- portanto podemos atualizar saldo_atual diretamente sem problemas.
  -- ============================================================================

  UPDATE caixinhas
  SET meta_valor   = CASE WHEN meta_valor   IS NOT NULL THEN ROUND(meta_valor   * FACTOR, 2) END,
      saldo_atual  = ROUND(saldo_atual  * FACTOR, 2),
      valor_mercado = CASE WHEN valor_mercado IS NOT NULL THEN ROUND(valor_mercado * FACTOR, 2) END
  WHERE family_id = v_dst_family_id;

  RAISE NOTICE 'Caixinhas atualizadas: %',
    (SELECT COUNT(*) FROM caixinhas WHERE family_id = v_dst_family_id);

  -- ============================================================================
  -- 6. TRANSAÇÕES DAS CAIXINHAS
  -- ============================================================================

  UPDATE transacoes_caixinhas
  SET valor = ROUND(valor * FACTOR, 2)
  WHERE caixinha_id IN (
    SELECT id FROM caixinhas WHERE family_id = v_dst_family_id
  );

  RAISE NOTICE 'Transações de caixinhas atualizadas: %',
    (SELECT COUNT(*) FROM transacoes_caixinhas
     WHERE caixinha_id IN (SELECT id FROM caixinhas WHERE family_id = v_dst_family_id));

  -- ============================================================================
  -- 7. ASSINATURAS
  -- ============================================================================

  UPDATE assinaturas
  SET valor = ROUND(valor * FACTOR, 2)
  WHERE user_id = v_dst_user_id;

  RAISE NOTICE 'Assinaturas atualizadas: %',
    (SELECT COUNT(*) FROM assinaturas WHERE user_id = v_dst_user_id);

  -- ============================================================================
  -- 8. ORÇAMENTOS MENSAIS
  -- ============================================================================

  UPDATE orcamentos_mensais
  SET meta_poupanca = ROUND(meta_poupanca * FACTOR, 2)
  WHERE family_id = v_dst_family_id;

  RAISE NOTICE 'Orçamentos mensais atualizados: %',
    (SELECT COUNT(*) FROM orcamentos_mensais WHERE family_id = v_dst_family_id);

  -- ============================================================================
  -- 9. CATEGORIAS BUDGET (envelopes)
  -- ============================================================================

  UPDATE categorias_budget
  SET valor_orcado = ROUND(valor_orcado * FACTOR, 2)
  WHERE orcamento_id IN (
    SELECT id FROM orcamentos_mensais WHERE family_id = v_dst_family_id
  );

  RAISE NOTICE 'Categorias budget atualizadas: %',
    (SELECT COUNT(*) FROM categorias_budget
     WHERE orcamento_id IN (SELECT id FROM orcamentos_mensais WHERE family_id = v_dst_family_id));

  -- ============================================================================
  -- 10. PLANEJAMENTOS
  -- ============================================================================

  UPDATE planejamentos
  SET valor = ROUND(valor * FACTOR, 2)
  WHERE family_id = v_dst_family_id;

  RAISE NOTICE 'Planejamentos atualizados: %',
    (SELECT COUNT(*) FROM planejamentos WHERE family_id = v_dst_family_id);

  -- ============================================================================
  -- 11. RECEITAS PROJETADAS
  -- ============================================================================

  UPDATE receitas_projetadas
  SET valor = ROUND(valor * FACTOR, 2)
  WHERE family_id = v_dst_family_id;

  RAISE NOTICE 'Receitas projetadas atualizadas: %',
    (SELECT COUNT(*) FROM receitas_projetadas WHERE family_id = v_dst_family_id);

  -- ============================================================================
  -- RESUMO FINAL
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE ' CONCLUÍDO COM SUCESSO!';
  RAISE NOTICE '  Conta: %', v_dst_email;
  RAISE NOTICE '  Fator aplicado: %', FACTOR;
  RAISE NOTICE '================================================';
  RAISE NOTICE '';

END $$;
