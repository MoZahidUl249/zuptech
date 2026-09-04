-- Give the Super Admin role the new `shipping` module.
--
-- Role.permissions is JSON and normalizePermissions() defaults an unknown
-- module to "none", which is the right default for a NARROWING of an existing
-- capability — that is why `orderadjust` deliberately arrived held by nobody.
--
-- It is the wrong default here. `shipping` is a whole feature, and the seed
-- defines Super Admin as holding every module (`perms([], [...ADMIN_MODULES])`
-- in prisma/seed.ts). A Super Admin without it contradicts that definition and
-- makes the feature look broken on the day it ships: every courier screen 403s
-- and the only way out is for someone to notice they must grant themselves a
-- permission they did not know existed.
--
-- Deliberately ONLY the system role. Every other role still starts at "none",
-- so handing a customer's address to a courier stays a decision someone makes
-- on purpose.
UPDATE "Role"
   SET permissions = jsonb_set(permissions::jsonb, '{shipping}', '"manage"', true)
 WHERE "isSystem" = true
   AND (permissions::jsonb -> 'shipping') IS NULL;
