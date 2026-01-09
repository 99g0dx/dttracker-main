-- 003_add_workspaces_constraints_indexes.sql
-- Purpose: Add optional slug, unique constraint on name, and index on created_at

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS slug text;

-- Optional: unique name constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.contype = 'u'
      AND n.nspname = 'public'
      AND t.relname = 'workspaces'
      AND c.conname = 'workspaces_name_unique'
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_name_unique UNIQUE (name);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_workspaces_created_at ON public.workspaces (created_at);

