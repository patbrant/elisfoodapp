-- Add admin_code to households for self-service role elevation.
-- Caregivers who know the admin_code can promote themselves via the
-- claim_admin_role() RPC without the current admin needing to act.
ALTER TABLE households ADD COLUMN IF NOT EXISTS admin_code TEXT;

-- Verify the supplied code and promote the calling user to admin.
-- SECURITY DEFINER so admin_code is never returned to the client.
CREATE OR REPLACE FUNCTION claim_admin_role(p_household_id TEXT, p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stored_code TEXT;
BEGIN
  IF NOT is_household_member(p_household_id) THEN
    RETURN FALSE;
  END IF;
  SELECT admin_code INTO stored_code FROM households WHERE id = p_household_id;
  IF stored_code IS NULL OR upper(trim(stored_code)) != upper(trim(p_code)) THEN
    RETURN FALSE;
  END IF;
  UPDATE household_members
    SET role = 'admin'
  WHERE household_id = p_household_id AND user_id = auth.uid();
  RETURN TRUE;
END;
$$;

-- Return the admin_code only to current admins.
-- SECURITY DEFINER so the column is never exposed via direct SELECT.
CREATE OR REPLACE FUNCTION get_admin_code(p_household_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code TEXT;
BEGIN
  IF NOT is_household_admin(p_household_id) THEN
    RETURN NULL;
  END IF;
  SELECT admin_code INTO code FROM households WHERE id = p_household_id;
  RETURN code;
END;
$$;
