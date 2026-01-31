-- Debug Script: Simulate Insert Failure
-- Run this in Supabase SQL Editor to see exactly why the insert is failing

DO $$
DECLARE
  -- Using the User ID from your previous logs
  test_user_id UUID := '482325e0-5fa1-4097-aae7-ca61a361f752';
BEGIN
  -- 1. Simulate the authenticated user context
  PERFORM set_config('request.jwt.claims', json_build_object('sub', test_user_id, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';

  -- 2. Attempt to insert a track (mimicking the Edge Function)
  -- We use the user ID as the workspace_id (Personal Workspace logic)
  INSERT INTO public.sound_tracks (
    workspace_id, url, title, platform, created_by
  ) VALUES (
    test_user_id, 
    'https://www.tiktok.com/@debug/video/123456789', 
    'Debug Test Track', 
    'tiktok', 
    test_user_id
  );

  RAISE NOTICE '✅ Success! The database allows the insert.';
  
  -- If successful, we roll it back so we don't leave junk data
  RAISE EXCEPTION 'Test complete (rolling back changes)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Result: %', SQLERRM;
END$$;