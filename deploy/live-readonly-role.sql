-- A SELECT-only role on the live database, for reading it from a workstation.
--
--   docker compose --env-file .env.production exec -T db \
--     psql -U postgres -d zuptech -v ro_password="'CHOOSE-A-PASSWORD'" \
--     < deploy/live-readonly-role.sql
--
-- Run once, on the VPS, as the superuser. Re-running is safe: every statement
-- below is idempotent apart from the password, which is simply set again.
--
-- This exists because `scripts/live-tunnel.sh` points a developer's machine at
-- the real database. The tunnel is the convenience; this role is what keeps the
-- convenience from being dangerous. Under it a bug in code under test raises a
-- Postgres permission error instead of rewriting a customer's order.
--
-- It is NOT a substitute for care in write mode — it is the reason write mode
-- has to be asked for.

\set ON_ERROR_STOP on

-- :ro_password is passed with -v. Bare CREATE ROLE has no IF NOT EXISTS, so
-- the existence check goes in a DO block; the password is set outside it either
-- way, which is what makes a re-run a rotation rather than an error.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zuptech_ro') THEN
    CREATE ROLE zuptech_ro LOGIN;
  END IF;
END
$$;

ALTER ROLE zuptech_ro WITH PASSWORD :ro_password;

-- Belt and braces. NOSUPERUSER/NOCREATEDB/NOCREATEROLE are the defaults for a
-- plain CREATE ROLE, but stating them means an existing role that was granted
-- more at some point gets pared back by a re-run instead of keeping it.
ALTER ROLE zuptech_ro NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;

-- Every session this role opens is read-only at the transaction level, on top
-- of the grants below. Two independent mechanisms, because the grants only
-- cover objects that existed when they were run — this one covers everything,
-- including anything a migration adds later and forgets to REVOKE.
ALTER ROLE zuptech_ro SET default_transaction_read_only = on;

-- Slow queries from a laptop must not sit on locks the live app needs.
ALTER ROLE zuptech_ro SET statement_timeout = '30s';
ALTER ROLE zuptech_ro SET idle_in_transaction_session_timeout = '60s';

GRANT CONNECT ON DATABASE zuptech TO zuptech_ro;
GRANT USAGE ON SCHEMA public TO zuptech_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO zuptech_ro;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO zuptech_ro;

-- Tables created by a future migration. `FOR ROLE zuptech` because the app's
-- own role owns them — default privileges attach to the CREATING role, so
-- omitting this silently applies to the superuser running this file and covers
-- nothing that Prisma actually creates.
ALTER DEFAULT PRIVILEGES FOR ROLE zuptech IN SCHEMA public
  GRANT SELECT ON TABLES TO zuptech_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE zuptech IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO zuptech_ro;

-- Nothing outside `public` should be reachable, and PUBLIC's implicit CREATE on
-- it is revoked so the role cannot make objects of its own.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Report what was granted, so the operator running this sees a result rather
-- than assuming silence meant success.
SELECT
  'zuptech_ro' AS role,
  (SELECT count(*) FROM information_schema.table_privileges
    WHERE grantee = 'zuptech_ro' AND privilege_type = 'SELECT') AS tables_readable,
  (SELECT rolconfig FROM pg_roles WHERE rolname = 'zuptech_ro') AS session_defaults;
