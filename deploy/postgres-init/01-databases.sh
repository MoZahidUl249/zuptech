#!/bin/bash
# Runs once, on an EMPTY pgdata volume only. The backend and the media-storage
# service are separate services with separate schemas and separate migration
# histories, so they get separate databases and separate roles — one is not
# allowed to migrate over the other.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-SQL
  CREATE USER zuptech WITH PASSWORD '${ZUPTECH_DB_PASSWORD}';
  CREATE DATABASE zuptech OWNER zuptech;

  CREATE USER media_storage WITH PASSWORD '${MEDIA_DB_PASSWORD}';
  CREATE DATABASE media_storage OWNER media_storage;
SQL
