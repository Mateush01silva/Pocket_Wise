-- =====================================================
-- Migration: Add conta_id to lancamentos table
-- Description: Adiciona coluna conta_id para vincular transações com contas bancárias
-- Author: Claude Code
-- Date: 2026-01-22
-- =====================================================

-- Adicionar coluna conta_id na tabela lancamentos
ALTER TABLE lancamentos
ADD COLUMN IF NOT EXISTS conta_id UUID REFERENCES contas_bancarias(id) ON DELETE SET NULL;

-- Adicionar índice para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_lancamentos_conta_id ON lancamentos(conta_id);

-- Comentário na coluna para documentação
COMMENT ON COLUMN lancamentos.conta_id IS 'ID da conta bancária vinculada à transação (qual conta foi debitada/creditada)';

-- =====================================================
-- Atualizar RLS Policies (se necessário)
-- =====================================================

-- As policies existentes já cobrem a nova coluna, pois filtram por family_id/user_id
-- Não é necessário criar novas policies

-- =====================================================
-- Função helper para atualizar saldo da conta automaticamente
-- =====================================================

-- Criar função para atualizar saldo da conta quando uma transação é criada/atualizada/deletada
CREATE OR REPLACE FUNCTION atualizar_saldo_conta()
RETURNS TRIGGER AS $$
DECLARE
  v_valor DECIMAL(15, 2);
  v_conta_id UUID;
BEGIN
  -- Determinar qual conta_id usar (OLD ou NEW)
  IF TG_OP = 'DELETE' THEN
    v_conta_id := OLD.conta_id;
    v_valor := OLD.valor;

    -- Reverter transação deletada
    IF v_conta_id IS NOT NULL AND OLD.status = 'pago' THEN
      IF OLD.tipo = 'receita' THEN
        -- Reverter receita: diminuir saldo
        UPDATE contas_bancarias
        SET saldo_atual = saldo_atual - v_valor
        WHERE id = v_conta_id;
      ELSE
        -- Reverter despesa: aumentar saldo
        UPDATE contas_bancarias
        SET saldo_atual = saldo_atual + v_valor
        WHERE id = v_conta_id;
      END IF;
    END IF;

    RETURN OLD;
  END IF;

  -- Para INSERT e UPDATE
  v_conta_id := NEW.conta_id;
  v_valor := NEW.valor;

  -- Se for UPDATE, reverter a transação antiga primeiro
  IF TG_OP = 'UPDATE' THEN
    IF OLD.conta_id IS NOT NULL AND OLD.status = 'pago' AND (OLD.conta_id != NEW.conta_id OR OLD.valor != NEW.valor OR OLD.tipo != NEW.tipo OR OLD.status != NEW.status) THEN
      -- Reverter transação antiga
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

  -- Aplicar nova transação (apenas se status = 'pago')
  IF v_conta_id IS NOT NULL AND NEW.status = 'pago' THEN
    IF NEW.tipo = 'receita' THEN
      -- Receita: aumentar saldo
      UPDATE contas_bancarias
      SET saldo_atual = saldo_atual + v_valor
      WHERE id = v_conta_id;
    ELSE
      -- Despesa: diminuir saldo
      UPDATE contas_bancarias
      SET saldo_atual = saldo_atual - v_valor
      WHERE id = v_conta_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para executar a função
DROP TRIGGER IF EXISTS trigger_atualizar_saldo_conta_insert ON lancamentos;
DROP TRIGGER IF EXISTS trigger_atualizar_saldo_conta_update ON lancamentos;
DROP TRIGGER IF EXISTS trigger_atualizar_saldo_conta_delete ON lancamentos;

CREATE TRIGGER trigger_atualizar_saldo_conta_insert
  AFTER INSERT ON lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_saldo_conta();

CREATE TRIGGER trigger_atualizar_saldo_conta_update
  AFTER UPDATE ON lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_saldo_conta();

CREATE TRIGGER trigger_atualizar_saldo_conta_delete
  AFTER DELETE ON lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_saldo_conta();

-- =====================================================
-- Verificação final
-- =====================================================

-- Verificar se a coluna foi adicionada com sucesso
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'lancamentos'
    AND column_name = 'conta_id'
  ) THEN
    RAISE NOTICE 'Coluna conta_id adicionada com sucesso à tabela lancamentos!';
  ELSE
    RAISE EXCEPTION 'Erro: Coluna conta_id não foi adicionada!';
  END IF;
END $$;

-- =====================================================
-- Notas Importantes
-- =====================================================

/*
NOTAS:
1. A coluna conta_id é opcional (pode ser NULL) para manter compatibilidade com transações antigas
2. Transações de cartão de crédito NÃO devem ter conta_id preenchida inicialmente
   - O conta_id só é preenchido quando a fatura é paga (indicando de qual conta saiu o dinheiro)
3. O trigger atualizar_saldo_conta só afeta o saldo quando status = 'pago'
4. Para transações com status 'pendente' ou 'projetado', o saldo não é alterado automaticamente
5. Ao pagar uma fatura de cartão, o sistema deve:
   - Atualizar status das transações de 'projetado' para 'pago'
   - Opcionalmente, definir o conta_id para indicar de qual conta foi pago
*/
