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
npm run dev        # Start dev server
npm run build      # Production build
npm run lint       # ESLint
npm test           # Vitest（單次執行）
npm run test:watch # Vitest（監看模式）
```

**測試涵蓋範圍**：`lib/` 下的純函式，共 65 項。集中在最容易算錯又難以肉眼檢查的地方——
FIFO 的台北時區日界、活動財務的應收／實收區分、LINE 訊息解析。
UI 與 API route 目前無測試。

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
  (app)/                 # Route group — shared admin shell (sidebar + topbar); URLs unchanged
    layout.tsx           # Server layout → fetches group, renders <AppShell>
    loading.tsx          # Route-transition loading UI (Suspense fallback)
    page.tsx             # Home dashboard (Server Component — fetches data server-side)
    client-wrapper.tsx   # 'use client' boundary; dynamic()-imports interactive parts by `variant`
    home-interactive.tsx # Client-side interactions + InventoryManagerDialog
    settings/
      page.tsx           # Account settings — standalone page (uses GroupSettingsForm)
    clubs/
      page.tsx           # Club list (full page, admin table style)
      [id]/page.tsx      # Club detail — events list + PIN gate
  actions/               # Server Actions (auth logging)
  login/                 # Login / sign-up page (outside (app) — no shell)
components/
  ui/                    # Shadcn base components + Toast system
  app-shell.tsx          # Admin shell: sidebar container + topbar (breadcrumb, collapse, mobile drawer)
  app-sidebar.tsx        # Fixed dark-green sidebar (nav + group name / settings / logout / theme)
  inventory-stats.tsx    # Home KPI summary row (4 stat cards)
  group-settings-form.tsx  # Account settings form — used by the /settings page
  event-detail-dialog.tsx  # Event detail: attendees, FIFO calculator, settlement
  *.tsx                  # Other feature components (pickup, restock, settlement, etc.)
lib/
  supabase/
    client.ts    # Browser Supabase client
    server.ts    # Server Supabase client (cookie-based)
    helpers.ts   # Shared getGroupId() utility
  crypto.ts      # PBKDF2 PIN hashing (Web Crypto API, no extra packages)
  email.ts       # Nodemailer + Gmail SMTP sender + low-stock email template
  line.ts        # LINE Messaging API push/reply + 訊息組版
  line-parser.ts # LINE 報名訊息解析（純函式，有測試）
  date-boundary.ts # 台北時區日界換算 — FIFO 與結算共用（有測試）
  event-finance.ts # 活動財務：應收／實收／未收與兩種利潤基準（有測試）
  event-stats.ts   # 活動彙總統計與月份分桶
  payment-reminder.ts # 催繳訊息草稿（有測試）
  csv.ts         # CSV 匯出，帶 BOM 供 Excel 開啟（有測試）
  format.ts      # 金額與損益顯示格式（台股慣例：正紅負綠）
  limits.ts      # 列表回傳上限，前後端共用
  utils.ts       # cn() Tailwind merge
middleware.ts    # Auth guard — protects / and /clubs/* routes
supabase/
  migrations/    # Supabase CLI migration files (switched from single-file plan)
docs/
  user-manual.md             # In-app user manual (rendered via react-markdown in the Home toolbar)
  PERFORMANCE_OPTIMIZATION.md # Perf notes
  PRD-venue-session-module.md # Product spec
```

### App shell (sidebar) & route group
- `app/(app)/layout.tsx` is a **Server Component** that fetches the current group (name + contact_email) and wraps all pages in `<AppShell>` (`components/app-shell.tsx`) — a fixed dark-green sidebar + topbar (breadcrumb, collapse, mobile drawer). `/`, `/settings`, `/clubs`, `/clubs/[id]` all live inside `(app)` and share this shell; `/login` and `/manual` stay outside it. The `(app)` group does **not** change URLs.
- Header controls (settings / logout / theme) live in `app-sidebar.tsx`; account settings is a standalone page at `/settings`, not a dialog. The old top toolbar (`HomeHeaderControls`, `group-settings-dialog.tsx`, `event-tracker-dialog.tsx`) was removed once the sidebar replaced it.

### Home page data flow (Server → Client split)
- `app/(app)/page.tsx` is a **Server Component**: it reads the session from cookies (`getSession()`, no extra network round-trip since middleware already validated), fetches `inventory_summary` + `pickup_records` (+ a scoped monthly-pickup query for the KPI row) in parallel, and passes them down as props. It renders `<InventoryStats>` (KPI row) above the inventory display.
- `client-wrapper.tsx` is the `'use client'` boundary. It renders different interactive trees by `variant`: `"content"` → `HomeInteractive` (+ `WelcomeGuide` when `totalCurrentStock === 0`). Interactive children are `dynamic()`-imported and wrapped in `<Suspense>` with skeleton fallbacks.

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

### Backdated Dates & FIFO Ordering (`created_at`)
- **Both restock and pickup accept a user-supplied date**; there is no separate business-date column — the date is written straight into `created_at`. Pickup: `pickup_date` → RPC param `p_pickup_date`. Restock: `restock_date` → the insert's `created_at` (`app/api/inventory/restock/route.ts`).
- **Every FIFO path orders and filters on `created_at`** — `/api/settlement/calculate`, `/api/events/[id]/shuttle-cost`, `/api/inventory/history`. A backdated record therefore changes *batch attribution*, not just display. Do not add a separate date column without migrating all three call sites together.
- **Restock keeps the current wall-clock time** (`restockDateToISO()` in `components/inventory-manager-dialog.tsx` sets H:M:S from `now`), so several restocks logged on the same day retain their order. Pickup does not need this — pickups only accumulate into a total, order is irrelevant. Never "normalize" restock timestamps to 00:00; it collapses same-day batches with different `unit_price` into an arbitrary order.
- **These endpoints compute point-in-time stock, not current stock.** `/api/events/[id]/shuttle-cost` answers "what was on hand *on the event date*", which is deliberately unrelated to the home page's `inventory_summary.current_stock`. The usual cause of a spurious 「庫存不足」 is a restock whose date is *after* the event date (e.g. logged only after the session). The 400 response spells this out and returns `available` / `required` / `shortage`.
- **Taipei day boundary**: an event/period date is a Taipei calendar day, so every bound must be built at `+08:00` — `new Date('YYYY-MM-DD')` parses at UTC 00:00 (= Taipei 08:00) and shifts the window 8 hours late at both ends. Both routes now do this: `taipeiDayAfter()` in `/api/events/[id]/shuttle-cost`, `taipeiDayBoundary(date, dayOffset)` in `/api/settlement/calculate` (offset 0 = start bound, offset 1 = end bound paired with strict `<`). Never compare a raw `new Date(dateStr)` against `created_at`.

### Settlement FIFO Calculation (`/api/settlement/calculate`)
- **Replays ALL pickups from the beginning**, not just those in the queried period. This is required to know *which restock batch* each pickup consumed; only pickups inside the period accumulate into the returned cost. Do not "optimize" by filtering pickups before the FIFO replay — it breaks batch attribution.
- **End-date boundary gotcha** (the v1.4 bug): a naive `<= end_date` excludes that whole day; the fix is strict less-than against the next day. The v1.4 fix got the *shape* right but stayed on UTC, leaving an 8-hour skew that was corrected later — both bounds now go through `taipeiDayBoundary()`. Preserve both the strict-`<` shape and the `+08:00` construction when touching date filters.
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
| `20260903000000_add_club_members_and_pin_lockout.sql` | 新增 `club_members`（球隊名冊）+ `event_attendees.member_id`（nullable）；`clubs` 加 `failed_pin_attempts`／`pin_locked_until`（PIN 連錯鎖定） |
| `20260722000000_add_line_notification.sql` | Adds LINE binding columns to `groups` (`line_enabled`, `line_user_id`, `line_verify_code`, `line_verify_expires_at`) + partial index on verify code; adds per-channel dedup columns (`email_notified_at`, `line_notified_at`) to `low_stock_alerts` and backfills `email_notified_at` from legacy `notified_at` |

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
- **PIN 不是資料隔離**：`/api/events/*` 只驗證 group 層級的登入身分，不檢查 PIN。同一 group 帳號
  登入後可直接呼叫 API 讀取其他 club 的資料。這是刻意的取捨（見 PRD「PIN 是 UI gate」），
  前提是**共用同一 group 帳號的球隊彼此信任**；已寫入 `docs/user-manual.md` 告知使用者。
  若要真隔離需走 PRD Phase 2（獨立帳號 + RLS），見 `docs/IMPROVEMENT-LOG.md` 的 B1。

### Data model
```
groups → clubs → badminton_events → event_attendees
              └→ club_members ←──────────┘ (event_attendees.member_id, nullable)
```

### 球隊名冊（club_members）
- 常來的隊員建檔一次，之後建立活動可直接點選；`display_name` 在同一 club 內唯一。
- `event_attendees.member_id` 是 **nullable** 的選填關聯：臨時來的客人仍可直接打字，不必先建檔。
  刪除成員時 `ON DELETE SET NULL`，歷史出席紀錄保留姓名文字，不影響已結算的帳目。
- LINE 訊息解析後會**自動比對名冊**（以 `display_name` 完全相符），對得上的套用該成員的
  `default_fee` 與 `is_free` 並記下 `member_id`。
- 停用（`is_active=false`）而非刪除，是為了保留歷史關聯又不干擾勾選清單。

### PIN 連錯鎖定
- `POST /api/clubs/[id]/verify-pin` 連錯 5 次鎖定 15 分鐘（`clubs.failed_pin_attempts` /
  `pin_locked_until`），驗證成功即清零。鎖定中直接回 429，**不比對 PIN 也不累加次數**。
- 鎖定期已過的失敗算重新起算的第一次，不會延續舊的計數。

### Key behaviors
- **Attendee order**: preserved from LINE message → sequential `for...of` insert → API sorts by `created_at ASC`
- **Shuttle cost**: always set to manual/0 on create; configure in event detail via FIFO calculator or manual input
- **FIFO unit conversion**: inventory uses 桶 (tubes); UI shows 顆 (pieces); `PIECES_PER_TUBE = 12`
- **Profit colors**: Taiwan stock market convention — positive = red, negative = green
- **Settlement**: once `is_settled=true`, event cannot be deleted (403)

### LINE message parser (frontend only)
- Regex extracts player names, fees from LINE group messages
- Handles formats: `1. Name $fee`, `免費` keyword → `isFree=true`
- `lib/line-parser.ts` — 純函式、零依賴，測試在 `lib/line-parser.test.ts`（PRD 4.3 的格式對照表即測試案例）
- **行內的「候補 0」不可誤判為區段標題**（如 `報名 16/16｜候補 0`），否則會把整份名單截掉；已有測試守住

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

### Dedup (avoid daily re-spam) — **per-channel** (email / LINE)
- `low_stock_alerts` (PK = `shuttlecock_type_id`) has **two** timestamps: `email_notified_at`, `line_notified_at`. A channel counts as "already notified" only when **its own** column is non-null.
- Each run, per low-stock type **per channel**: if the group has that channel's target AND that channel's timestamp is null → send + stamp that column. Already-stamped channels are skipped. This means a type can notify LINE today and email tomorrow (e.g. if email was added later), without double-sending either.
- **Recovery**: a type that is `is_active` and back to `stock ≥ threshold` → the **whole row is deleted** (both channels reset), so a future dip re-notifies on all channels.
- Timestamps are written **only after a successful send** (send-then-record). Groups with **neither** channel configured are skipped entirely (no row), so they get notified once they set a target. Preserve this ordering.
- **Partial-upsert gotcha**: email and LINE successes are written in **two separate `upsert` calls** (each with a uniform column set). Do NOT merge them into one mixed-key array — PostgREST fills missing keys with null and would wipe the other channel's timestamp.

### Recipients (two independent channels)
- **Email** → `groups.contact_email` (often null on legacy accounts). Null → email channel skipped.
- **LINE** → `groups.line_user_id` when `line_enabled` is true. Not bound → LINE channel skipped. See LINE module below.
- The `/settings` page (`group-settings-form.tsx`) prompts users to fill an inbox and/or bind LINE.

## LINE 低庫存通知模組（Low-Stock LINE Alert）

### Architecture
- Second notification channel alongside email; **not** LINE Notify (discontinued 2025-03-31) — uses the **LINE Messaging API** with a single shared **Official Account**.
- `lib/line.ts` — `pushLineMessages` (Push arbitrary message objects, e.g. Flex) / `replyLineMessage` (Reply API, **free**, uses webhook `replyToken`) / `buildLowStockFlexMessage` (Flex bubble w/ postback button; builds its body text via the module-private `buildLowStockLineText`, since LINE has no HTML) / `buildOrderDraftLineText`. Calls Messaging API via `fetch`, Bearer `LINE_CHANNEL_ACCESS_TOKEN`. No SDK.
- The cron pushes LINE alongside email in the same per-group loop (see per-channel dedup above).

### Low-stock message & on-demand order draft (cost-aware)
- Cron sends **one** Flex message (via `pushLineMessages`) = the low-stock alert **plus a "產生下訂訊息" postback button**. Only 1 push/quota per alert — the order draft is NOT pushed proactively.
- Button carries `postback.data = "action=order_draft&gid=<group_id>"`. When tapped, LINE sends a **postback event** to the webhook → `handleOrderDraft` re-scans `inventory_summary` for that group's **current** low-stock items and **replies** (free) with `buildOrderDraftLineText` (clean, forwardable, quantity left blank for manual fill). Security: verifies the tapper's `userId` matches the group's bound `line_user_id` before replying.

### Account binding flow (user links their group to a LINE userId)
1. Settings page (`group-settings-form.tsx`) → "開啟 LINE 通知" → `PATCH /api/group` with `{ lineAction: 'enable' }` → server generates a **6-digit code** (collision-checked vs other groups' unexpired codes) with a **10-min expiry**, stores on `groups`.
2. UI shows the OA add-friend QR (`public/line-add-friend.png` static asset) + `NEXT_PUBLIC_LINE_BASIC_ID` + the code.
3. User adds the OA and sends the code in chat → LINE hits `POST /api/line/webhook`.
4. Webhook (`app/api/line/webhook/route.ts`): verifies `x-line-signature` (HMAC-SHA256 over the **raw body** with `LINE_CHANNEL_SECRET`, Web Crypto, timing-safe compare) → matches the code against unexpired `groups.line_verify_code` via **service role** (no cookie) → writes `line_user_id`, clears the code, replies "綁定成功".
5. `lineAction: 'unbind'` clears `line_user_id` + disables.

### Gotchas
- Webhook MUST read `request.text()` (raw string) for signature verification — parsing then re-stringifying breaks the HMAC.
- Webhook always returns 200 (except 401 on bad signature) so LINE won't retry-storm; errors are logged.
- LINE Console: set Webhook URL = `https://shuttlecock-tracker.vercel.app/api/line/webhook`, **enable webhook**, and **disable auto-reply messages** (else the OA's canned reply masks the binding response).
- `middleware.ts` does not guard `/api/*`, so the webhook is reachable unauthenticated (intended — it self-authenticates via signature).

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # DELETE /api/group + low-stock cron + LINE webhook (bypass RLS)
NEXT_PUBLIC_SITE_URL=...
GMAIL_USER=...                  # Dedicated Gmail for low-stock alerts (shuttlecock.tracker.bot@gmail.com)
GMAIL_APP_PASSWORD=...          # Gmail App Password (NOT login password); spaces are stripped before use
CRON_SECRET=...                 # Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"; route rejects otherwise
LINE_CHANNEL_ACCESS_TOKEN=...   # LINE Messaging API push/reply (低庫存 LINE 通知)
LINE_CHANNEL_SECRET=...         # LINE webhook signature verification (x-line-signature HMAC-SHA256)
NEXT_PUBLIC_LINE_BASIC_ID=...   # OA Basic ID (@xxxx), shown in settings dialog for manual add-friend search
```
