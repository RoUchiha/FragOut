-- Runtime identity is read-only to application and backup roles.
CREATE TABLE fragout.deployment_identity (
  id integer PRIMARY KEY CHECK (id = 1),
  environment text NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  instance_id text NOT NULL UNIQUE
);
INSERT INTO fragout.deployment_identity VALUES (1, 'production', gen_random_uuid()::text);
REVOKE ALL ON fragout.deployment_identity FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON fragout.deployment_identity TO fragout_app;
ALTER TABLE fragout.deployment_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_identity_read ON fragout.deployment_identity FOR SELECT TO fragout_app USING (true);

-- The backup/refresh process cannot write production, administer roles or decrypt
-- archived images and provider keys. Its credentials never enter the test runtime.
CREATE ROLE fragout_backup_reader NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA fragout TO fragout_backup_reader;
ALTER ROLE fragout_backup_reader IN DATABASE postgres SET search_path TO fragout, pg_catalog;
ALTER ROLE fragout_backup_reader IN DATABASE postgres SET default_transaction_read_only TO on;
ALTER ROLE fragout_backup_reader IN DATABASE postgres SET statement_timeout TO '25s';
ALTER ROLE fragout_backup_reader IN DATABASE postgres SET lock_timeout TO '5s';

DO $reader$
DECLARE relation text;
BEGIN
  FOREACH relation IN ARRAY ARRAY[
    'schema_migrations', 'deployment_identity', 'users', 'bottles', 'settings',
    'archive_consents', 'wear_events', 'saved_looks', 'private_photos',
    'ai_credentials', 'ai_preferences', 'catalog_admins', 'catalog_photos'
  ] LOOP
    EXECUTE format('GRANT SELECT ON fragout.%I TO fragout_backup_reader', relation);
    EXECUTE format('CREATE POLICY backup_reader ON fragout.%I FOR SELECT TO fragout_backup_reader USING (true)', relation);
  END LOOP;
END;
$reader$;
INSERT INTO fragout.schema_migrations(version, applied_at) VALUES (2, CURRENT_TIMESTAMP::text);
