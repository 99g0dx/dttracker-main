-- Migration: Create trigger to automatically create a workspace for new users
-- This ensures that every new signup gets a workspace immediately, preventing
-- foreign key errors when they try to create content.

-- 1. Create the function
CREATE OR REPLACE FUNCTION public.handle_new_user_workspace()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.workspaces (id, user_id, owner_user_id, name)
  VALUES (new.id, new.id, new.id, 'My Workspace');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created_workspace ON auth.users;
CREATE TRIGGER on_auth_user_created_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_workspace();