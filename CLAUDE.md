# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Marié (마리에) — a B2B networking platform for the Korean wedding industry (venues, dress shops, studios, makeup shops, planners, assistants). Korean-language UI.

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
docker-compose up -d --build  # Docker deployment
```

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

Root `middleware.ts` delegates to `src/lib/supabase/middleware.ts`. Unauthenticated users are redirected to `/login`. Public paths: `/`, `/admin/*`, `/auth/callback`.

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
