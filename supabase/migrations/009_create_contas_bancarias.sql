-- =====================================================
-- Migration: Create Contas Bancárias (Bank Accounts) Table
-- Description: Adiciona tabela para gerenciar contas bancárias dos usuários
-- Author: Claude Code
-- Date: 2026-01-22
-- =====================================================

-- Criar tipo ENUM para tipos de conta
CREATE TYPE tipo_conta AS ENUM (
  'conta_corrente',
  'poupanca',
  'carteira_digital',
  'dinheiro',
  'investimento',
  'outra'
);

-- Criar tabela contas_bancarias
CREATE TABLE IF NOT EXISTS contas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  tipo tipo_conta NOT NULL DEFAULT 'conta_corrente',
  saldo_inicial DECIMAL(15, 2) NOT NULL DEFAULT 0,
  saldo_atual DECIMAL(15, 2) NOT NULL DEFAULT 0,
  cor VARCHAR(7) NOT NULL DEFAULT '#6366f1',
  icone VARCHAR(50),
  ativo BOOLEAN NOT NULL DEFAULT true,
  instituicao VARCHAR(255), -- Nome do banco (ex: "Nubank", "Inter")
  agencia VARCHAR(20),
  numero_conta VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT contas_bancarias_nome_family_key UNIQUE (nome, family_id),
  CONSTRAINT contas_bancarias_saldo_inicial_check CHECK (saldo_inicial >= 0),
  CONSTRAINT contas_bancarias_family_or_user CHECK (
    (family_id IS NOT NULL) OR (user_id IS NOT NULL)
  )
);

-- Adicionar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_contas_bancarias_family_id ON contas_bancarias(family_id);
CREATE INDEX IF NOT EXISTS idx_contas_bancarias_user_id ON contas_bancarias(user_id);
CREATE INDEX IF NOT EXISTS idx_contas_bancarias_ativo ON contas_bancarias(ativo);
CREATE INDEX IF NOT EXISTS idx_contas_bancarias_tipo ON contas_bancarias(tipo);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_contas_bancarias_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contas_bancarias_updated_at
  BEFORE UPDATE ON contas_bancarias
  FOR EACH ROW
  EXECUTE FUNCTION update_contas_bancarias_updated_at();

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Habilitar RLS
ALTER TABLE contas_bancarias ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver suas próprias contas
CREATE POLICY "Users can view their own bank accounts"
  ON contas_bancarias
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Usuários podem criar suas próprias contas
CREATE POLICY "Users can create their own bank accounts"
  ON contas_bancarias
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Usuários podem atualizar suas próprias contas
CREATE POLICY "Users can update their own bank accounts"
  ON contas_bancarias
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Usuários podem deletar suas próprias contas (soft delete)
CREATE POLICY "Users can delete their own bank accounts"
  ON contas_bancarias
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- Comentários nas colunas para documentação
-- =====================================================

COMMENT ON TABLE contas_bancarias IS 'Armazena as contas bancárias dos usuários (conta corrente, poupança, carteira digital, dinheiro, etc)';
COMMENT ON COLUMN contas_bancarias.id IS 'Identificador único da conta';
COMMENT ON COLUMN contas_bancarias.user_id IS 'ID do usuário proprietário (se não for compartilhada)';
COMMENT ON COLUMN contas_bancarias.family_id IS 'ID da família (se for compartilhada)';
COMMENT ON COLUMN contas_bancarias.nome IS 'Nome da conta (ex: "Nubank Conta Corrente", "Dinheiro em Espécie")';
COMMENT ON COLUMN contas_bancarias.tipo IS 'Tipo da conta (conta_corrente, poupanca, carteira_digital, dinheiro, investimento, outra)';
COMMENT ON COLUMN contas_bancarias.saldo_inicial IS 'Saldo inicial da conta quando foi cadastrada';
COMMENT ON COLUMN contas_bancarias.saldo_atual IS 'Saldo atual da conta (atualizado conforme transações)';
COMMENT ON COLUMN contas_bancarias.cor IS 'Cor da conta em hexadecimal para identificação visual';
COMMENT ON COLUMN contas_bancarias.icone IS 'Ícone/emoji da conta para identificação visual';
COMMENT ON COLUMN contas_bancarias.ativo IS 'Indica se a conta está ativa ou foi desativada (soft delete)';
COMMENT ON COLUMN contas_bancarias.instituicao IS 'Nome da instituição financeira (ex: "Nubank", "Banco Inter")';
COMMENT ON COLUMN contas_bancarias.agencia IS 'Número da agência bancária';
COMMENT ON COLUMN contas_bancarias.numero_conta IS 'Número da conta bancária';

-- =====================================================
-- Dados iniciais (opcional)
-- =====================================================

-- Nenhum dado inicial necessário
-- Os usuários criarão suas próprias contas

-- =====================================================
-- Verificação final
-- =====================================================

-- Verificar se a tabela foi criada com sucesso
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contas_bancarias') THEN
    RAISE NOTICE 'Tabela contas_bancarias criada com sucesso!';
  ELSE
    RAISE EXCEPTION 'Erro: Tabela contas_bancarias não foi criada!';
  END IF;
END $$;
