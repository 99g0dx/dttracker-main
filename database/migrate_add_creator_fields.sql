-- Migration: Add location, source_type, and imported_by_user_id to creators table
-- This migration is safe to run on existing databases
-- Run this after deploying the new schema

-- Add location column if it doesn't exist
ALTER TABLE public.creators 
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add source_type column if it doesn't exist
ALTER TABLE public.creators 
ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('manual', 'csv_import', 'scraper_extraction'));

-- Set default value for existing rows
UPDATE public.creators 
SET source_type = 'manual' 
WHERE source_type IS NULL;

-- Add imported_by_user_id column if it doesn't exist
ALTER TABLE public.creators 
ADD COLUMN IF NOT EXISTS imported_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Set imported_by_user_id to user_id for existing creators
UPDATE public.creators 
SET imported_by_user_id = user_id 
WHERE imported_by_user_id IS NULL;

-- Add index for better query performance on source_type
CREATE INDEX IF NOT EXISTS idx_creators_source_type ON public.creators(source_type);

-- Add index for better query performance on location
CREATE INDEX IF NOT EXISTS idx_creators_location ON public.creators(location) WHERE location IS NOT NULL;


