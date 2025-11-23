-- =============================================
-- WHATSAPP INTEGRATION TABLES
-- Migration: 20241122_create_whatsapp_tables.sql
-- =============================================

-- WhatsApp Connections (link phone to user account)
CREATE TABLE IF NOT EXISTS whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  phone_verified BOOLEAN DEFAULT false,
  verification_code VARCHAR(6),
  verification_expires_at TIMESTAMPTZ,

  -- Preferences
  timezone VARCHAR(50) DEFAULT 'America/Santiago',
  language VARCHAR(10) DEFAULT 'es',

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_message_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminder Settings
CREATE TABLE IF NOT EXISTS whatsapp_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES whatsapp_connections(id) ON DELETE CASCADE,

  reminder_type VARCHAR(50) NOT NULL,
  -- Types: 'morning_checkin', 'night_reflection', 'weekly_review', 'study_block'

  enabled BOOLEAN DEFAULT true,

  -- Schedule
  time_of_day TIME,
  day_of_week INTEGER, -- 0-6 (Sunday-Saturday)
  day_of_month INTEGER, -- 1-31
  minutes_before INTEGER, -- For study blocks

  -- Tracking
  last_sent_at TIMESTAMPTZ,
  next_scheduled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(connection_id, reminder_type)
);

-- Conversation Context (for multi-step flows)
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES whatsapp_connections(id) ON DELETE CASCADE,

  -- Current conversation state
  current_flow VARCHAR(50),
  flow_step INTEGER DEFAULT 0,
  flow_data JSONB DEFAULT '{}',

  -- Expiration
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 minutes',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message Logs
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES whatsapp_connections(id) ON DELETE CASCADE,

  direction VARCHAR(10) NOT NULL, -- 'inbound' or 'outbound'
  message_type VARCHAR(20) NOT NULL, -- 'text', 'button', 'template'

  content TEXT,
  metadata JSONB DEFAULT '{}',

  -- Twilio tracking
  twilio_sid VARCHAR(50),
  status VARCHAR(20), -- 'sent', 'delivered', 'read', 'failed'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_user ON whatsapp_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_phone ON whatsapp_connections(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_reminders_next ON whatsapp_reminders(next_scheduled_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_active ON whatsapp_conversations(connection_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_connection ON whatsapp_messages(connection_id, created_at);

-- Enable RLS
ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_connections
CREATE POLICY "Users can view own WhatsApp connections"
  ON whatsapp_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own WhatsApp connections"
  ON whatsapp_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own WhatsApp connections"
  ON whatsapp_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own WhatsApp connections"
  ON whatsapp_connections FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for whatsapp_reminders
CREATE POLICY "Users can manage own reminders"
  ON whatsapp_reminders FOR ALL
  USING (
    connection_id IN (
      SELECT id FROM whatsapp_connections WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for whatsapp_conversations
CREATE POLICY "Users can manage own conversations"
  ON whatsapp_conversations FOR ALL
  USING (
    connection_id IN (
      SELECT id FROM whatsapp_connections WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for whatsapp_messages
CREATE POLICY "Users can view own messages"
  ON whatsapp_messages FOR SELECT
  USING (
    connection_id IN (
      SELECT id FROM whatsapp_connections WHERE user_id = auth.uid()
    )
  );

-- Service role can access all (for webhook)
CREATE POLICY "Service role full access to connections"
  ON whatsapp_connections FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to reminders"
  ON whatsapp_reminders FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to conversations"
  ON whatsapp_conversations FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to messages"
  ON whatsapp_messages FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
