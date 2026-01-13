-- =====================================================
-- POCKET WISE - SISTEMA DE ORÇAMENTOS (IDEMPOTENTE)
-- Versão 2: Pode ser executada múltiplas vezes sem erro
-- =====================================================

-- =====================================================
-- 1. FUNÇÃO DE TRIGGER (criar antes das tabelas)
-- =====================================================

CREATE OR REPLACE FUNCTION update_orcamento_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. TABELA: orcamentos_mensais
-- =====================================================

CREATE TABLE IF NOT EXISTS orcamentos_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  criado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  mes_referencia DATE NOT NULL,
  meta_poupanca DECIMAL(15, 2) NOT NULL DEFAULT 0,
  meta_poupanca_percentual DECIMAL(5, 2),
  dia_inicio_ciclo INTEGER NOT NULL DEFAULT 1 CHECK (dia_inicio_ciclo >= 1 AND dia_inicio_ciclo <= 31),
  metodo_calculo VARCHAR(20) NOT NULL DEFAULT 'conservador' CHECK (metodo_calculo IN ('conservador', 'otimista')),
  status VARCHAR(20) NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativo', 'fechado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar constraint UNIQUE apenas se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orcamentos_mensais_family_id_mes_referencia_key'
  ) THEN
    ALTER TABLE orcamentos_mensais
    ADD CONSTRAINT orcamentos_mensais_family_id_mes_referencia_key
    UNIQUE(family_id, mes_referencia);
  END IF;
END $$;

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_orcamentos_family_mes ON orcamentos_mensais(family_id, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON orcamentos_mensais(status);

-- Criar trigger se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_update_orcamento_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_orcamento_updated_at
      BEFORE UPDATE ON orcamentos_mensais
      FOR EACH ROW
      EXECUTE FUNCTION update_orcamento_updated_at();
  END IF;
END $$;

-- =====================================================
-- 3. TABELA: categorias_budget
-- =====================================================

CREATE TABLE IF NOT EXISTS categorias_budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES orcamentos_mensais(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  valor_orcado DECIMAL(15, 2) NOT NULL CHECK (valor_orcado >= 0),
  prioridade VARCHAR(20) NOT NULL DEFAULT 'importante' CHECK (prioridade IN ('essencial', 'importante', 'desejavel')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar constraint UNIQUE apenas se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'categorias_budget_orcamento_id_categoria_id_key'
  ) THEN
    ALTER TABLE categorias_budget
    ADD CONSTRAINT categorias_budget_orcamento_id_categoria_id_key
    UNIQUE(orcamento_id, categoria_id);
  END IF;
END $$;

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_categorias_budget_orcamento ON categorias_budget(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_categorias_budget_categoria ON categorias_budget(categoria_id);
CREATE INDEX IF NOT EXISTS idx_categorias_budget_prioridade ON categorias_budget(prioridade);

-- Criar trigger se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_update_categoria_budget_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_categoria_budget_updated_at
      BEFORE UPDATE ON categorias_budget
      FOR EACH ROW
      EXECUTE FUNCTION update_orcamento_updated_at();
  END IF;
END $$;

-- =====================================================
-- 4. TABELA: alertas_orcamento
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

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_alertas_family ON alertas_orcamento(family_id, lido);
CREATE INDEX IF NOT EXISTS idx_alertas_user ON alertas_orcamento(user_id, lido);
CREATE INDEX IF NOT EXISTS idx_alertas_tipo ON alertas_orcamento(tipo);
CREATE INDEX IF NOT EXISTS idx_alertas_created_at ON alertas_orcamento(created_at DESC);

-- =====================================================
-- 5. TABELA: patrimonio
-- =====================================================

CREATE TABLE IF NOT EXISTS patrimonio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  valor_total DECIMAL(15, 2) NOT NULL,
  observacoes TEXT,
  data_atualizacao DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar constraint UNIQUE apenas se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patrimonio_user_id_data_atualizacao_key'
  ) THEN
    ALTER TABLE patrimonio
    ADD CONSTRAINT patrimonio_user_id_data_atualizacao_key
    UNIQUE(user_id, data_atualizacao);
  END IF;
END $$;

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_patrimonio_user ON patrimonio(user_id, data_atualizacao DESC);
CREATE INDEX IF NOT EXISTS idx_patrimonio_family ON patrimonio(family_id, data_atualizacao DESC);

-- =====================================================
-- 6. COMENTÁRIOS NAS TABELAS (sempre atualiza)
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
-- 7. POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE orcamentos_mensais ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_orcamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrimonio ENABLE ROW LEVEL SECURITY;

-- Políticas para orcamentos_mensais (criar apenas se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orcamentos_mensais'
    AND policyname = 'Usuários podem ver orçamentos da própria família'
  ) THEN
    CREATE POLICY "Usuários podem ver orçamentos da própria família"
      ON orcamentos_mensais FOR SELECT
      USING (
        family_id IN (
          SELECT family_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orcamentos_mensais'
    AND policyname = 'Usuários podem criar orçamentos para sua família'
  ) THEN
    CREATE POLICY "Usuários podem criar orçamentos para sua família"
      ON orcamentos_mensais FOR INSERT
      WITH CHECK (
        family_id IN (
          SELECT family_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orcamentos_mensais'
    AND policyname = 'Usuários podem atualizar orçamentos da própria família'
  ) THEN
    CREATE POLICY "Usuários podem atualizar orçamentos da própria família"
      ON orcamentos_mensais FOR UPDATE
      USING (
        family_id IN (
          SELECT family_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orcamentos_mensais'
    AND policyname = 'Usuários podem deletar orçamentos da própria família'
  ) THEN
    CREATE POLICY "Usuários podem deletar orçamentos da própria família"
      ON orcamentos_mensais FOR DELETE
      USING (
        family_id IN (
          SELECT family_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- Políticas para categorias_budget
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'categorias_budget'
    AND policyname = 'Usuários podem ver categorias_budget da própria família'
  ) THEN
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'categorias_budget'
    AND policyname = 'Usuários podem criar categorias_budget para sua família'
  ) THEN
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'categorias_budget'
    AND policyname = 'Usuários podem atualizar categorias_budget da própria família'
  ) THEN
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'categorias_budget'
    AND policyname = 'Usuários podem deletar categorias_budget da própria família'
  ) THEN
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
  END IF;
END $$;

-- Políticas para alertas_orcamento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'alertas_orcamento'
    AND policyname = 'Usuários podem ver alertas da própria família'
  ) THEN
    CREATE POLICY "Usuários podem ver alertas da própria família"
      ON alertas_orcamento FOR SELECT
      USING (
        family_id IN (
          SELECT family_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'alertas_orcamento'
    AND policyname = 'Sistema pode criar alertas'
  ) THEN
    CREATE POLICY "Sistema pode criar alertas"
      ON alertas_orcamento FOR INSERT
      WITH CHECK (
        family_id IN (
          SELECT family_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'alertas_orcamento'
    AND policyname = 'Usuários podem atualizar seus alertas'
  ) THEN
    CREATE POLICY "Usuários podem atualizar seus alertas"
      ON alertas_orcamento FOR UPDATE
      USING (
        family_id IN (
          SELECT family_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'alertas_orcamento'
    AND policyname = 'Usuários podem deletar alertas da própria família'
  ) THEN
    CREATE POLICY "Usuários podem deletar alertas da própria família"
      ON alertas_orcamento FOR DELETE
      USING (
        family_id IN (
          SELECT family_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- Políticas para patrimonio
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'patrimonio'
    AND policyname = 'Usuários podem ver próprio patrimônio'
  ) THEN
    CREATE POLICY "Usuários podem ver próprio patrimônio"
      ON patrimonio FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'patrimonio'
    AND policyname = 'Usuários podem criar próprio patrimônio'
  ) THEN
    CREATE POLICY "Usuários podem criar próprio patrimônio"
      ON patrimonio FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'patrimonio'
    AND policyname = 'Usuários podem atualizar próprio patrimônio'
  ) THEN
    CREATE POLICY "Usuários podem atualizar próprio patrimônio"
      ON patrimonio FOR UPDATE
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'patrimonio'
    AND policyname = 'Usuários podem deletar próprio patrimônio'
  ) THEN
    CREATE POLICY "Usuários podem deletar próprio patrimônio"
      ON patrimonio FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END $$;

-- =====================================================
-- 8. MENSAGEM DE SUCESSO
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration executada com sucesso!';
  RAISE NOTICE '📊 Tabelas criadas/verificadas: orcamentos_mensais, categorias_budget, alertas_orcamento, patrimonio';
  RAISE NOTICE '🔒 RLS habilitado em todas as tabelas';
  RAISE NOTICE '🎉 Sistema de orçamento está pronto para uso!';
END $$;
