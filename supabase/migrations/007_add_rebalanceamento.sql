-- Migration: Rebalanceamento Inteligente
-- Descrição: Adiciona suporte para sistema de rebalanceamento automático de orçamento
-- Data: 2026-01-17

-- =====================================================
-- 1. ENUM TYPES
-- =====================================================

-- Prioridade de categoria para rebalanceamento (criar apenas se não existir)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'categoria_prioridade') THEN
        CREATE TYPE categoria_prioridade AS ENUM ('essencial', 'importante', 'desejavel');
    END IF;
END $$;

-- =====================================================
-- 2. ADICIONAR CAMPO PRIORIDADE EM CATEGORIAS
-- =====================================================

-- Adicionar campo prioridade (apenas se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'categorias' AND column_name = 'prioridade'
    ) THEN
        ALTER TABLE categorias ADD COLUMN prioridade categoria_prioridade DEFAULT 'importante';
    END IF;
END $$;

-- Criar índice para prioridade (apenas se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_categorias_prioridade'
    ) THEN
        CREATE INDEX idx_categorias_prioridade ON categorias(prioridade);
    END IF;
END $$;

-- =====================================================
-- 3. TABELA DE HISTÓRICO DE REBALANCEAMENTOS
-- =====================================================

-- Tabela para registrar todas as transferências entre categorias
CREATE TABLE IF NOT EXISTS historico_rebalanceamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  realizado_por UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  orcamento_id UUID REFERENCES orcamentos_mensais(id) ON DELETE SET NULL,

  -- Origem (categoria que teve dinheiro retirado)
  categoria_origem_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  valor_transferido DECIMAL(15, 2) NOT NULL CHECK (valor_transferido > 0),

  -- Destino (categoria que recebeu dinheiro)
  categoria_destino_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,

  -- Informações contextuais
  motivo TEXT, -- Ex: "Categoria Saúde estourou em R$ 185"
  foi_sugestao_automatica BOOLEAN DEFAULT FALSE, -- Se foi sugestão do sistema ou manual

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Validações
  CHECK (categoria_origem_id != categoria_destino_id)
);

-- Índices para performance
CREATE INDEX idx_historico_rebalanceamentos_family_id ON historico_rebalanceamentos(family_id);
CREATE INDEX idx_historico_rebalanceamentos_orcamento_id ON historico_rebalanceamentos(orcamento_id);
CREATE INDEX idx_historico_rebalanceamentos_realizado_por ON historico_rebalanceamentos(realizado_por);
CREATE INDEX idx_historico_rebalanceamentos_created_at ON historico_rebalanceamentos(created_at);

-- =====================================================
-- 4. VIEW PARA ESTATÍSTICAS DE REBALANCEAMENTO
-- =====================================================

-- View para ver rebalanceamentos com informações das categorias
CREATE OR REPLACE VIEW rebalanceamentos_com_detalhes AS
SELECT
  hr.id,
  hr.family_id,
  hr.realizado_por,
  hr.orcamento_id,
  hr.valor_transferido,
  hr.motivo,
  hr.foi_sugestao_automatica,
  hr.created_at,
  -- Categoria origem
  co.nome as categoria_origem_nome,
  co.icone as categoria_origem_icone,
  co.cor as categoria_origem_cor,
  co.prioridade as categoria_origem_prioridade,
  -- Categoria destino
  cd.nome as categoria_destino_nome,
  cd.icone as categoria_destino_icone,
  cd.cor as categoria_destino_cor,
  cd.prioridade as categoria_destino_prioridade,
  -- Usuário
  u.nome as realizado_por_nome
FROM historico_rebalanceamentos hr
LEFT JOIN categorias co ON hr.categoria_origem_id = co.id
LEFT JOIN categorias cd ON hr.categoria_destino_id = cd.id
LEFT JOIN users u ON hr.realizado_por = u.id;

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Habilitar RLS na tabela
ALTER TABLE historico_rebalanceamentos ENABLE ROW LEVEL SECURITY;

-- Membros da família podem ver histórico de rebalanceamentos
CREATE POLICY "Family members can view rebalanceamentos"
  ON historico_rebalanceamentos FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Membros da família podem criar rebalanceamentos
CREATE POLICY "Family members can create rebalanceamentos"
  ON historico_rebalanceamentos FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
    AND realizado_por = auth.uid()
  );

-- Membros da família podem deletar rebalanceamentos (para desfazer)
CREATE POLICY "Family members can delete rebalanceamentos"
  ON historico_rebalanceamentos FOR DELETE
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- 6. ATUALIZAR CATEGORIAS PADRÃO COM PRIORIDADES
-- =====================================================

-- Atualizar categorias existentes com prioridades adequadas

-- Categorias ESSENCIAIS
UPDATE categorias
SET prioridade = 'essencial'
WHERE nome IN (
  'Moradia', 'Alimentação', 'Saúde', 'Transporte Essencial',
  'Utilities', 'Água', 'Luz', 'Gás', 'Internet',
  'Medicamentos', 'Plano de Saúde', 'Aluguel', 'Condomínio'
);

-- Categorias IMPORTANTES
UPDATE categorias
SET prioridade = 'importante'
WHERE nome IN (
  'Educação', 'Investimentos', 'Poupança', 'Seguros',
  'Telefone', 'Academia', 'Cuidados Pessoais',
  'Manutenção do Carro', 'IPTU', 'IPVA'
);

-- Categorias DESEJÁVEIS
UPDATE categorias
SET prioridade = 'desejavel'
WHERE nome IN (
  'Lazer', 'Entretenimento', 'Restaurantes', 'Viagens',
  'Vestuário', 'Presentes', 'Hobbies', 'Streaming',
  'Delivery', 'Compras', 'Estética', 'Pet'
);

-- =====================================================
-- 7. COMENTÁRIOS
-- =====================================================

COMMENT ON TYPE categoria_prioridade IS 'Prioridade da categoria para rebalanceamento: essencial (não retirar), importante (retirar só se necessário), desejavel (primeira opção para retirar)';
COMMENT ON TABLE historico_rebalanceamentos IS 'Histórico de todas as transferências de valores entre categorias do orçamento';
COMMENT ON COLUMN categorias.prioridade IS 'Prioridade da categoria para sistema de rebalanceamento automático';
COMMENT ON COLUMN historico_rebalanceamentos.foi_sugestao_automatica IS 'Se true, foi sugestão automática do sistema; se false, foi rebalanceamento manual do usuário';

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
