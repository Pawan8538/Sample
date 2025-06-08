-- Update model_type enum to include new model names
ALTER TYPE model_type ADD VALUE IF NOT EXISTS 'gemini-1.5-flash-latest';
 
-- Verify the enum values
SELECT unnest(enum_range(NULL::model_type)) as model_type; 