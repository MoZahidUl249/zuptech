-- Give the seeded Manager role the ability to set staff passwords.
--
-- The decision was "a manager or a Super Admin sets it". The previous
-- migration carried Super Admin (isSystem) and any role already managing
-- staff — which on a seeded install is nobody else, because Manager holds
-- `staff: none`. Without this, "manager" in that decision meant nothing.
--
-- Keyed on the role ID, not its name. Ids are seeded and stable; a shop that
-- renamed "Manager" to "Supervisor" still matches, and a shop that deleted the
-- role matches nothing and is unaffected. Matching on a display name would be
-- guessing at data the shop owns.
--
-- Separate from the previous migration rather than folded into it: that one is
-- already applied, and editing an applied migration breaks its checksum.
UPDATE "Role"
   SET permissions = jsonb_set(permissions::jsonb, '{staffpassword}', '"manage"', true)
 WHERE id = 'manager'
   AND (permissions::jsonb ->> 'staffpassword') IS DISTINCT FROM 'manage';
