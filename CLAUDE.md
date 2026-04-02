# Shuttlecock Tracker — Claude Code Guide

## Project Overview

A multi-tenant badminton inventory management SaaS built with Next.js 15 + Supabase.
Live at: https://shuttlecock-tracker.vercel.app/

Core features: inventory tracking, pickup registration, FIFO cost settlement, group management, event/club record tracking (開團紀錄).

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
  api/
    clubs/               # Club CRUD + PIN verify
      [id]/
        verify-pin/      # POST: PIN verification
    events/              # Event CRUD + shuttle cost FIFO
      [id]/
        attendees/       # Attendee CRUD
          [aid]/
        shuttle-cost/    # POST: FIFO cost calculation
  clubs/
    page.tsx             # Club list (full page, admin table style)
    [id]/page.tsx        # Club detail — events list + PIN gate
  actions/               # Server Actions (auth logging)
  login/                 # Login / sign-up page
  page.tsx               # Home (Server Component — fetches data server-side)
  client-wrapper.tsx     # Dynamic import wrapper (ssr: false)
  home-interactive.tsx   # Client-side interactions + InventoryManagerDialog
components/
  ui/                    # Shadcn base components + Toast system
  event-detail-dialog.tsx  # Event detail: attendees, FIFO calculator, settlement
  event-tracker-dialog.tsx # Header button → link to /clubs
  *.tsx                  # Other feature components (pickup, restock, settlement, etc.)
lib/
  supabase/
    client.ts    # Browser Supabase client
    server.ts    # Server Supabase client (cookie-based)
    helpers.ts   # Shared getGroupId() utility
  crypto.ts      # PBKDF2 PIN hashing (Web Crypto API, no extra packages)
  utils.ts       # cn() Tailwind merge
middleware.ts    # Auth guard — protects / and /clubs/* routes
supabase/
  migrations/    # Supabase CLI migration files (switched from single-file plan)
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

## Database Migration Strategy

This project switched to **Supabase CLI migrations** (`supabase/migrations/`).

### How to apply a new migration

```bash
supabase migration new <description>   # creates timestamped .sql file
# edit the file, then:
supabase db push                        # push to linked project
```

### Migration files

| File | Description |
|------|-------------|
| `20260401070700_remote_schema.sql` | Baseline remote schema snapshot |
| `20260401071611_add_club_event_tables.sql` | clubs, badminton_events, event_attendees tables + RLS + indexes |

### Legacy applied migrations (pre-CLI, via SQL Editor)

| Date       | Description                                      |
|------------|--------------------------------------------------|
| (initial)  | Multi-tenant schema, groups, profiles, RLS       |
| (phase 2)  | shuttlecock_types, restock_records, inventory_summary view |
| (phase 3)  | is_active column on shuttlecock_types            |
| 2026-03-30 | `insert_pickup_record` RPC function (TOCTOU fix) |
| 2026-03-30 | 效能索引：pickup/restock/shuttlecock_types 常用查詢欄位 |

## 開團紀錄模組（Club Event Tracker）

### Architecture
- One group can have multiple clubs (球團); each club is PIN-protected
- PIN uses the same PBKDF2 hashing as restock PIN (`lib/crypto.ts`)
- PIN verification state stored in `sessionStorage` (`club_verified_<id>`) — cleared on tab close

### Data model
```
groups → clubs → badminton_events → event_attendees
```

### Key behaviors
- **Attendee order**: preserved from LINE message → sequential `for...of` insert → API sorts by `created_at ASC`
- **Shuttle cost**: always set to manual/0 on create; configure in event detail via FIFO calculator or manual input
- **FIFO unit conversion**: inventory uses 桶 (tubes); UI shows 顆 (pieces); `PIECES_PER_TUBE = 12`
- **Profit colors**: Taiwan stock market convention — positive = red, negative = green
- **Settlement**: once `is_settled=true`, event cannot be deleted (403)

### LINE message parser (frontend only)
- Regex extracts player names, fees from LINE group messages
- Handles formats: `1. Name $fee`, `免費` keyword → `isFree=true`
- Located in `app/clubs/[id]/page.tsx` (inline in CreateEventDialog)

### FIFO calculator
- Located in `components/event-detail-dialog.tsx` (FifoCalculator component)
- Calls `POST /api/events/[id]/shuttle-cost` with quantity in 桶
- Shows breakdown: `X 顆 ÷ 12 = Y.YY 桶` and per-piece cost

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # Used only in DELETE /api/group (admin operations)
NEXT_PUBLIC_SITE_URL=...
```
