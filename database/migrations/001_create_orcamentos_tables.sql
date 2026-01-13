-- =====================================================
-- POCKET WISE - SISTEMA DE ORÇAMENTOS
-- Migration: Criar tabelas para orçamento mensal e envelopes digitais
-- =====================================================

-- =====================================================
-- 1. TABELA: orcamentos_mensais
-- Armazena o orçamento planejado para cada mês
-- =====================================================

CREATE TABLE IF NOT EXISTS orcamentos_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  criado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  mes_referencia DATE NOT NULL, -- YYYY-MM-01 (sempre dia 1 do mês)
  meta_poupanca DECIMAL(15, 2) NOT NULL DEFAULT 0,
  meta_poupanca_percentual DECIMAL(5, 2), -- Se preenchido, usa % da renda ao invés de valor fixo
  dia_inicio_ciclo INTEGER NOT NULL DEFAULT 1 CHECK (dia_inicio_ciclo >= 1 AND dia_inicio_ciclo <= 31),
  metodo_calculo VARCHAR(20) NOT NULL DEFAULT 'conservador' CHECK (metodo_calculo IN ('conservador', 'otimista')),
  status VARCHAR(20) NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativo', 'fechado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Garantir que só existe 1 orçamento por família por mês
  UNIQUE(family_id, mes_referencia)
);

-- Índices para performance
CREATE INDEX idx_orcamentos_family_mes ON orcamentos_mensais(family_id, mes_referencia);
CREATE INDEX idx_orcamentos_status ON orcamentos_mensais(status);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_orcamento_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_orcamento_updated_at
  BEFORE UPDATE ON orcamentos_mensais
  FOR EACH ROW
  EXECUTE FUNCTION update_orcamento_updated_at();

-- =====================================================
-- 2. TABELA: categorias_budget
-- Valores orçados para cada categoria dentro de um orçamento mensal
-- =====================================================

CREATE TABLE IF NOT EXISTS categorias_budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES orcamentos_mensais(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  valor_orcado DECIMAL(15, 2) NOT NULL CHECK (valor_orcado >= 0),
  prioridade VARCHAR(20) NOT NULL DEFAULT 'importante' CHECK (prioridade IN ('essencial', 'importante', 'desejavel')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Garantir que cada categoria aparece apenas 1x por orçamento
  UNIQUE(orcamento_id, categoria_id)
);

-- Índices para performance
CREATE INDEX idx_categorias_budget_orcamento ON categorias_budget(orcamento_id);
CREATE INDEX idx_categorias_budget_categoria ON categorias_budget(categoria_id);
CREATE INDEX idx_categorias_budget_prioridade ON categorias_budget(prioridade);

-- Trigger para atualizar updated_at
CREATE TRIGGER trigger_update_categoria_budget_updated_at
  BEFORE UPDATE ON categorias_budget
  FOR EACH ROW
  EXECUTE FUNCTION update_orcamento_updated_at();

-- =====================================================
-- 3. TABELA: alertas_orcamento
-- Sistema de alertas inteligentes sobre orçamento
-- =====================================================

CREATE TABLE IF NOT EXISTS alertas_orcamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  orcamento_id UUID REFERENCES orcamentos_mensais(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN (
    'categoria_80',
    'categoria_90',
    'categoria_100',
    'gasto_incomum',
    'meta_atingida',
    'fatura_proxima'
  )),
  titulo VARCHAR(200) NOT NULL,
  mensagem TEXT NOT NULL,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  lido BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_alertas_family ON alertas_orcamento(family_id, lido);
CREATE INDEX idx_alertas_user ON alertas_orcamento(user_id, lido);
CREATE INDEX idx_alertas_tipo ON alertas_orcamento(tipo);
CREATE INDEX idx_alertas_created_at ON alertas_orcamento(created_at DESC);

-- =====================================================
-- 4. TABELA: patrimonio (para acompanhar patrimônio líquido)
-- =====================================================

CREATE TABLE IF NOT EXISTS patrimonio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  valor_total DECIMAL(15, 2) NOT NULL,
  observacoes TEXT,
  data_atualizacao DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Garantir apenas 1 registro de patrimônio por usuário por data
  UNIQUE(user_id, data_atualizacao)
);

-- Índices para performance
CREATE INDEX idx_patrimonio_user ON patrimonio(user_id, data_atualizacao DESC);
CREATE INDEX idx_patrimonio_family ON patrimonio(family_id, data_atualizacao DESC);

-- =====================================================
-- COMENTÁRIOS NAS TABELAS
-- =====================================================

COMMENT ON TABLE orcamentos_mensais IS 'Orçamentos mensais planejados por família';
COMMENT ON COLUMN orcamentos_mensais.mes_referencia IS 'Mês de referência no formato YYYY-MM-01';
COMMENT ON COLUMN orcamentos_mensais.metodo_calculo IS 'Conservador: considera apenas receitas confirmadas; Otimista: considera receitas projetadas';
COMMENT ON COLUMN orcamentos_mensais.status IS 'rascunho: em edição; ativo: em uso no mês; fechado: mês encerrado';

COMMENT ON TABLE categorias_budget IS 'Valores orçados por categoria dentro de cada orçamento mensal (Envelopes Digitais)';
COMMENT ON COLUMN categorias_budget.prioridade IS 'essencial: necessidades básicas; importante: qualidade de vida; desejavel: luxos';

COMMENT ON TABLE alertas_orcamento IS 'Sistema de alertas inteligentes sobre gastos e orçamento';
COMMENT ON COLUMN alertas_orcamento.tipo IS 'Tipo de alerta: categoria_80/90/100 = % de uso; gasto_incomum = desvio do padrão; meta_atingida = poupança alcançada; fatura_proxima = aviso de vencimento';

COMMENT ON TABLE patrimonio IS 'Histórico de patrimônio líquido do usuário';

-- =====================================================
-- POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE orcamentos_mensais ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_orcamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrimonio ENABLE ROW LEVEL SECURITY;

-- Políticas para orcamentos_mensais
CREATE POLICY "Usuários podem ver orçamentos da própria família"
  ON orcamentos_mensais FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem criar orçamentos para sua família"
  ON orcamentos_mensais FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem atualizar orçamentos da própria família"
  ON orcamentos_mensais FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem deletar orçamentos da própria família"
  ON orcamentos_mensais FOR DELETE
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Políticas para categorias_budget (herdam da família via orcamento)
CREATE POLICY "Usuários podem ver categorias_budget da própria família"
  ON categorias_budget FOR SELECT
  USING (
    orcamento_id IN (
      SELECT id FROM orcamentos_mensais
      WHERE family_id IN (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Usuários podem criar categorias_budget para sua família"
  ON categorias_budget FOR INSERT
  WITH CHECK (
    orcamento_id IN (
      SELECT id FROM orcamentos_mensais
      WHERE family_id IN (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Usuários podem atualizar categorias_budget da própria família"
  ON categorias_budget FOR UPDATE
  USING (
    orcamento_id IN (
      SELECT id FROM orcamentos_mensais
      WHERE family_id IN (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Usuários podem deletar categorias_budget da própria família"
  ON categorias_budget FOR DELETE
  USING (
    orcamento_id IN (
      SELECT id FROM orcamentos_mensais
      WHERE family_id IN (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Políticas para alertas_orcamento
CREATE POLICY "Usuários podem ver alertas da própria família"
  ON alertas_orcamento FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Sistema pode criar alertas"
  ON alertas_orcamento FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem atualizar seus alertas"
  ON alertas_orcamento FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem deletar alertas da própria família"
  ON alertas_orcamento FOR DELETE
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Políticas para patrimonio
CREATE POLICY "Usuários podem ver próprio patrimônio"
  ON patrimonio FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Usuários podem criar próprio patrimônio"
  ON patrimonio FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários podem atualizar próprio patrimônio"
  ON patrimonio FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Usuários podem deletar próprio patrimônio"
  ON patrimonio FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- DADOS INICIAIS / SEED (Opcional)
-- =====================================================

-- Você pode descomentar as linhas abaixo para criar um orçamento de exemplo
-- após ter criado um usuário e família no sistema

/*
-- Exemplo: Criar orçamento para o mês atual
INSERT INTO orcamentos_mensais (family_id, mes_referencia, meta_poupanca, status)
VALUES (
  'sua-family-id-aqui',
  DATE_TRUNC('month', CURRENT_DATE),
  2000.00,
  'ativo'
);
*/
