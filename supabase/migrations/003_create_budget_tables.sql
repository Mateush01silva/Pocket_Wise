-- =====================================================
-- MIGRATION: Sistema de Orçamentos e Envelopes Digitais
-- =====================================================
-- Criado em: 2026-01-12
-- Descrição: Adiciona tabelas para sistema de planejamento orçamentário
--            com metodologia de envelopes digitais

-- =====================================================
-- ENUMS
-- =====================================================

-- Enum para prioridade de categoria
CREATE TYPE categoria_prioridade AS ENUM ('essencial', 'importante', 'desejavel');

-- Enum para status do orçamento
CREATE TYPE orcamento_status AS ENUM ('rascunho', 'ativo', 'fechado');

-- Enum para tipo de alerta
CREATE TYPE tipo_alerta AS ENUM (
  'categoria_80',
  'categoria_90',
  'categoria_100',
  'gasto_incomum',
  'meta_atingida',
  'fatura_proxima'
);

-- Enum para método de cálculo
CREATE TYPE metodo_calculo AS ENUM ('conservador', 'otimista');

-- =====================================================
-- TABELA: orcamentos_mensais
-- =====================================================
-- Armazena os orçamentos mensais criados pelos usuários

CREATE TABLE orcamentos_mensais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  criado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  mes_referencia DATE NOT NULL, -- Sempre primeiro dia do mês (YYYY-MM-01)
  meta_poupanca DECIMAL(10, 2) NOT NULL DEFAULT 0,
  meta_poupanca_percentual DECIMAL(5, 2), -- Se não nulo, calcula % sobre receitas
  dia_inicio_ciclo INTEGER NOT NULL DEFAULT 1 CHECK (dia_inicio_ciclo >= 1 AND dia_inicio_ciclo <= 31),
  metodo_calculo metodo_calculo NOT NULL DEFAULT 'conservador',
  status orcamento_status NOT NULL DEFAULT 'rascunho',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraint: Apenas um orçamento ativo por mês/família
  CONSTRAINT unique_orcamento_ativo_por_mes UNIQUE (family_id, mes_referencia)
);

-- Índices
CREATE INDEX idx_orcamentos_family_mes ON orcamentos_mensais(family_id, mes_referencia);
CREATE INDEX idx_orcamentos_status ON orcamentos_mensais(status);

-- Trigger para updated_at
CREATE TRIGGER update_orcamentos_mensais_updated_at
  BEFORE UPDATE ON orcamentos_mensais
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABELA: categorias_budget
-- =====================================================
-- Armazena a alocação de valores por categoria em cada orçamento

CREATE TABLE categorias_budget (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orcamento_id UUID NOT NULL REFERENCES orcamentos_mensais(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  valor_orcado DECIMAL(10, 2) NOT NULL CHECK (valor_orcado >= 0),
  prioridade categoria_prioridade NOT NULL DEFAULT 'importante',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraint: Apenas uma alocação por categoria/orçamento
  CONSTRAINT unique_categoria_por_orcamento UNIQUE (orcamento_id, categoria_id)
);

-- Índices
CREATE INDEX idx_categorias_budget_orcamento ON categorias_budget(orcamento_id);
CREATE INDEX idx_categorias_budget_categoria ON categorias_budget(categoria_id);
CREATE INDEX idx_categorias_budget_prioridade ON categorias_budget(prioridade);

-- Trigger para updated_at
CREATE TRIGGER update_categorias_budget_updated_at
  BEFORE UPDATE ON categorias_budget
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABELA: alertas_orcamento
-- =====================================================
-- Sistema de notificações inteligentes sobre orçamento

CREATE TABLE alertas_orcamento (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Null = alerta para toda família
  orcamento_id UUID REFERENCES orcamentos_mensais(id) ON DELETE CASCADE,
  tipo tipo_alerta NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  mensagem TEXT NOT NULL,
  categoria_id UUID REFERENCES categorias(id) ON DELETE CASCADE,
  lido BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_alertas_family ON alertas_orcamento(family_id);
CREATE INDEX idx_alertas_user ON alertas_orcamento(user_id);
CREATE INDEX idx_alertas_lido ON alertas_orcamento(lido);
CREATE INDEX idx_alertas_orcamento ON alertas_orcamento(orcamento_id);
CREATE INDEX idx_alertas_created_at ON alertas_orcamento(created_at DESC);

-- =====================================================
-- TABELA: configuracoes_orcamento
-- =====================================================
-- Configurações personalizadas de orçamento por família

CREATE TABLE configuracoes_orcamento (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE UNIQUE,
  dia_inicio_ciclo INTEGER NOT NULL DEFAULT 1 CHECK (dia_inicio_ciclo >= 1 AND dia_inicio_ciclo <= 31),
  metodo_calculo metodo_calculo NOT NULL DEFAULT 'conservador',
  alertas_ativados BOOLEAN NOT NULL DEFAULT TRUE,
  alerta_80_porcento BOOLEAN NOT NULL DEFAULT TRUE,
  alerta_90_porcento BOOLEAN NOT NULL DEFAULT TRUE,
  alerta_100_porcento BOOLEAN NOT NULL DEFAULT TRUE,
  alerta_gastos_incomuns BOOLEAN NOT NULL DEFAULT TRUE,
  alerta_metas_atingidas BOOLEAN NOT NULL DEFAULT TRUE,
  template_orcamento_id UUID REFERENCES orcamentos_mensais(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice
CREATE INDEX idx_configuracoes_family ON configuracoes_orcamento(family_id);

-- Trigger para updated_at
CREATE TRIGGER update_configuracoes_orcamento_updated_at
  BEFORE UPDATE ON configuracoes_orcamento
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNÇÃO: Criar configuração padrão ao criar família
-- =====================================================

CREATE OR REPLACE FUNCTION create_default_budget_config()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO configuracoes_orcamento (family_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_budget_config_for_family
  AFTER INSERT ON families
  FOR EACH ROW
  EXECUTE FUNCTION create_default_budget_config();

-- =====================================================
-- FUNÇÃO: Copiar orçamento do mês anterior
-- =====================================================

CREATE OR REPLACE FUNCTION copiar_orcamento_mes_anterior(
  p_family_id UUID,
  p_mes_referencia DATE
)
RETURNS UUID AS $$
DECLARE
  v_orcamento_anterior UUID;
  v_novo_orcamento UUID;
BEGIN
  -- Buscar orçamento do mês anterior
  SELECT id INTO v_orcamento_anterior
  FROM orcamentos_mensais
  WHERE family_id = p_family_id
    AND mes_referencia = (p_mes_referencia - INTERVAL '1 month')::DATE
    AND status = 'fechado'
  LIMIT 1;

  IF v_orcamento_anterior IS NULL THEN
    RAISE EXCEPTION 'Orçamento do mês anterior não encontrado';
  END IF;

  -- Criar novo orçamento
  INSERT INTO orcamentos_mensais (
    family_id,
    mes_referencia,
    meta_poupanca,
    meta_poupanca_percentual,
    dia_inicio_ciclo,
    metodo_calculo,
    status
  )
  SELECT
    family_id,
    p_mes_referencia,
    meta_poupanca,
    meta_poupanca_percentual,
    dia_inicio_ciclo,
    metodo_calculo,
    'rascunho'
  FROM orcamentos_mensais
  WHERE id = v_orcamento_anterior
  RETURNING id INTO v_novo_orcamento;

  -- Copiar categorias budget
  INSERT INTO categorias_budget (
    orcamento_id,
    categoria_id,
    valor_orcado,
    prioridade
  )
  SELECT
    v_novo_orcamento,
    categoria_id,
    valor_orcado,
    prioridade
  FROM categorias_budget
  WHERE orcamento_id = v_orcamento_anterior;

  RETURN v_novo_orcamento;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEW: Resumo de orçamentos com totais calculados
-- =====================================================

CREATE OR REPLACE VIEW v_orcamentos_resumo AS
SELECT
  o.id,
  o.family_id,
  o.mes_referencia,
  o.meta_poupanca,
  o.meta_poupanca_percentual,
  o.status,
  COALESCE(SUM(cb.valor_orcado), 0) AS total_orcado,
  COUNT(cb.id) AS total_categorias,
  o.created_at,
  o.updated_at
FROM orcamentos_mensais o
LEFT JOIN categorias_budget cb ON cb.orcamento_id = o.id
GROUP BY o.id;

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE orcamentos_mensais IS 'Orçamentos mensais por família com metas de poupança';
COMMENT ON TABLE categorias_budget IS 'Alocação de valores por categoria dentro de um orçamento (envelopes digitais)';
COMMENT ON TABLE alertas_orcamento IS 'Sistema de notificações inteligentes sobre execução orçamentária';
COMMENT ON TABLE configuracoes_orcamento IS 'Configurações personalizadas de orçamento por família';

COMMENT ON COLUMN orcamentos_mensais.mes_referencia IS 'Sempre primeiro dia do mês (YYYY-MM-01)';
COMMENT ON COLUMN orcamentos_mensais.meta_poupanca_percentual IS 'Se preenchido, sobrepõe meta_poupanca com % das receitas';
COMMENT ON COLUMN orcamentos_mensais.metodo_calculo IS 'conservador: apenas recebido/pago; otimista: considera futuro confirmado';

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE orcamentos_mensais ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_orcamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes_orcamento ENABLE ROW LEVEL SECURITY;

-- Policies para orcamentos_mensais
CREATE POLICY "Usuários podem ver orçamentos da própria família"
  ON orcamentos_mensais FOR SELECT
  USING (family_id IN (
    SELECT family_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Usuários podem criar orçamentos na própria família"
  ON orcamentos_mensais FOR INSERT
  WITH CHECK (family_id IN (
    SELECT family_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Usuários podem atualizar orçamentos da própria família"
  ON orcamentos_mensais FOR UPDATE
  USING (family_id IN (
    SELECT family_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Usuários podem deletar orçamentos da própria família"
  ON orcamentos_mensais FOR DELETE
  USING (family_id IN (
    SELECT family_id FROM users WHERE id = auth.uid()
  ));

-- Policies para categorias_budget
CREATE POLICY "Usuários podem ver categorias budget da própria família"
  ON categorias_budget FOR SELECT
  USING (orcamento_id IN (
    SELECT id FROM orcamentos_mensais WHERE family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Usuários podem criar categorias budget na própria família"
  ON categorias_budget FOR INSERT
  WITH CHECK (orcamento_id IN (
    SELECT id FROM orcamentos_mensais WHERE family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Usuários podem atualizar categorias budget da própria família"
  ON categorias_budget FOR UPDATE
  USING (orcamento_id IN (
    SELECT id FROM orcamentos_mensais WHERE family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Usuários podem deletar categorias budget da própria família"
  ON categorias_budget FOR DELETE
  USING (orcamento_id IN (
    SELECT id FROM orcamentos_mensais WHERE family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  ));

-- Policies para alertas_orcamento
CREATE POLICY "Usuários podem ver alertas da própria família"
  ON alertas_orcamento FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY "Sistema pode criar alertas"
  ON alertas_orcamento FOR INSERT
  WITH CHECK (family_id IN (
    SELECT family_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Usuários podem atualizar próprios alertas"
  ON alertas_orcamento FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- Policies para configuracoes_orcamento
CREATE POLICY "Usuários podem ver configurações da própria família"
  ON configuracoes_orcamento FOR SELECT
  USING (family_id IN (
    SELECT family_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Usuários podem atualizar configurações da própria família"
  ON configuracoes_orcamento FOR UPDATE
  USING (family_id IN (
    SELECT family_id FROM users WHERE id = auth.uid()
  ));

-- =====================================================
-- GRANTS
-- =====================================================

GRANT ALL ON orcamentos_mensais TO authenticated;
GRANT ALL ON categorias_budget TO authenticated;
GRANT ALL ON alertas_orcamento TO authenticated;
GRANT ALL ON configuracoes_orcamento TO authenticated;
GRANT SELECT ON v_orcamentos_resumo TO authenticated;
