#!/bin/bash
# Runs once, on an EMPTY pgdata volume only.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-SQL
  CREATE USER zuptech WITH PASSWORD '${ZUPTECH_DB_PASSWORD}';
  CREATE DATABASE zuptech OWNER zuptech;
SQL
