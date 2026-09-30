-- One-time database setup. Run as the postgres superuser on the server, passing a strong password:
--
--   sudo -u postgres psql -v app_password="$(openssl rand -base64 32 | tr -d '/+=\n')" -f ops/postgres/setup.sql
--
-- (Print the password before you run this, or set it afterwards with ALTER ROLE, and put it in /etc/fuzzball/api.env and
-- the MIGRATE_DATABASE_URL GitHub secret.) The app role owns its database and nothing else: it is not a superuser and
-- cannot create roles or other databases, so a stolen app credential cannot reach beyond this one database.
\set ON_ERROR_STOP on

SELECT format('CREATE ROLE fuzzball LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fuzzball') \gexec

SELECT 'CREATE DATABASE fuzzball OWNER fuzzball ENCODING ''UTF8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'fuzzball') \gexec

REVOKE ALL ON DATABASE fuzzball FROM PUBLIC;
GRANT CONNECT ON DATABASE fuzzball TO fuzzball;
