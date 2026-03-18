-- ============================================================================
-- Migration 046: Push Notifications
-- ============================================================================
-- Adds tables for PWA push notification subscriptions, user preferences,
-- and a log to prevent duplicate/spam notifications (cooldown system).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- push_subscriptions
-- Stores Web Push Protocol subscription data per user/device
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,    -- Encryption public key
  auth        text NOT NULL,    -- Auth secret
  user_agent  text,             -- Device/browser info for debugging
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can read all subscriptions (for sending from Edge Functions)
CREATE POLICY "service role reads all subscriptions"
  ON push_subscriptions FOR SELECT
  TO service_role
  USING (true);

-- Index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active
  ON push_subscriptions (user_id, is_active);

-- ----------------------------------------------------------------------------
-- push_notification_preferences
-- Per-user opt-in/opt-out for each notification category
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS push_notification_preferences (
  user_id              uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  envelope_burst       boolean DEFAULT true,   -- Envelope estourado
  expense_overdue      boolean DEFAULT true,   -- Despesas vencidas
  credit_card_limit    boolean DEFAULT true,   -- Cartão no limite
  trial_expiring       boolean DEFAULT true,   -- Trial expirando / expirado
  month_end_reminder   boolean DEFAULT true,   -- 3 dias antes do fim do mês
  ai_proactive         boolean DEFAULT true,   -- Mensagens proativas da IA
  savings_goals        boolean DEFAULT true,   -- Milestones de caixinha (50/75/100%)
  updated_at           timestamptz DEFAULT now()
);

ALTER TABLE push_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own push preferences"
  ON push_notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- push_notification_log
-- Tracks sent notifications to enforce cooldowns and prevent duplicates
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS push_notification_log (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  notification_type text NOT NULL,   -- 'envelope_burst', 'trial_3d', 'expense_overdue', etc.
  ref_key           text,            -- Optional: categoria_id, cartao_id, 'trial', etc.
  sent_at           timestamptz DEFAULT now()
);

ALTER TABLE push_notification_log ENABLE ROW LEVEL SECURITY;

-- Users should not be able to tamper with the log
CREATE POLICY "service role manages push log"
  ON push_notification_log FOR ALL
  TO service_role
  USING (true);

-- Index for cooldown queries
CREATE INDEX IF NOT EXISTS idx_push_notification_log_user_type_sent
  ON push_notification_log (user_id, notification_type, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_notification_log_user_type_ref
  ON push_notification_log (user_id, notification_type, ref_key, sent_at DESC);

-- ----------------------------------------------------------------------------
-- Auto-create default preferences when a user subscribes for the first time
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_default_push_preferences()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO push_notification_preferences (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_push_preferences
  AFTER INSERT ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION create_default_push_preferences();

-- ----------------------------------------------------------------------------
-- Helper: auto-update updated_at on push_subscriptions
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_push_subscription_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_push_subscription_timestamp();
