-- Give the Super Admin role the new `messaging` module.
--
-- Same reasoning, and the same bug, as 20260901160000_grant_shipping_to_super_admin:
-- Role.permissions is JSON and normalizePermissions() defaults an unknown
-- module to "none". For a whole new feature that means the owner's own screen
-- 403s on the day it ships, with no hint that a permission they have never
-- heard of needs granting. The seed defines Super Admin as holding every
-- module, so this restores that definition.
--
-- Only the system role. Everyone else still starts at "none": switching on a
-- message that costs money per send should be a deliberate grant.
UPDATE "Role"
   SET permissions = jsonb_set(permissions::jsonb, '{messaging}', '"manage"', true)
 WHERE "isSystem" = true
   AND (permissions::jsonb -> 'messaging') IS NULL;
