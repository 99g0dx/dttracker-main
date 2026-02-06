-- Migration: Handle creator deletion in community_fans
-- When a creator is deleted, set creator_id to NULL in community_fans to prevent orphaned references

-- Function to handle creator deletion
CREATE OR REPLACE FUNCTION handle_creator_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set creator_id to NULL for all fans that referenced the deleted creator
  UPDATE public.community_fans
  SET creator_id = NULL,
      updated_at = NOW()
  WHERE creator_id = OLD.id;

  RETURN OLD;
END;
$$;

-- Create trigger for creator deletion
DROP TRIGGER IF EXISTS on_creator_delete_clear_fan_references ON public.creators;
CREATE TRIGGER on_creator_delete_clear_fan_references
  AFTER DELETE ON public.creators
  FOR EACH ROW
  EXECUTE FUNCTION handle_creator_deletion();

-- Add comment
COMMENT ON FUNCTION handle_creator_deletion() IS 
'When a creator is deleted, sets creator_id to NULL in all community_fans records that referenced it, preventing orphaned foreign key references.';
