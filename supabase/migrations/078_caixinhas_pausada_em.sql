-- =====================================================
-- Migration: Registrar quando a caixinha foi pausada
-- Description: A pausa de caixinhas prometia "o prazo será estendido pelos
--              meses pausados", mas meses_pausados nunca era incrementado e
--              marcarMesPausado() nunca era chamada — pausar quebrava o
--              streak e o aporte sugerido ficava errado.
--              A coluna pausada_em permite, na retomada, calcular quantos
--              meses a caixinha ficou pausada (incrementando meses_pausados)
--              e marcar os meses correspondentes no histórico mensal.
-- =====================================================

ALTER TABLE caixinhas
  ADD COLUMN IF NOT EXISTS pausada_em TIMESTAMPTZ;

COMMENT ON COLUMN caixinhas.pausada_em IS
  'Quando a caixinha entrou em pausa (NULL se não está pausada). Usada na retomada para incrementar meses_pausados e marcar os meses pausados no histórico mensal.';
