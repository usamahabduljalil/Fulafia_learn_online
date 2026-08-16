# FULAFIA Online Class

A teacher/student virtual classroom built with React, Supabase, LiveKit Cloud, MediaPipe, face-api.js, and Transformers.js.

## Included capabilities

- Role-protected teacher and student workspaces with invite-only teacher activation
- Public, invite-code, and approval-based class enrollment
- Class, session, resource, assignment, submission, grading, and reporting workflows
- LiveKit multi-participant video, audio, screen sharing, device controls, and reconnection
- Persistent Supabase Realtime chat, attendance intervals, and teacher intervention alerts
- Local face enrollment, liveness checks, session-entry matching, and encrypted descriptor storage
- Observable engagement signals and ephemeral local Whisper participation statistics
- Named session analytics with PDF and CSV exports
- Private storage objects with short-lived signed download links

Raw webcam frames, audio, and transcript text are not stored or sent to Supabase. Engagement measurements are advisory signals and must not be used as automatic disciplinary decisions.

## Local development

1. Copy `.env.example` to `.env.local` and provide the public Supabase values.
2. Install dependencies with `pnpm install` or `npm install`.
3. Start the app with `pnpm dev`.
4. Run `pnpm test`, `pnpm lint`, and `pnpm build` before publishing.

The complete backend and LiveKit setup is documented in [DEPLOYMENT.md](./DEPLOYMENT.md).
