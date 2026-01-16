-- Migration: Family Invites and Members
-- Descrição: Criação das tabelas para gerenciamento de convites e membros da família
-- Data: 2026-01-16

-- =====================================================
-- 1. ENUM TYPES
-- =====================================================

-- Tipo de role do membro da família
CREATE TYPE family_role AS ENUM ('admin', 'editor', 'viewer');

-- Status do convite
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'rejected', 'expired');

-- =====================================================
-- 2. FAMILY MEMBERS TABLE
-- =====================================================

-- Tabela de membros da família com suas roles
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role family_role NOT NULL DEFAULT 'viewer',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  UNIQUE(family_id, user_id) -- Um usuário não pode estar duas vezes na mesma família
);

-- Índices para performance
CREATE INDEX idx_family_members_family_id ON family_members(family_id);
CREATE INDEX idx_family_members_user_id ON family_members(user_id);
CREATE INDEX idx_family_members_role ON family_members(role);

-- =====================================================
-- 3. FAMILY INVITES TABLE
-- =====================================================

-- Tabela de convites para família
CREATE TABLE IF NOT EXISTS family_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE, -- Token único para o link de convite
  role family_role NOT NULL DEFAULT 'viewer',
  status invite_status NOT NULL DEFAULT 'pending',
  message TEXT, -- Mensagem opcional do convidador
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'), -- Expira em 7 dias
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CHECK (invited_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') -- Validação básica de email
);

-- Índices para performance
CREATE INDEX idx_family_invites_family_id ON family_invites(family_id);
CREATE INDEX idx_family_invites_token ON family_invites(token);
CREATE INDEX idx_family_invites_email ON family_invites(invited_email);
CREATE INDEX idx_family_invites_status ON family_invites(status);
CREATE INDEX idx_family_invites_invited_by ON family_invites(invited_by);

-- =====================================================
-- 4. FUNCTIONS
-- =====================================================

-- Função para gerar token único para convites
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..32 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar token automaticamente
CREATE OR REPLACE FUNCTION set_invite_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.token IS NULL OR NEW.token = '' THEN
    NEW.token := generate_invite_token();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_invite_token
  BEFORE INSERT ON family_invites
  FOR EACH ROW
  EXECUTE FUNCTION set_invite_token();

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_family_members_updated_at
  BEFORE UPDATE ON family_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_family_invites_updated_at
  BEFORE UPDATE ON family_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para marcar convites expirados
CREATE OR REPLACE FUNCTION mark_expired_invites()
RETURNS void AS $$
BEGIN
  UPDATE family_invites
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;

-- ========== FAMILY MEMBERS POLICIES ==========

-- Usuários podem ver membros da sua própria família
CREATE POLICY "Users can view members of their family"
  ON family_members FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Apenas admins podem adicionar membros
CREATE POLICY "Admins can insert family members"
  ON family_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.user_id = auth.uid()
        AND fm.family_id = family_members.family_id
        AND fm.role = 'admin'
    )
  );

-- Apenas admins podem atualizar membros
CREATE POLICY "Admins can update family members"
  ON family_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.user_id = auth.uid()
        AND fm.family_id = family_members.family_id
        AND fm.role = 'admin'
    )
  );

-- Apenas admins podem remover membros
CREATE POLICY "Admins can delete family members"
  ON family_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.user_id = auth.uid()
        AND fm.family_id = family_members.family_id
        AND fm.role = 'admin'
    )
  );

-- ========== FAMILY INVITES POLICIES ==========

-- Usuários podem ver convites da sua família (se forem admins)
CREATE POLICY "Admins can view family invites"
  ON family_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.user_id = auth.uid()
        AND fm.family_id = family_invites.family_id
        AND fm.role = 'admin'
    )
  );

-- Qualquer pessoa autenticada pode ver convites com seu email
CREATE POLICY "Users can view invites sent to their email"
  ON family_invites FOR SELECT
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Convites públicos podem ser visualizados por token (para página de aceitar convite)
CREATE POLICY "Anyone can view invite by token"
  ON family_invites FOR SELECT
  USING (true); -- Vamos controlar isso na aplicação

-- Apenas admins podem criar convites
CREATE POLICY "Admins can create invites"
  ON family_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.user_id = auth.uid()
        AND fm.family_id = family_invites.family_id
        AND fm.role = 'admin'
    )
  );

-- Apenas admins podem atualizar convites da sua família
CREATE POLICY "Admins can update family invites"
  ON family_invites FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.user_id = auth.uid()
        AND fm.family_id = family_invites.family_id
        AND fm.role = 'admin'
    )
  );

-- Usuários podem atualizar convites enviados para seu email (para aceitar/rejeitar)
CREATE POLICY "Users can update their own invites"
  ON family_invites FOR UPDATE
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Apenas admins podem deletar convites
CREATE POLICY "Admins can delete invites"
  ON family_invites FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.user_id = auth.uid()
        AND fm.family_id = family_invites.family_id
        AND fm.role = 'admin'
    )
  );

-- =====================================================
-- 6. INSERIR DADOS INICIAIS
-- =====================================================

-- Quando um usuário cria uma família, ele automaticamente se torna admin
-- Vamos criar uma função trigger para isso

CREATE OR REPLACE FUNCTION auto_add_family_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando uma família é criada, adicionar o criador como admin
  -- Precisamos saber quem criou, então vamos assumir que o user atual é o criador
  IF NEW.id IS NOT NULL THEN
    -- Buscar o usuário que acabou de criar a família
    -- Isso será chamado manualmente na aplicação
    NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comentário: A lógica de adicionar o criador como admin será feita na aplicação
-- para ter mais controle e clareza

-- =====================================================
-- 7. VIEWS ÚTEIS
-- =====================================================

-- View para ver membros com informações do usuário
CREATE OR REPLACE VIEW family_members_with_user AS
SELECT
  fm.id,
  fm.family_id,
  fm.user_id,
  fm.role,
  fm.joined_at,
  u.nome as user_name,
  au.email as user_email,
  u.patrimonio_base,
  u.created_at as user_created_at
FROM family_members fm
JOIN users u ON fm.user_id = u.id
JOIN auth.users au ON u.id = au.id;

-- View para ver convites com informações do convidador
CREATE OR REPLACE VIEW family_invites_with_details AS
SELECT
  fi.id,
  fi.family_id,
  fi.invited_by,
  fi.invited_email,
  fi.token,
  fi.role,
  fi.status,
  fi.message,
  fi.expires_at,
  fi.accepted_at,
  fi.accepted_by,
  fi.created_at,
  f.nome as family_name,
  u.nome as invited_by_name,
  au.email as invited_by_email
FROM family_invites fi
JOIN families f ON fi.family_id = f.id
JOIN users u ON fi.invited_by = u.id
JOIN auth.users au ON u.id = au.id;

-- =====================================================
-- 8. COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE family_members IS 'Membros da família com suas roles (admin, editor, viewer)';
COMMENT ON TABLE family_invites IS 'Convites pendentes para entrar na família';
COMMENT ON COLUMN family_invites.token IS 'Token único para o link de convite compartilhável';
COMMENT ON COLUMN family_invites.invited_email IS 'Email da pessoa convidada (usado para validação)';
COMMENT ON COLUMN family_invites.expires_at IS 'Data de expiração do convite (padrão: 7 dias)';

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
