-- PocketWise - Initial Schema Migration
-- This migration creates all tables, enums, and RLS policies for the application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

-- Tipo de transação
CREATE TYPE transaction_type AS ENUM ('despesa', 'receita');

-- Forma de pagamento
CREATE TYPE payment_method AS ENUM (
  'dinheiro',
  'debito',
  'credito',
  'pix',
  'transferencia',
  'boleto'
);

-- Status de lançamento
CREATE TYPE lancamento_status AS ENUM ('pago', 'pendente', 'projetado');

-- Status de planejamento
CREATE TYPE planejamento_status AS ENUM ('ativo', 'concluido', 'cancelado');

-- =====================================================
-- TABLES
-- =====================================================

-- Tabela de famílias
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extensão da tabela de usuários do Supabase Auth
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  patrimonio_base DECIMAL(15, 2) DEFAULT 0,
  family_id UUID REFERENCES families(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de categorias
CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  icone TEXT,
  tipo transaction_type NOT NULL,
  categoria_pai_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  cor TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Validação: deve ter user_id OU family_id, não ambos
  CONSTRAINT categorias_owner_check CHECK (
    (user_id IS NOT NULL AND family_id IS NULL) OR
    (user_id IS NULL AND family_id IS NOT NULL)
  )
);

-- Índices para categorias
CREATE INDEX idx_categorias_user_id ON categorias(user_id);
CREATE INDEX idx_categorias_family_id ON categorias(family_id);
CREATE INDEX idx_categorias_tipo ON categorias(tipo);

-- Tabela de cartões de crédito
CREATE TABLE cartoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  dia_fechamento INTEGER NOT NULL CHECK (dia_fechamento >= 1 AND dia_fechamento <= 31),
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
  limite DECIMAL(15, 2),
  cor TEXT DEFAULT '#6366f1',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Validação: deve ter user_id OU family_id, não ambos
  CONSTRAINT cartoes_owner_check CHECK (
    (user_id IS NOT NULL AND family_id IS NULL) OR
    (user_id IS NULL AND family_id IS NOT NULL)
  )
);

-- Índices para cartões
CREATE INDEX idx_cartoes_user_id ON cartoes(user_id);
CREATE INDEX idx_cartoes_family_id ON cartoes(family_id);

-- Tabela de lançamentos (transações)
CREATE TABLE lancamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  criado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  tipo transaction_type NOT NULL,
  data DATE NOT NULL,
  valor DECIMAL(15, 2) NOT NULL CHECK (valor > 0),
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  subcategoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  observacao TEXT,
  forma_pagamento payment_method NOT NULL,
  cartao_id UUID REFERENCES cartoes(id) ON DELETE SET NULL,
  parcela_atual INTEGER CHECK (parcela_atual >= 1),
  parcela_total INTEGER CHECK (parcela_total >= 1),
  grupo_parcelas_id UUID,
  status lancamento_status DEFAULT 'pendente',
  data_vencimento_fatura DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Validações
  CONSTRAINT lancamentos_parcelas_check CHECK (
    (parcela_atual IS NULL AND parcela_total IS NULL) OR
    (parcela_atual IS NOT NULL AND parcela_total IS NOT NULL AND parcela_atual <= parcela_total)
  ),
  CONSTRAINT lancamentos_cartao_check CHECK (
    (forma_pagamento = 'credito' AND cartao_id IS NOT NULL) OR
    (forma_pagamento != 'credito')
  )
);

-- Índices para lançamentos
CREATE INDEX idx_lancamentos_family_id ON lancamentos(family_id);
CREATE INDEX idx_lancamentos_criado_por ON lancamentos(criado_por);
CREATE INDEX idx_lancamentos_data ON lancamentos(data);
CREATE INDEX idx_lancamentos_tipo ON lancamentos(tipo);
CREATE INDEX idx_lancamentos_categoria_id ON lancamentos(categoria_id);
CREATE INDEX idx_lancamentos_cartao_id ON lancamentos(cartao_id);
CREATE INDEX idx_lancamentos_status ON lancamentos(status);
CREATE INDEX idx_lancamentos_grupo_parcelas ON lancamentos(grupo_parcelas_id);

-- Tabela de planejamentos
CREATE TABLE planejamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  criado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  valor DECIMAL(15, 2) NOT NULL CHECK (valor > 0),
  data_prevista DATE NOT NULL,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  observacoes TEXT,
  status planejamento_status DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para planejamentos
CREATE INDEX idx_planejamentos_family_id ON planejamentos(family_id);
CREATE INDEX idx_planejamentos_status ON planejamentos(status);
CREATE INDEX idx_planejamentos_data_prevista ON planejamentos(data_prevista);

-- Tabela de receitas projetadas
CREATE TABLE receitas_projetadas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  criado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(15, 2) NOT NULL CHECK (valor > 0),
  data_prevista DATE NOT NULL,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  recorrente BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para receitas projetadas
CREATE INDEX idx_receitas_projetadas_family_id ON receitas_projetadas(family_id);
CREATE INDEX idx_receitas_projetadas_data_prevista ON receitas_projetadas(data_prevista);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Triggers para atualizar updated_at
CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categorias_updated_at BEFORE UPDATE ON categorias
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cartoes_updated_at BEFORE UPDATE ON cartoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lancamentos_updated_at BEFORE UPDATE ON lancamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_planejamentos_updated_at BEFORE UPDATE ON planejamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_receitas_projetadas_updated_at BEFORE UPDATE ON receitas_projetadas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Ativar RLS em todas as tabelas
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE planejamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE receitas_projetadas ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - FAMILIES
-- =====================================================

-- Usuários podem ver sua própria família
CREATE POLICY "Users can view their own family"
  ON families FOR SELECT
  USING (
    id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Usuários podem atualizar sua própria família
CREATE POLICY "Users can update their own family"
  ON families FOR UPDATE
  USING (
    id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- RLS POLICIES - USERS
-- =====================================================

-- Usuários podem ver membros da própria família
CREATE POLICY "Users can view family members"
  ON users FOR SELECT
  USING (
    id = auth.uid() OR
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- Usuários podem inserir seu próprio perfil (signup)
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (id = auth.uid());

-- =====================================================
-- RLS POLICIES - CATEGORIAS
-- =====================================================

-- Usuários podem ver suas categorias pessoais e da família
CREATE POLICY "Users can view their categories"
  ON categorias FOR SELECT
  USING (
    user_id = auth.uid() OR
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Usuários podem criar categorias pessoais ou da família
CREATE POLICY "Users can create categories"
  ON categorias FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Usuários podem atualizar suas categorias pessoais ou da família
CREATE POLICY "Users can update their categories"
  ON categorias FOR UPDATE
  USING (
    user_id = auth.uid() OR
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Usuários podem deletar suas categorias pessoais ou da família
CREATE POLICY "Users can delete their categories"
  ON categorias FOR DELETE
  USING (
    user_id = auth.uid() OR
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- RLS POLICIES - CARTOES
-- =====================================================

-- Políticas similares para cartões
CREATE POLICY "Users can view their cards"
  ON cartoes FOR SELECT
  USING (
    user_id = auth.uid() OR
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create cards"
  ON cartoes FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their cards"
  ON cartoes FOR UPDATE
  USING (
    user_id = auth.uid() OR
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their cards"
  ON cartoes FOR DELETE
  USING (
    user_id = auth.uid() OR
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- RLS POLICIES - LANCAMENTOS
-- =====================================================

-- Membros da família podem ver todos os lançamentos da família
CREATE POLICY "Family members can view family transactions"
  ON lancamentos FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Membros da família podem criar lançamentos
CREATE POLICY "Family members can create transactions"
  ON lancamentos FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Membros da família podem atualizar lançamentos
CREATE POLICY "Family members can update transactions"
  ON lancamentos FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Membros da família podem deletar lançamentos
CREATE POLICY "Family members can delete transactions"
  ON lancamentos FOR DELETE
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- RLS POLICIES - PLANEJAMENTOS
-- =====================================================

CREATE POLICY "Family members can view family plans"
  ON planejamentos FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Family members can create plans"
  ON planejamentos FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Family members can update plans"
  ON planejamentos FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Family members can delete plans"
  ON planejamentos FOR DELETE
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- RLS POLICIES - RECEITAS PROJETADAS
-- =====================================================

CREATE POLICY "Family members can view projected income"
  ON receitas_projetadas FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Family members can create projected income"
  ON receitas_projetadas FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Family members can update projected income"
  ON receitas_projetadas FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Family members can delete projected income"
  ON receitas_projetadas FOR DELETE
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- SEED DATA - Categorias Padrão
-- =====================================================

-- Esta função será executada quando um novo usuário criar uma família
-- Para adicionar categorias padrão
CREATE OR REPLACE FUNCTION create_default_categories(p_family_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Categorias de Despesa
  INSERT INTO categorias (family_id, nome, icone, tipo, cor) VALUES
    (p_family_id, 'Alimentação', 'utensils', 'despesa', '#ef4444'),
    (p_family_id, 'Transporte', 'car', 'despesa', '#f59e0b'),
    (p_family_id, 'Moradia', 'home', 'despesa', '#3b82f6'),
    (p_family_id, 'Contas', 'receipt', 'despesa', '#8b5cf6'),
    (p_family_id, 'Lazer', 'smile', 'despesa', '#ec4899'),
    (p_family_id, 'Saúde', 'heart', 'despesa', '#10b981'),
    (p_family_id, 'Educação', 'book', 'despesa', '#6366f1'),
    (p_family_id, 'Vestuário', 'shirt', 'despesa', '#f97316'),
    (p_family_id, 'Outros', 'more-horizontal', 'despesa', '#6b7280');

  -- Categorias de Receita
  INSERT INTO categorias (family_id, nome, icone, tipo, cor) VALUES
    (p_family_id, 'Salário', 'briefcase', 'receita', '#10b981'),
    (p_family_id, 'Investimentos', 'trending-up', 'receita', '#3b82f6'),
    (p_family_id, 'Freelance', 'code', 'receita', '#8b5cf6'),
    (p_family_id, 'Outros', 'more-horizontal', 'receita', '#6b7280');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE families IS 'Famílias que compartilham finanças';
COMMENT ON TABLE users IS 'Extensão da tabela auth.users com dados adicionais';
COMMENT ON TABLE categorias IS 'Categorias de transações (podem ser pessoais ou da família)';
COMMENT ON TABLE cartoes IS 'Cartões de crédito';
COMMENT ON TABLE lancamentos IS 'Lançamentos financeiros (receitas e despesas)';
COMMENT ON TABLE planejamentos IS 'Planejamentos financeiros futuros';
COMMENT ON TABLE receitas_projetadas IS 'Receitas projetadas para o futuro';
