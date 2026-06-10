-- =====================================================
-- Migration: Backfill de data_vencimento_fatura para cartões cujo
--            vencimento é no mesmo dia ou ANTES do fechamento
-- Description: O cálculo antigo colocava o vencimento no MESMO mês do
--              fechamento. Para cartões "fecha dia 25 / vence dia 5", uma
--              compra de 10/jan recebia vencimento 05/jan — antes da própria
--              compra. A regra corrigida (lib/faturaUtils.ts) coloca o
--              vencimento no mês SEGUINTE ao fechamento quando
--              dia_vencimento <= dia_fechamento.
--              Este backfill desloca em +1 mês o vencimento persistido dos
--              lançamentos NÃO pagos desses cartões. Lançamentos pagos são
--              preservados (histórico de faturas já quitadas não muda).
-- =====================================================

UPDATE lancamentos l
SET data_vencimento_fatura = (l.data_vencimento_fatura + INTERVAL '1 month')::date
FROM cartoes c
WHERE l.cartao_id = c.id
  AND l.forma_pagamento = 'credito'
  AND l.status != 'pago'
  AND l.data_vencimento_fatura IS NOT NULL
  AND c.dia_vencimento <= c.dia_fechamento;
