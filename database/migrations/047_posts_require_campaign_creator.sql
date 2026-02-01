-- Require posts to reference existing campaign creators

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert posts in campaigns they own or edit"
  ON public.posts;

CREATE POLICY "Users can insert posts in campaigns they have access to"
  ON public.posts FOR INSERT
  WITH CHECK (
    creator_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = posts.campaign_id
        AND public.is_workspace_member(c.workspace_id, auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.campaign_creators cc
      WHERE cc.campaign_id = posts.campaign_id
        AND cc.creator_id = posts.creator_id
    )
  );
