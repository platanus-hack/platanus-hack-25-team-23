-- =============================================
-- AI CONVERSATION HISTORY FOR WHATSAPP
-- Migration: 20241122_add_ai_conversation_history.sql
-- =============================================

-- Add columns for AI conversation history to whatsapp_messages
-- These columns store role and phone_number for easier AI context retrieval

ALTER TABLE whatsapp_messages
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS role VARCHAR(20); -- 'user' or 'assistant'

-- Create index for efficient conversation history retrieval
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone_created
ON whatsapp_messages(phone_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_role
ON whatsapp_messages(role);

-- Update the content column to TEXT if it isn't already
-- (This ensures we can store longer AI responses)

-- Allow service role to insert messages without connection_id for AI conversations
ALTER TABLE whatsapp_messages
ALTER COLUMN connection_id DROP NOT NULL;
