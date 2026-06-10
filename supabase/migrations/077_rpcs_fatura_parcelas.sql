-- =====================================================
-- Migration: RPCs atômicas para pagamento de fatura e grupos de parcelas
-- Description: O pagamento de fatura era um loop de updates no cliente (um
--              por lançamento) e a edição/exclusão de parcelamento era
--              delete-grupo + recriação em loops — uma falha no meio deixava
--              fatura meio paga ou parcelas órfãs/perdidas. Estas funções
--              executam cada operação em uma única transação.
--              SECURITY INVOKER: as RLS policies de lancamentos continuam
--              valendo dentro das funções.
-- =====================================================

-- =====================================================
-- 1) Pagar fatura: marca como pagos (com conta de débito) todos os
--    lançamentos informados que ainda não estão pagos, atomicamente.
--    O trigger atualizar_saldo_conta debita a conta por lançamento,
--    dentro da mesma transação.
-- =====================================================
CREATE OR REPLACE FUNCTION pagar_fatura_lancamentos(
  p_lancamento_ids UUID[],
  p_conta_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_atualizados INTEGER;
BEGIN
  IF p_conta_id IS NULL THEN
    RAISE EXCEPTION 'Informe a conta de débito';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM contas_bancarias WHERE id = p_conta_id) THEN
    RAISE EXCEPTION 'Conta de débito não encontrada';
  END IF;

  UPDATE lancamentos
  SET conta_id = p_conta_id,
      status = 'pago'
  WHERE id = ANY(p_lancamento_ids)
    AND status != 'pago';

  GET DIAGNOSTICS v_atualizados = ROW_COUNT;
  RETURN v_atualizados;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2) Criar grupo de parcelas: insere todas as parcelas de uma vez
-- =====================================================
CREATE OR REPLACE FUNCTION criar_grupo_parcelas(p_parcelas JSONB)
RETURNS SETOF lancamentos AS $$
DECLARE
  v_family_id UUID;
BEGIN
  SELECT family_id INTO v_family_id FROM public.users WHERE id = auth.uid();
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem família ativa';
  END IF;

  RETURN QUERY
  INSERT INTO lancamentos (
    family_id, criado_por, tipo, categoria_id, subcategoria_id, valor, data,
    forma_pagamento, cartao_id, conta_id, observacao, status,
    parcela_atual, parcela_total, grupo_parcelas_id, data_vencimento_fatura
  )
  SELECT
    v_family_id,
    auth.uid(),
    p.tipo::transaction_type,
    p.categoria_id,
    p.subcategoria_id,
    p.valor,
    p.data,
    p.forma_pagamento::payment_method,
    p.cartao_id,
    p.conta_id,
    p.observacao,
    p.status::lancamento_status,
    p.parcela_atual,
    p.parcela_total,
    p.grupo_parcelas_id,
    p.data_vencimento_fatura
  FROM jsonb_to_recordset(p_parcelas) AS p(
    tipo TEXT,
    categoria_id UUID,
    subcategoria_id UUID,
    valor NUMERIC,
    data DATE,
    forma_pagamento TEXT,
    cartao_id UUID,
    conta_id UUID,
    observacao TEXT,
    status TEXT,
    parcela_atual INTEGER,
    parcela_total INTEGER,
    grupo_parcelas_id UUID,
    data_vencimento_fatura DATE
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3) Recriar grupo de parcelas (edição de parcelamento): apaga o grupo
--    antigo e insere o novo na MESMA transação
-- =====================================================
CREATE OR REPLACE FUNCTION recriar_grupo_parcelas(
  p_grupo_id UUID,
  p_parcelas JSONB
)
RETURNS SETOF lancamentos AS $$
BEGIN
  DELETE FROM lancamentos WHERE grupo_parcelas_id = p_grupo_id;
  RETURN QUERY SELECT * FROM criar_grupo_parcelas(p_parcelas);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4) Excluir grupo de parcelas atomicamente
-- =====================================================
CREATE OR REPLACE FUNCTION delete_grupo_parcelas(p_grupo_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_removidos INTEGER;
BEGIN
  DELETE FROM lancamentos WHERE grupo_parcelas_id = p_grupo_id;
  GET DIAGNOSTICS v_removidos = ROW_COUNT;
  RETURN v_removidos;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION pagar_fatura_lancamentos(UUID[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION criar_grupo_parcelas(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION recriar_grupo_parcelas(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_grupo_parcelas(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
