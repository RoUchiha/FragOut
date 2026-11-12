-- Set the runtime role's login separately from the schema migration.
CREATE ROLE fragout_app NOLOGIN;
CREATE SCHEMA fragout;

REVOKE ALL ON SCHEMA fragout FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA fragout TO fragout_app;
ALTER ROLE fragout_app IN DATABASE postgres SET search_path TO fragout, pg_catalog;
ALTER ROLE fragout_app IN DATABASE postgres SET statement_timeout TO '20s';
ALTER ROLE fragout_app IN DATABASE postgres SET lock_timeout TO '5s';

CREATE TABLE fragout.schema_migrations (
  version integer PRIMARY KEY,
  applied_at text NOT NULL
);
CREATE TABLE fragout.users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE,
  password text,
  demo integer NOT NULL DEFAULT 0 CHECK (demo IN (0, 1)),
  created bigint NOT NULL
);
CREATE TABLE fragout.sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES fragout.users(id) ON DELETE CASCADE,
  expires bigint NOT NULL
);
CREATE TABLE fragout.bottles (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES fragout.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  sort_order bigint GENERATED ALWAYS AS IDENTITY
);
CREATE TABLE fragout.settings (
  user_id text PRIMARY KEY REFERENCES fragout.users(id) ON DELETE CASCADE,
  body text NOT NULL
);
CREATE TABLE fragout.archive_consents (
  user_id text PRIMARY KEY REFERENCES fragout.users(id) ON DELETE CASCADE,
  epoch integer NOT NULL DEFAULT 0
);
CREATE TABLE fragout.wear_events (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES fragout.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created bigint NOT NULL,
  sort_order bigint GENERATED ALWAYS AS IDENTITY
);
CREATE TABLE fragout.recommendation_runs (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES fragout.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created bigint NOT NULL
);
CREATE TABLE fragout.outfit_analyses (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES fragout.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created bigint NOT NULL
);
CREATE TABLE fragout.saved_looks (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES fragout.users(id) ON DELETE CASCADE,
  analysis_id text NOT NULL,
  body text NOT NULL,
  created bigint NOT NULL,
  UNIQUE (user_id, analysis_id),
  UNIQUE (user_id, id)
);
CREATE TABLE fragout.private_photos (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES fragout.users(id) ON DELETE CASCADE,
  analysis_id text NOT NULL,
  look_id text,
  sealed bytea NOT NULL,
  expires bigint,
  UNIQUE (user_id, analysis_id),
  FOREIGN KEY (user_id, look_id) REFERENCES fragout.saved_looks(user_id, id) ON DELETE CASCADE,
  CHECK ((look_id IS NULL AND expires IS NOT NULL) OR (look_id IS NOT NULL AND expires IS NULL))
);
CREATE TABLE fragout.rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  expires bigint NOT NULL
);
CREATE TABLE fragout.ai_credentials (
  user_id text NOT NULL REFERENCES fragout.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text NOT NULL,
  sealed text NOT NULL,
  PRIMARY KEY (user_id, provider)
);
CREATE TABLE fragout.ai_preferences (
  user_id text PRIMARY KEY REFERENCES fragout.users(id) ON DELETE CASCADE,
  selected text NOT NULL
);
CREATE TABLE fragout.catalog_admins (
  user_id text PRIMARY KEY REFERENCES fragout.users(id) ON DELETE CASCADE
);
CREATE TABLE fragout.catalog_photos (
  edition_id text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('automatic', 'override')),
  image_hash text,
  bytes bytea,
  source_url text,
  publisher text,
  updated_at bigint NOT NULL,
  PRIMARY KEY (edition_id, mode),
  CHECK ((image_hash IS NULL) = (bytes IS NULL))
);
CREATE TABLE fragout.catalog_photo_attempts (
  edition_id text PRIMARY KEY,
  retry_at bigint NOT NULL,
  lease_until bigint NOT NULL
);

CREATE INDEX users_demo_expiry ON fragout.users(created) WHERE demo = 1;
CREATE INDEX sessions_owner ON fragout.sessions(user_id);
CREATE INDEX sessions_expiry ON fragout.sessions(expires);
CREATE INDEX bottles_owner_order ON fragout.bottles(user_id, sort_order);
CREATE INDEX wear_events_owner_order ON fragout.wear_events(user_id, created DESC, sort_order DESC);
CREATE INDEX recommendations_owner ON fragout.recommendation_runs(user_id);
CREATE INDEX recommendations_expiry ON fragout.recommendation_runs(created);
CREATE INDEX recommendations_with_outfit ON fragout.recommendation_runs(created) WHERE body::jsonb ? 'outfit';
CREATE INDEX outfit_analyses_owner ON fragout.outfit_analyses(user_id);
CREATE INDEX outfit_analyses_expiry ON fragout.outfit_analyses(created);
CREATE INDEX saved_looks_owner_order ON fragout.saved_looks(user_id, created DESC);
CREATE INDEX private_photos_look ON fragout.private_photos(user_id, look_id) WHERE look_id IS NOT NULL;
CREATE INDEX private_photos_expiry ON fragout.private_photos(expires) WHERE expires IS NOT NULL;
CREATE INDEX rate_limits_expiry ON fragout.rate_limits(expires);
CREATE INDEX catalog_photo_hash ON fragout.catalog_photos(image_hash);

INSERT INTO fragout.schema_migrations(version, applied_at) VALUES (1, CURRENT_TIMESTAMP::text);

REVOKE ALL ON ALL TABLES IN SCHEMA fragout FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA fragout FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA fragout REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA fragout REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON fragout.schema_migrations, fragout.catalog_admins TO fragout_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  fragout.users, fragout.sessions, fragout.bottles, fragout.settings,
  fragout.archive_consents, fragout.wear_events, fragout.recommendation_runs,
  fragout.outfit_analyses, fragout.saved_looks, fragout.private_photos,
  fragout.rate_limits, fragout.ai_credentials, fragout.ai_preferences,
  fragout.catalog_photos, fragout.catalog_photo_attempts
TO fragout_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA fragout TO fragout_app;

DO $policies$
DECLARE relation text;
BEGIN
  FOR relation IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'fragout' LOOP
    EXECUTE format('ALTER TABLE fragout.%I ENABLE ROW LEVEL SECURITY', relation);
    EXECUTE format(
      'CREATE POLICY server_access ON fragout.%I TO fragout_app USING (true) WITH CHECK (true)',
      relation
    );
  END LOOP;
END;
$policies$;

CREATE FUNCTION fragout.prune_expired() RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $prune$
DECLARE now_ms bigint := floor(extract(epoch FROM clock_timestamp()) * 1000);
BEGIN
  DELETE FROM fragout.users WHERE demo = 1 AND created <= now_ms - 604800000;
  DELETE FROM fragout.sessions WHERE expires <= now_ms;
  DELETE FROM fragout.rate_limits WHERE expires <= now_ms;
  DELETE FROM fragout.private_photos WHERE expires <= now_ms;
  DELETE FROM fragout.recommendation_runs WHERE created <= now_ms - 86400000;

  UPDATE fragout.recommendation_runs AS run
  SET body = (run.body::jsonb - 'outfit')::text
  WHERE run.body::jsonb ? 'outfit'
    AND NOT EXISTS (
      SELECT 1 FROM fragout.outfit_analyses AS analysis
      WHERE analysis.id = run.body::jsonb #>> '{outfit,analysisId}'
        AND analysis.user_id = run.user_id
        AND analysis.created > now_ms - 900000
    );
  DELETE FROM fragout.outfit_analyses WHERE created <= now_ms - 900000;
END;
$prune$;
REVOKE ALL ON FUNCTION fragout.prune_expired() FROM PUBLIC, anon, authenticated, service_role, fragout_app;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.schedule('fragout-expiry', '* * * * *', 'SELECT fragout.prune_expired()');
