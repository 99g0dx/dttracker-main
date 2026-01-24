-- Migration: Create usage_counters table
-- Description: Track resource usage per workspace for limit enforcement

-- Create usage_counters table
CREATE TABLE IF NOT EXISTS usage_counters (
  workspace_id UUID PRIMARY KEY,
  active_campaigns_count INTEGER DEFAULT 0,
  total_creators_count INTEGER DEFAULT 0,
  active_team_members_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage counters
CREATE POLICY "Users can view own usage counters"
  ON usage_counters FOR SELECT
  USING (workspace_id = auth.uid());

-- Function to update campaign count
CREATE OR REPLACE FUNCTION update_campaign_count()
RETURNS TRIGGER AS $$
DECLARE
  workspace UUID;
  new_count INTEGER;
BEGIN
  -- Determine workspace_id from the campaign
  IF TG_OP = 'DELETE' THEN
    workspace := OLD.workspace_id;
  ELSE
    workspace := NEW.workspace_id;
  END IF;

  -- Count active campaigns for this workspace
  SELECT COUNT(*) INTO new_count
  FROM campaigns
  WHERE workspace_id = workspace
    AND deleted_at IS NULL;

  -- Upsert the usage counter
  INSERT INTO usage_counters (workspace_id, active_campaigns_count, updated_at)
  VALUES (workspace, new_count, now())
  ON CONFLICT (workspace_id)
  DO UPDATE SET
    active_campaigns_count = new_count,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update creators count
CREATE OR REPLACE FUNCTION update_creators_count()
RETURNS TRIGGER AS $$
DECLARE
  workspace UUID;
  new_count INTEGER;
BEGIN
  -- Determine workspace_id from the creator
  IF TG_OP = 'DELETE' THEN
    workspace := OLD.workspace_id;
  ELSE
    workspace := NEW.workspace_id;
  END IF;

  -- Count total creators for this workspace
  SELECT COUNT(*) INTO new_count
  FROM workspace_creators
  WHERE workspace_id = workspace;

  -- Upsert the usage counter
  INSERT INTO usage_counters (workspace_id, total_creators_count, updated_at)
  VALUES (workspace, new_count, now())
  ON CONFLICT (workspace_id)
  DO UPDATE SET
    total_creators_count = new_count,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update team members count
CREATE OR REPLACE FUNCTION update_team_members_count()
RETURNS TRIGGER AS $$
DECLARE
  workspace UUID;
  new_count INTEGER;
BEGIN
  -- Determine workspace_id from the team member
  IF TG_OP = 'DELETE' THEN
    workspace := OLD.workspace_id;
  ELSE
    workspace := NEW.workspace_id;
  END IF;

  -- Count active team members (including owner)
  SELECT COUNT(*) + 1 INTO new_count -- +1 for owner
  FROM team_members
  WHERE workspace_id = workspace
    AND status = 'active';

  -- Upsert the usage counter
  INSERT INTO usage_counters (workspace_id, active_team_members_count, updated_at)
  VALUES (workspace, new_count, now())
  ON CONFLICT (workspace_id)
  DO UPDATE SET
    active_team_members_count = new_count,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for campaign count
DROP TRIGGER IF EXISTS update_campaign_count_on_insert ON campaigns;
CREATE TRIGGER update_campaign_count_on_insert
  AFTER INSERT ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_count();

DROP TRIGGER IF EXISTS update_campaign_count_on_delete ON campaigns;
CREATE TRIGGER update_campaign_count_on_delete
  AFTER DELETE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_count();

DROP TRIGGER IF EXISTS update_campaign_count_on_update ON campaigns;
CREATE TRIGGER update_campaign_count_on_update
  AFTER UPDATE OF deleted_at ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_count();

-- Create triggers for creators count (if workspace_creators table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspace_creators') THEN
    DROP TRIGGER IF EXISTS update_creators_count_on_insert ON workspace_creators;
    CREATE TRIGGER update_creators_count_on_insert
      AFTER INSERT ON workspace_creators
      FOR EACH ROW
      EXECUTE FUNCTION update_creators_count();

    DROP TRIGGER IF EXISTS update_creators_count_on_delete ON workspace_creators;
    CREATE TRIGGER update_creators_count_on_delete
      AFTER DELETE ON workspace_creators
      FOR EACH ROW
      EXECUTE FUNCTION update_creators_count();
  END IF;
END $$;

-- Create triggers for team members count
DROP TRIGGER IF EXISTS update_team_members_count_on_insert ON team_members;
CREATE TRIGGER update_team_members_count_on_insert
  AFTER INSERT ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_team_members_count();

DROP TRIGGER IF EXISTS update_team_members_count_on_delete ON team_members;
CREATE TRIGGER update_team_members_count_on_delete
  AFTER DELETE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_team_members_count();

DROP TRIGGER IF EXISTS update_team_members_count_on_update ON team_members;
CREATE TRIGGER update_team_members_count_on_update
  AFTER UPDATE OF status ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_team_members_count();

-- Initialize usage counters for existing workspaces
INSERT INTO usage_counters (workspace_id, active_campaigns_count, total_creators_count, active_team_members_count, updated_at)
SELECT
  p.id as workspace_id,
  COALESCE((SELECT COUNT(*) FROM campaigns c WHERE c.workspace_id = p.id AND c.deleted_at IS NULL), 0),
  COALESCE((SELECT COUNT(*) FROM workspace_creators wc WHERE wc.workspace_id = p.id), 0),
  COALESCE((SELECT COUNT(*) FROM team_members tm WHERE tm.workspace_id = p.id AND tm.status = 'active'), 0) + 1,
  now()
FROM profiles p
ON CONFLICT (workspace_id) DO UPDATE SET
  active_campaigns_count = EXCLUDED.active_campaigns_count,
  total_creators_count = EXCLUDED.total_creators_count,
  active_team_members_count = EXCLUDED.active_team_members_count,
  updated_at = now();
