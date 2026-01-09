-- 001_create_extension_pgcrypto.sql
-- Purpose: Ensure gen_random_uuid() is available for UUID generation

CREATE EXTENSION IF NOT EXISTS pgcrypto;

