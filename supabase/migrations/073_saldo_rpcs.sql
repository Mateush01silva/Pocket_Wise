-- =====================================================
-- Migration: RPCs atômicas para mutação de saldo de contas
-- Description: Substitui as escritas absolutas de saldo_atual feitas no
--              cliente (transferência entre contas, ajuste manual e fluxos
--              de caixinhas de investimento) por funções atômicas no banco.
--              Escrever saldo absoluto calculado a partir de estado local
--              (possivelmente desatualizado) sobrescreve os deltas aplicados
--              pelos triggers de lançamentos (lost update) e a transferência
--              em dois updates separados não é atômica.
--              SECURITY INVOKER: as RLS policies de contas_bancarias
--              continuam valendo dentro das funções.
-- =====================================================

-- =====================================================
-- 1) Transferência atômica entre contas
-- =====================================================
CREATE OR REPLACE FUNCTION transferir_entre_contas(
  p_conta_origem UUID,
  p_conta_destino UUID,
  p_valor NUMERIC
)
RETURNS VOID AS $$
DECLARE
  v_saldo_origem NUMERIC;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor da transferência deve ser maior que zero';
  END IF;

  IF p_conta_origem = p_conta_destino THEN
    RAISE EXCEPTION 'Conta de origem e destino devem ser diferentes';
  END IF;

  -- Lock das duas contas em ordem determinística para evitar deadlock
  PERFORM 1
  FROM contas_bancarias
  WHERE id IN (p_conta_origem, p_conta_destino)
  ORDER BY id
  FOR UPDATE;

  SELECT saldo_atual INTO v_saldo_origem
  FROM contas_bancarias
  WHERE id = p_conta_origem;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta de origem não encontrada';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM contas_bancarias WHERE id = p_conta_destino) THEN
    RAISE EXCEPTION 'Conta de destino não encontrada';
  END IF;

  IF v_saldo_origem < p_valor THEN
    RAISE EXCEPTION 'Saldo insuficiente na conta de origem';
  END IF;

  UPDATE contas_bancarias
  SET saldo_atual = saldo_atual - p_valor
  WHERE id = p_conta_origem;

  UPDATE contas_bancarias
  SET saldo_atual = saldo_atual + p_valor
  WHERE id = p_conta_destino;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2) Ajuste manual (reconciliação): define o saldo informado pelo usuário
--    Retorna o delta aplicado (novo - anterior)
-- =====================================================
CREATE OR REPLACE FUNCTION ajustar_saldo_conta(
  p_conta_id UUID,
  p_novo_saldo NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  v_saldo_anterior NUMERIC;
BEGIN
  IF p_novo_saldo IS NULL THEN
    RAISE EXCEPTION 'Informe o novo saldo';
  END IF;

  SELECT saldo_atual INTO v_saldo_anterior
  FROM contas_bancarias
  WHERE id = p_conta_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  UPDATE contas_bancarias
  SET saldo_atual = p_novo_saldo
  WHERE id = p_conta_id;

  RETURN p_novo_saldo - v_saldo_anterior;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3) Ajuste relativo (delta): para fluxos programáticos
--    (caixinhas de investimento). Retorna o novo saldo.
-- =====================================================
CREATE OR REPLACE FUNCTION ajustar_saldo_conta_delta(
  p_conta_id UUID,
  p_delta NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  v_novo_saldo NUMERIC;
BEGIN
  IF p_delta IS NULL THEN
    RAISE EXCEPTION 'Informe o delta do ajuste';
  END IF;

  UPDATE contas_bancarias
  SET saldo_atual = saldo_atual + p_delta
  WHERE id = p_conta_id
  RETURNING saldo_atual INTO v_novo_saldo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  RETURN v_novo_saldo;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION transferir_entre_contas(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION ajustar_saldo_conta(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION ajustar_saldo_conta_delta(UUID, NUMERIC) TO authenticated;
