-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  email       text NOT NULL,
  telefone    text,
  categoria   text NOT NULL CHECK (categoria IN ('Assinatura', 'Problema Técnico', 'Dúvidas', 'Outro')),
  descricao   text NOT NULL,
  status      text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_andamento', 'resolvido')),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa pode abrir um chamado (público, sem login)
CREATE POLICY "anyone_can_insert" ON support_tickets
  FOR INSERT WITH CHECK (true);

-- Somente admin pode ler chamados
CREATE POLICY "admin_can_select" ON support_tickets
  FOR SELECT USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Somente admin pode atualizar status
CREATE POLICY "admin_can_update" ON support_tickets
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Índice para ordenação por data
CREATE INDEX IF NOT EXISTS support_tickets_created_at_idx ON support_tickets (created_at DESC);
