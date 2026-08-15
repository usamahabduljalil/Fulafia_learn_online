# Deployment and Operations

## 1. Supabase database

Apply all migrations in order:

```sh
supabase db push
supabase test db
```

The completion migration is additive and preserves existing tables. It changes both storage buckets to private, adds lifecycle fields, and replaces permissive policies. Existing legacy `file_url` records remain readable; newly uploaded files use `storage_path` and signed URLs.

Create the first teacher invitation in the SQL editor and share the plaintext code out of band:

```sql
insert into public.teacher_invites (code_hash, expires_at)
values (digest(lower(trim('CHANGE-ME-ONCE')), 'sha256'), now() + interval '7 days');
```

## 2. LiveKit Cloud

Create a LiveKit Cloud project and configure these Supabase Function secrets:

```sh
supabase secrets set LIVEKIT_URL=wss://YOUR-PROJECT.livekit.cloud
supabase secrets set LIVEKIT_API_KEY=YOUR_KEY
supabase secrets set LIVEKIT_API_SECRET=YOUR_SECRET
```

Room tokens are issued only by `livekit-token`; never expose the API secret in a Vite environment variable.

## 3. Biometric and cleanup secrets

Generate a 32-byte encryption key and a separate cron secret:

```sh
openssl rand -base64 32
openssl rand -hex 32
supabase secrets set BIOMETRIC_ENCRYPTION_KEY=YOUR_GENERATED_BASE64_KEY
supabase secrets set CRON_SECRET=YOUR_GENERATED_HEX_SECRET
```

Losing the encryption key makes existing descriptors unrecoverable. Keep it in the project secret manager and rotate it only with a descriptor re-enrollment migration.

Schedule a daily POST to `/functions/v1/purge-expired-metrics` with `x-cron-secret`; the function removes raw engagement samples older than 30 days while retaining session summaries.

## 4. Deploy Edge Functions

```sh
supabase functions deploy livekit-token
supabase functions deploy biometric-template
supabase functions deploy ingest-engagement
supabase functions deploy finalize-session-report
supabase functions deploy purge-expired-metrics
```

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions. All public-facing functions still validate the caller's bearer token internally.

## 5. Browser AI assets and policy

The initial release loads signed model artifacts from the official MediaPipe storage and face-api.js GitHub weight bundle. For a locked-down production Content Security Policy, mirror those immutable assets under the app's `/public/models` directory and update `src/lib/faceEngine.ts`.

Primary support is current Chrome and Edge on desktop. Devices without WebGPU fall back to WASM/VAD participation measurement. No session recording is enabled.

## 6. Acceptance checks

- Run database migrations and RLS tests against a disposable Supabase branch.
- Seed one teacher and two student test accounts.
- Confirm teacher invite redemption, all three class access modes, and rejection paths.
- Join one LiveKit room from three separate Chromium contexts and verify remote media, screen share, chat, rejoin attendance, and end-session report generation.
- Confirm private resource/submission URLs expire and unauthorized accounts receive 403/empty results.
- Inspect network traffic to verify webcam frames, microphone audio, and transcript text never leave the browser.
