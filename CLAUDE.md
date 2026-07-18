# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Marié (마리에) — a Korean-language jobs, profile, and community platform for the wedding industry (venues, dress shops, studios, makeup shops, planners, assistants).

## Tech Stack

- **Next.js 14** with App Router, TypeScript, Tailwind CSS
- **Supabase** for auth, database (PostgreSQL), and storage
- **Docker + Nginx** for production deployment

## Commands

```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint (next/core-web-vitals + next/typescript)
npm start        # Start production server
```

## Deployment — zero-downtime blue/green

**Never run `docker compose up -d --build` for this app.** Colors are behind compose
profiles so it starts no app at all, and it races the auto-deploy hook (that's what
caused the recurring container-name conflicts).

- **Automatic**: push to `main`. The server's auto-deployer hook runs `webhook-deploy.sh`.
- **Manual**: `ssh deploy "cd /home/server/apps/marie-wedding && bash webhook-deploy.sh"`

`webhook-deploy.sh` builds the idle color, waits for `/api/health`, validates the nginx
config, swaps `nginx/upstream.inc`, reloads nginx, drains, then removes the old color.
Any failure aborts **without swapping**, so the live color keeps serving.

Design and the traps found while building it:
[docs/superpowers/specs/2026-07-17-zero-downtime-deploy-design.md](docs/superpowers/specs/2026-07-17-zero-downtime-deploy-design.md)

Two things not to undo:
- `nginx/upstream.inc` is gitignored on purpose — it's the live-color state file. If git
  tracks it, a pull rewrites it and the deploy script kills the container that's serving.
- The old top-level `nginx.conf` was deleted on purpose. It set `X-Real-IP` to the docker
  gateway IP (which would make admin/signup IP rate limits global — one user's failures
  would block everyone) and capped bodies at 10M (10MB resume PDFs would 413).

**Never `scp`/edit a git-tracked file directly on the server for a hotfix.** The
auto-deployer runs `git pull`; a locally-modified tracked file makes every future pull
abort with "local changes would be overwritten", so pushes silently keep rebuilding the
OLD code while the tree stays pinned to an old commit. (This bit us once via a scp'd
`nginx/default.conf`.) For a hotfix: commit + push and let the deploy carry it, or if you
must touch the server, `git reset --hard origin/main` afterward to unstick pulls.

Schema changes must be backward compatible: during a swap both versions run for a few
seconds. Adding a column is safe; renaming or dropping one breaks the old version.

## Architecture

### Supabase Configuration

- Custom schema: `marie_wedding` (configured in both `src/lib/supabase/client.ts` and `src/lib/supabase/server.ts`)
- Two Supabase client factories: `createClient()` from `@/lib/supabase/client` (browser) and `@/lib/supabase/server` (server components/actions)
- Signup uses an API route (`/api/auth/signup`) with `service_role` key to bypass RLS, then signs in client-side
- Kakao OAuth supported, callback handled at `/auth/callback`

### Route Groups

- `(auth)` — login/signup pages (public, redirects to `/jobs` if already authenticated)
- `(main)` — authenticated pages with shared Header/Footer layout. Contains: jobs, directory, community, events
- `admin` — admin panel (not inside a route group, currently public in middleware)

### Middleware

Root `middleware.ts` delegates to `src/lib/supabase/middleware.ts`. Unauthenticated users are redirected to `/login`. Public paths: `/`, `/admin/*`, `/auth/*`, `/onboarding`, `/api/*`. Authenticated users with `profiles.onboarded_at IS NULL` are forced to `/onboarding`.

### Social Login

3 providers supported: Kakao, Google (Supabase native), Naver (custom OAuth at `/auth/naver/*`). Setup guide: [docs/auth-social-login.md](docs/auth-social-login.md).
- New OAuth user flow: callback creates `profiles` row with `account_type=null, onboarded_at=null` → middleware forces `/onboarding` → 3-field form → `onboarded_at=NOW()` → redirect to original `next`.
- Naver state cookie: `__Host-naver_oauth_state` (HttpOnly+Secure+SameSite=Lax, 10min, single-use).

### Feature Modules (`src/features/`)

Each feature (auth, jobs, directory, community, admin) follows the pattern:
- `types.ts` — feature-specific types
- `components/` — React components
- `services/` — Supabase query functions (client-side)
- `hooks/` — React hooks (auth only)

Shared types are in `src/types/database.ts` (Profile, Job, Post, Comment). Domain constants (business types, regions, employment types, routes) are in `src/shared/constants.ts`.

### Auth Hook

`src/shared/hooks/useAuth.ts` — client-side hook providing user, profile, loading state, and signOut. Uses `getSession()` for fast local init + `onAuthStateChange` listener.

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` (default: http://localhost:3000)

Signup API route also needs `SUPABASE_SERVICE_ROLE_KEY` (server-only).
