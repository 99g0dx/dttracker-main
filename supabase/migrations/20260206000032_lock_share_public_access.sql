-- Lock down public share access to RPC/Edge Function only

-- Campaigns: remove public share-link read
DROP POLICY IF EXISTS "Anonymous users can view campaigns via valid share links" ON public.campaigns;
DROP POLICY IF EXISTS "Public can view campaigns via valid share links" ON public.campaigns;

-- Posts: remove public share-link read
DROP POLICY IF EXISTS "Public can view posts via valid share links" ON public.posts;

-- Post metrics: remove public share-link read
DROP POLICY IF EXISTS "Public can view post_metrics via share links" ON public.post_metrics;

-- Creators: remove public share-link read
DROP POLICY IF EXISTS "Public can view creators via share links" ON public.creators;

-- Campaign share links: ensure no public read remains
DROP POLICY IF EXISTS "Anyone can view share links" ON public.campaign_share_links;
DROP POLICY IF EXISTS "Public can view share links by token or owners can view their l" ON public.campaign_share_links;
DROP POLICY IF EXISTS "Public can view share links by token or owners can view their links" ON public.campaign_share_links;
