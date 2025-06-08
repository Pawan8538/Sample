-- First, let's see what values are currently allowed
SELECT unnest(enum_range(NULL::model_type)) as current_model_types;

-- Start a transaction
BEGIN;

-- Add the new model type
ALTER TYPE model_type ADD VALUE IF NOT EXISTS 'gemini-1.5-flash-latest';

-- Commit the transaction to make the new enum value available
COMMIT;

-- Now we can safely check the enum values
SELECT unnest(enum_range(NULL::model_type)) as model_types; 