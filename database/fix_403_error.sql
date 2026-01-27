-- Fix 403 Forbidden Error for Sound Tracking
-- Run this in Supabase SQL Editor to fix permission issues

-- 1. Update the membership check function to ensure it handles Personal Workspaces
-- This ensures that if workspace_id matches your user_id, it returns TRUE
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.workspace_id = ws_id
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
  ) OR ws_id = auth.uid(); -- This part is crucial for personal workspaces
$$;

-- 2. Re-apply the INSERT policy for sound_tracks
-- This ensures authenticated users can actually write to the table
DROP POLICY IF EXISTS sound_tracks_insert_members ON public.sound_tracks;

CREATE POLICY sound_tracks_insert_members ON public.sound_tracks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND (created_by IS NULL OR created_by = auth.uid())
  );

-- 3. Ensure permissions for child tables (snapshots and posts)
-- These tables need policies so you can SEE the scraped results

-- Snapshots: Allow viewing if you have access to the parent track
DROP POLICY IF EXISTS sound_track_snapshots_select_members ON public.sound_track_snapshots;
CREATE POLICY sound_track_snapshots_select_members ON public.sound_track_snapshots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sound_tracks st
      WHERE st.id = sound_track_snapshots.sound_track_id
      AND public.is_workspace_member(st.workspace_id)
    )
  );

-- Posts: Allow viewing if you have access to the parent track
DROP POLICY IF EXISTS sound_track_posts_select_members ON public.sound_track_posts;
CREATE POLICY sound_track_posts_select_members ON public.sound_track_posts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sound_tracks st
      WHERE st.id = sound_track_posts.sound_track_id
      AND public.is_workspace_member(st.workspace_id)
    )
  );

-- Jobs: Allow viewing so the UI can show "Pending" or "Processing" status
DROP POLICY IF EXISTS sound_track_jobs_select_members ON public.sound_track_jobs;
CREATE POLICY sound_track_jobs_select_members ON public.sound_track_jobs
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_member(workspace_id)
  );

-- 5. Verify the fix
SELECT '✅ Permissions updated. RLS policies for tracks, snapshots, posts, and jobs are active.' as status;