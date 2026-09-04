-- Grant the new `staffpassword` module.
--
-- Staff no longer reset their own passwords, so somebody has to set them. That
-- somebody is Manager and Super Admin — but the seeded Manager holds
-- `staff: none`, and granting the whole staff module to fix that would also
-- hand them staff creation, deletion and the permission matrix. Hence a narrow
-- module, the same carve-out `orderadjust` makes against `orders`.
--
-- Two grants, for two different reasons:
--
--   isSystem  — Super Admin is defined by the seed as holding every module, so
--               a new module it does not hold contradicts that definition and
--               403s the owner on day one (the lockout `shipping` hit).
--
--   staff:manage — any role already trusted to create and delete staff can
--               obviously set a password; withholding it would be theatre.
--               This is what carries the seeded Manager over IF it manages
--               staff, and is keyed on the permission rather than the role
--               name, because roles here are data and can be renamed.
--
-- A Manager that manages no staff still needs this ticked by hand on the Team
-- screen. That is deliberate: it is a grant somebody should make on purpose.
UPDATE "Role"
   SET permissions = jsonb_set(permissions::jsonb, '{staffpassword}', '"manage"', true)
 WHERE (permissions::jsonb -> 'staffpassword') IS NULL
   AND ("isSystem" = true OR permissions::jsonb ->> 'staff' = 'manage');
