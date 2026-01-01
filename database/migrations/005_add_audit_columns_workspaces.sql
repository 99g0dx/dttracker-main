-- 005_add_audit_columns_workspaces.sql
-- Purpose: Add audit and soft-delete columns to workspaces

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

