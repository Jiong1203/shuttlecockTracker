# Shuttlecock Tracker — Claude Code Guide

## Project Overview

A multi-tenant badminton inventory management SaaS built with Next.js 15 + Supabase.
Live at: https://shuttlecock-tracker.vercel.app/

Core features: inventory tracking, pickup registration, FIFO cost settlement, group management.

## Tech Stack

- **Framework**: Next.js 15.1 (App Router, TypeScript)
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Styling**: Tailwind CSS 4 + Shadcn UI (Radix)
- **Deployment**: Vercel

## Commands

```bash
npm run dev     # Start dev server
npm run build   # Production build
npm run lint    # ESLint
```

## Project Structure

```
app/
  api/           # Route handlers (all protected via Supabase Auth)
  actions/       # Server Actions (auth logging)
  login/         # Login / sign-up page
  page.tsx        # Home (Server Component — fetches data server-side)
  client-wrapper.tsx   # Dynamic import wrapper (ssr: false)
  home-interactive.tsx # Client-side interactions + InventoryManagerDialog
components/
  ui/            # Shadcn base components + Toast system
  *.tsx          # Feature components (pickup, restock, settlement, etc.)
lib/
  supabase/
    client.ts    # Browser Supabase client
    server.ts    # Server Supabase client (cookie-based)
    helpers.ts   # Shared getGroupId() utility
  crypto.ts      # PBKDF2 PIN hashing (Web Crypto API, no extra packages)
  utils.ts       # cn() Tailwind merge
middleware.ts    # Auth guard — redirects unauthenticated users to /login
```

## Key Conventions

### Authentication
- Accounts use a fake domain: `{account}@shuttletracker.com`
- `middleware.ts` protects `/`; all API routes validate with `supabase.auth.getUser()`
- Use `getGroupId(supabase)` from `lib/supabase/helpers.ts` in every API route

### Password / PIN Hashing
- Restock PIN is hashed with PBKDF2 (100k iterations, SHA-256) via `lib/crypto.ts`
- `hashPin(pin)` → stores as `pbkdf2:<saltHex>:<hashHex>`
- `verifyPin(pin, stored)` → handles: null (default '1111'), `pbkdf2:...` (new), plain text (legacy)
- Legacy plain-text PINs remain valid until the user changes the password

### API Route Patterns
- All routes call `getGroupId(supabase)` first; return 401 if null
- Mutation routes use `export const dynamic = "force-dynamic"`
- Read routes use `export const revalidate = 30`
- Error messages are in Chinese (Traditional)

### Atomic Pickup
- POST `/api/pickup` uses `supabase.rpc('insert_pickup_record', ...)` to prevent TOCTOU race conditions
- The DB function uses `SELECT ... FOR UPDATE` to lock the shuttlecock_type row

### Toast Notifications
- Use `showToast(message, type)` from `@/components/ui/toast`
- `ToastContainer` must be mounted in the page (already in `home-interactive.tsx` and `login/page.tsx`)
- Do NOT use `alert()` — inconsistent UX

## Database Migration Strategy (Plan A)

This project uses a **single cumulative SQL file** (`supabase-migration.sql`) instead of Supabase CLI migrations.

### How to apply a new migration

1. Append the SQL to the bottom of `supabase-migration.sql` with a clear header:

```sql
-- ==========================================
-- Migration: YYYY-MM-DD <short description>
-- ==========================================
<your SQL here>
```

2. Copy **only the new block** and run it in **Supabase Dashboard → SQL Editor**.
   Do NOT re-run the entire file (it will break existing data).

3. Commit `supabase-migration.sql` to git as a record.

### Applied migrations log

| Date       | Description                                      |
|------------|--------------------------------------------------|
| (initial)  | Multi-tenant schema, groups, profiles, RLS       |
| (phase 2)  | shuttlecock_types, restock_records, inventory_summary view |
| (phase 3)  | is_active column on shuttlecock_types            |
| 2026-03-30 | `insert_pickup_record` RPC function (TOCTOU fix) |
| 2026-03-30 | 效能索引：pickup/restock/shuttlecock_types 常用查詢欄位 |

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # Used only in DELETE /api/group (admin operations)
NEXT_PUBLIC_SITE_URL=...
```
