-- Enrich support_tickets with origin tracking, priority, tags, and admin notes
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS origem      text NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS prioridade  text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS tags        text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- Allow admin to read any user's plan (to enrich the support panel)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'plano_usuario'
      AND policyname = 'admin_can_read_plano_usuario'
  ) THEN
    CREATE POLICY "admin_can_read_plano_usuario"
      ON plano_usuario FOR SELECT
      USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;
