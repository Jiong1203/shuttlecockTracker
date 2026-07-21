# Shuttlecock Tracker — Claude Code Guide

## Project Overview

A multi-tenant badminton inventory management SaaS built with Next.js 15 + Supabase.
Live at: https://shuttlecock-tracker.vercel.app/

Core features: inventory tracking, pickup registration, FIFO cost settlement, group management, event/club record tracking (開團紀錄), low-stock email alerts (低庫存通知).

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

## Commit Message Convention

本專案 commit message **一律使用繁體中文（zh-tw）**，無需每次再指定語言關鍵字。

- 遵循 **Conventional Commits**：`<type>` 使用英文 keyword（`feat` / `fix` / `refactor` / `chore` / `docs` / `style` / `test` / `perf`），`<subject_line>`、`原因`、`調整項目` 一律繁體中文。
- **不要**加入 `Co-authored-by` trailer 或任何 AI 簽名。
- 格式範本：

  ```
  <type>: <subject_line>

  原因：
  1. [原因 1]
  2. [原因 2]

  調整項目：
  1. [檔案或元件]：[變更內容]
  2. [檔案或元件]：[變更內容]
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
    cron/
      low-stock-alert/   # GET: daily Vercel Cron — scans all groups, emails low-stock alerts
  clubs/
    page.tsx             # Club list (full page, admin table style)
    [id]/page.tsx        # Club detail — events list + PIN gate
  actions/               # Server Actions (auth logging)
  login/                 # Login / sign-up page
  page.tsx               # Home (Server Component — fetches data server-side)
  client-wrapper.tsx     # 'use client' boundary; dynamic()-imports interactive parts by `variant`
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
  email.ts       # Nodemailer + Gmail SMTP sender + low-stock email template
  utils.ts       # cn() Tailwind merge
middleware.ts    # Auth guard — protects / and /clubs/* routes
supabase/
  migrations/    # Supabase CLI migration files (switched from single-file plan)
docs/
  user-manual.md             # In-app user manual (rendered via react-markdown in the Home toolbar)
  PERFORMANCE_OPTIMIZATION.md # Perf notes
  PRD-venue-session-module.md # Product spec
```

### Home page data flow (Server → Client split)
- `app/page.tsx` is a **Server Component**: it reads the session from cookies (`getSession()`, no extra network round-trip since middleware already validated), fetches `inventory_summary` + `pickup_records` in parallel, and passes them down as props.
- `client-wrapper.tsx` is the `'use client'` boundary. It renders different interactive trees by `variant`: `"header"` → `HomeHeaderControls` (toolbar buttons), `"content"` → `HomeInteractive` (+ `WelcomeGuide` when `totalCurrentStock === 0`). Interactive children are `dynamic()`-imported and wrapped in `<Suspense>` with skeleton fallbacks.

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

### Settlement FIFO Calculation (`/api/settlement/calculate`)
- **Replays ALL pickups from the beginning**, not just those in the queried period. This is required to know *which restock batch* each pickup consumed; only pickups inside the period accumulate into the returned cost. Do not "optimize" by filtering pickups before the FIFO replay — it breaks batch attribution.
- **End-date boundary gotcha** (the v1.4 bug): `end_date` is parsed at UTC 00:00, so a naive `<= end_date` excludes that whole day. The fix is `created_at < (end_date + 1 day)` — strict less-than against the next day. Preserve this when touching date filters.
- Computed entirely in the route (TypeScript), not in SQL.

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
| `20260408000000_add_pickup_date_param.sql` | Adds `p_pickup_date` param to `insert_pickup_record` RPC (allows backdating a pickup; defaults to `NOW()`) |
| `20260721000000_add_low_stock_threshold.sql` | Adds `low_stock_threshold` (default 5) to `shuttlecock_types`, exposes it in `inventory_summary` view, adds `low_stock_alerts` dedup table (for low-stock email module) |

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
- One group can have multiple clubs (球隊); each club is PIN-protected
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

## 低庫存 Email 通知模組（Low-Stock Alert）

### Architecture
- Daily **Vercel Cron** (`vercel.json` → `crons`, `0 1 * * *` = **09:00 台北 / 01:00 UTC**) hits `GET /api/cron/low-stock-alert`.
- The route is **not** user-authenticated (no cookie in cron context). It validates `Authorization: Bearer <CRON_SECRET>` and uses a **service role client** to scan `inventory_summary` across all groups (bypasses RLS). Do NOT use `getGroupId()` here.
- Email delivery: `lib/email.ts` — Nodemailer over Gmail SMTP (`smtp.gmail.com:465`, dedicated bot account). App Password spaces are stripped before auth.

### Threshold
- Per-type column `shuttlecock_types.low_stock_threshold` (int, default 5). Exposed via `inventory_summary` view — the view MUST carry this column or the cron can't read it.
- Editable in `components/shuttlecock-type-manager.tsx` (per-card control) via `PATCH /api/inventory/types` with `{ low_stock_threshold }`. This update path is **independent of** the system-type brand/name edit gating — any type's threshold is editable.

### Dedup (avoid daily re-spam)
- `low_stock_alerts` table (PK = `shuttlecock_type_id`) records "already notified".
- Each run: items now below threshold but **not** in the table → email + insert; items in the table that **recovered** (stock ≥ threshold) → deleted, so a future dip re-notifies. Already-alerted-still-low items are skipped.
- A row is inserted **only after** a successful send. Groups with null `contact_email` are skipped (no row), so they get notified once they set an email. Preserve this "send-then-record" ordering.

### Recipient
- Sent to `groups.contact_email` (often null on legacy accounts). Null → skipped silently. `group-settings-dialog.tsx` prompts users to fill a real inbox.

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # DELETE /api/group + low-stock cron (scans all groups, bypasses RLS)
NEXT_PUBLIC_SITE_URL=...
GMAIL_USER=...                  # Dedicated Gmail for low-stock alerts (shuttlecock.tracker.bot@gmail.com)
GMAIL_APP_PASSWORD=...          # Gmail App Password (NOT login password); spaces are stripped before use
CRON_SECRET=...                 # Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"; route rejects otherwise
```
