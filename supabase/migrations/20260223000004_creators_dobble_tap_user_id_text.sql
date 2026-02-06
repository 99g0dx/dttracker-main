-- Dobble Tap sends creator IDs as strings (e.g. "test-1770401566" or numeric IDs).
-- Store them as TEXT so we can sync without "invalid input syntax for type uuid" errors.
ALTER TABLE public.creators
  ALTER COLUMN dobble_tap_user_id TYPE TEXT USING dobble_tap_user_id::TEXT;
