-- =====================================================
-- 081: Tags personalizadas e lançamentos em moeda estrangeira
-- =====================================================
-- tags:           rótulos livres (ex.: "Viagem Europa 2026") para filtrar
--                 gastos por assunto independente da categoria
-- moeda_original: código ISO da moeda do gasto (EUR, USD...) — NULL = BRL
-- valor_original: valor na moeda estrangeira
-- cotacao:        quanto vale 1 unidade da moeda em R$ no momento do lançamento
-- `valor` continua sempre em R$, então saldos, orçamentos e relatórios
-- seguem corretos sem nenhuma outra mudança.

ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS moeda_original TEXT,
  ADD COLUMN IF NOT EXISTS valor_original NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS cotacao NUMERIC(14, 6);

ALTER TABLE lancamentos
  DROP CONSTRAINT IF EXISTS lancamentos_moeda_estrangeira_check;
ALTER TABLE lancamentos
  ADD CONSTRAINT lancamentos_moeda_estrangeira_check CHECK (
    (moeda_original IS NULL AND valor_original IS NULL AND cotacao IS NULL) OR
    (moeda_original IS NOT NULL AND valor_original IS NOT NULL AND cotacao IS NOT NULL AND cotacao > 0)
  );

CREATE INDEX IF NOT EXISTS idx_lancamentos_tags ON lancamentos USING GIN (tags);

COMMENT ON COLUMN lancamentos.tags IS 'Tags personalizadas do lançamento (ex.: Viagem Europa 2026)';
COMMENT ON COLUMN lancamentos.moeda_original IS 'Moeda do gasto quando diferente de BRL (código ISO). valor segue em R$';
COMMENT ON COLUMN lancamentos.valor_original IS 'Valor na moeda original';
COMMENT ON COLUMN lancamentos.cotacao IS 'Cotação usada (R$ por 1 unidade da moeda original)';

-- =====================================================
-- RPC de parcelas: passa a gravar também portador_id, tags e moeda
-- (a versão anterior ignorava essas colunas)
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
    forma_pagamento, cartao_id, portador_id, conta_id, observacao, status,
    parcela_atual, parcela_total, grupo_parcelas_id, data_vencimento_fatura,
    tags, moeda_original, valor_original, cotacao
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
    p.portador_id,
    p.conta_id,
    p.observacao,
    p.status::lancamento_status,
    p.parcela_atual,
    p.parcela_total,
    p.grupo_parcelas_id,
    p.data_vencimento_fatura,
    COALESCE(
      (SELECT array_agg(t) FROM jsonb_array_elements_text(p.tags) AS t),
      '{}'::TEXT[]
    ),
    p.moeda_original,
    p.valor_original,
    p.cotacao
  FROM jsonb_to_recordset(p_parcelas) AS p(
    tipo TEXT,
    categoria_id UUID,
    subcategoria_id UUID,
    valor NUMERIC,
    data DATE,
    forma_pagamento TEXT,
    cartao_id UUID,
    portador_id TEXT,
    conta_id UUID,
    observacao TEXT,
    status TEXT,
    parcela_atual INTEGER,
    parcela_total INTEGER,
    grupo_parcelas_id UUID,
    data_vencimento_fatura DATE,
    tags JSONB,
    moeda_original TEXT,
    valor_original NUMERIC,
    cotacao NUMERIC
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
