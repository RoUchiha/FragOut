# FragOut cloud setup

The FragOut API uses a private Postgres schema for accounts, sessions, collections, recommendations, journal entries, encrypted photos and provider keys, and FragDex photo overrides. The bundled fragrance catalog is served with the app. Android, iOS, and the browser use the same HTTPS API and existing sign-in flow.

## Supabase

A new Supabase installation uses the SQL in [supabase/migrations](../supabase/migrations). Apply it as the database owner. Give the dedicated `fragout_app` role a strong password through your database administration client and enable login for the role. With `psql`, `\password fragout_app` prompts for the password. Then run `ALTER ROLE fragout_app LOGIN;`. The FragOut runtime role can read and write app records. Catalog admin grants and migrations require database-owner access.

Use **Session pooler** under **Connect** in the Supabase dashboard. The FragOut API keeps a small connection pool for its long-lived Node server. Replace the username with `fragout_app.<project-ref>`. Set the server environment variables below.

| Variable | Value |
| --- | --- |
| `FRAGOUT_DATABASE_URL` | The session pooler connection string for `fragout_app` on port `5432`. URL-encode the password if it contains reserved characters. |
| `FRAGOUT_VAULT_KEY` | A stable 32-byte key encoded as base64. Keep the same key across deploys so existing encrypted photos and provider keys stay readable. |
| `FRAGOUT_PUBLIC_ORIGIN` | The exact HTTPS origin for the FragOut API. Render supplies its own origin when this is unset. |
| `FRAGOUT_PRIVACY_CONTACT_EMAIL` | Your contact for the public privacy policy. |

Store the database URL and vault key as server secrets. FragOut checks the pooler's certificate against Supabase's CA and verifies the hostname. The schema is private and inaccessible to the public Data API roles. The scheduled cleanup removes expired sessions, staging photos, outfit analyses, and other temporary records. A cloud deployment starts with its own accounts. Existing SQLite accounts and collections stay on the local installation.

To check connectivity with an existing private environment file, run this from the repository root.

```sh
node --env-file=/secure/fragout.env --experimental-strip-types scripts/start-cloud.mjs --check
```

Supabase Free includes 500 MB per project and can pause a project after a week of low activity. Encrypted photo archives count toward that database limit. Store database backups and the vault key securely before relying on the service for production data. [Supabase Free plan](https://supabase.com/pricing) · [Supabase TLS](https://supabase.com/docs/guides/platform/ssl-enforcement)

## HTTPS preview

On Render, create a Blueprint from the FragOut repository. The Blueprint defines a Free Node web service in Ohio. Enter the database URL, the same vault key, and your privacy contact in Render's environment prompts. When it deploys, open the service's `/api/health` and `/mobile` routes. Use the service's HTTPS URL as `EXPO_PUBLIC_API_URL` for a native build. [Blueprint file](../render.yaml) · [Render Blueprints](https://render.com/docs/infrastructure-as-code)

Render's free service sleeps after 15 minutes without traffic and is intended for previews. Its startup command requires the managed database. For a production host with Node 24, use the same build commands and `npm run start:cloud` behind the host's HTTPS proxy. The free Qwen model requires Ollama running alongside the API. Users can connect their own OpenAI or Claude keys from Settings for cloud analysis. [Render free hosting limits](https://render.com/docs/free)

For local development, `npm start` serves the loopback preview and uses SQLite when `FRAGOUT_DATABASE_URL` is unset.

## FragDex admin access

Create a regular account through the hosted app. As the database owner, grant catalog editing to that account by replacing the example email below. The account can then open **FragDex photos** in Settings.

```sql
INSERT INTO fragout.catalog_admins(user_id)
SELECT id FROM fragout.users WHERE email = lower('owner@example.com') AND demo = 0
ON CONFLICT DO NOTHING;
```
