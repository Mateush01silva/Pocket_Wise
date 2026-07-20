-- =====================================================
-- Migration: Fix double deduction bug in atualizar_saldo_conta trigger
-- Description: Corrige bug onde editar qualquer campo de uma transação
--              já paga causava dupla dedução no saldo da conta.
--              O bloco de aplicação do novo valor rodava em todo UPDATE
--              com status='pago', sem verificar se algo relevante mudou.
-- =====================================================

CREATE OR REPLACE FUNCTION atualizar_saldo_conta()
RETURNS TRIGGER AS $$
BEGIN
  -- ── DELETE ──────────────────────────────────────────────────────────
  IF TG_OP = 'DELETE' THEN
    IF OLD.conta_id IS NOT NULL AND OLD.status = 'pago' THEN
      IF OLD.tipo = 'receita' THEN
        UPDATE contas_bancarias
        SET saldo_atual = saldo_atual - OLD.valor
        WHERE id = OLD.conta_id;
      ELSE
        UPDATE contas_bancarias
        SET saldo_atual = saldo_atual + OLD.valor
        WHERE id = OLD.conta_id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- ── UPDATE ──────────────────────────────────────────────────────────
  IF TG_OP = 'UPDATE' THEN
    -- Se nenhum campo que afeta saldo mudou, sair sem fazer nada.
    -- Isso evita que edições de campos irrelevantes (descrição, categoria,
    -- data, etc.) causem uma segunda dedução.
    IF NOT (
      OLD.conta_id  IS DISTINCT FROM NEW.conta_id  OR
      OLD.valor     IS DISTINCT FROM NEW.valor     OR
      OLD.tipo      IS DISTINCT FROM NEW.tipo      OR
      OLD.status    IS DISTINCT FROM NEW.status
    ) THEN
      RETURN NEW;
    END IF;

    -- Reverter efeito da transação antiga (se estava paga)
    IF OLD.conta_id IS NOT NULL AND OLD.status = 'pago' THEN
      IF OLD.tipo = 'receita' THEN
        UPDATE contas_bancarias
        SET saldo_atual = saldo_atual - OLD.valor
        WHERE id = OLD.conta_id;
      ELSE
        UPDATE contas_bancarias
        SET saldo_atual = saldo_atual + OLD.valor
        WHERE id = OLD.conta_id;
      END IF;
    END IF;
  END IF;

  -- ── INSERT e UPDATE (com mudança relevante) ──────────────────────────
  -- Aplicar novo valor apenas se a transação está paga e tem conta vinculada
  IF NEW.conta_id IS NOT NULL AND NEW.status = 'pago' THEN
    IF NEW.tipo = 'receita' THEN
      UPDATE contas_bancarias
      SET saldo_atual = saldo_atual + NEW.valor
      WHERE id = NEW.conta_id;
    ELSE
      UPDATE contas_bancarias
      SET saldo_atual = saldo_atual - NEW.valor
      WHERE id = NEW.conta_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
