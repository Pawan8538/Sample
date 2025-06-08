-- Create a function to delete a conversation and its messages in a transaction
CREATE OR REPLACE FUNCTION delete_conversation(p_conversation_id UUID, p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Start transaction
  BEGIN
    -- Delete all messages in the conversation
    DELETE FROM messages
    WHERE conversation_id = p_conversation_id;

    -- Delete the conversation
    DELETE FROM conversations
    WHERE id = p_conversation_id
    AND user_id = p_user_id;

    -- If no rows were affected, raise an error
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conversation not found or you do not have permission to delete it';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback transaction on error
      RAISE EXCEPTION 'Failed to delete conversation: %', SQLERRM;
  END;
END;
$$; 