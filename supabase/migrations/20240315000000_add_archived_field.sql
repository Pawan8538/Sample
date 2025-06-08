-- Add archived field to conversations table
ALTER TABLE conversations
ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for faster archived status queries
CREATE INDEX idx_conversations_archived ON conversations(archived);

-- Add last_active field for better sorting
ALTER TABLE conversations
ADD COLUMN last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Update last_active trigger
CREATE OR REPLACE FUNCTION update_conversation_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_active = CURRENT_TIMESTAMP
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_last_active
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_last_active(); 