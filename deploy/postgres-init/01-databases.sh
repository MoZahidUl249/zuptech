#!/bin/bash
# Runs once, on an EMPTY pgdata volume only.
set -e

# --dbname is not optional here. Without it psql falls back to a database
# named after the connecting user, and POSTGRES_USER is `unused` in
# .env.production.local — a deliberate placeholder, because the live stack
# points at a provider-managed database and never uses these credentials. On a
# rehearsal, which DOES run this `db` service, that made every run die with
#   psql: FATAL: database "unused" does not exist
# and then fail later, confusingly, as "password authentication failed for
# user zuptech" — because the role the script should have created never was.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${POSTGRES_DB:-postgres}" <<-SQL
  CREATE USER zuptech WITH PASSWORD '${ZUPTECH_DB_PASSWORD}';
  CREATE DATABASE zuptech OWNER zuptech;
SQL
