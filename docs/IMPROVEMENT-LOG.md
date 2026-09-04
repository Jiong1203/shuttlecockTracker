# 技術稽核改善追蹤

依據 [`docs/technical-audit.html`](./technical-audit.html)（2026-09-02 全專案掃描，18 項發現）的建議順序執行。

**狀態圖例**：`✅ 完成` · `🚧 進行中` · `⏸ 待決策` · `⬜ 未開始`

---

## 進度總覽

| 梯次 | 項目 | 狀態 | Commit |
|------|------|------|--------|
| 一 | A1 利潤應收／實收拆分 | ✅ | `feat/audit-wave-1` |
| 一 | C1 出席者批次寫入與錯誤處理 | ✅ | `feat/audit-wave-1` |
| 二 | F1 抽出 LINE parser | ✅ | `feat/audit-wave-2` |
| 二 | D1 FIFO 與 parser 測試 | ✅ | `feat/audit-wave-2` |
| 二 | D2 錯誤頁與 404 頁 | ✅ | `feat/audit-wave-2` |
| 二 | C3 紀錄截斷提示 | ✅ | `feat/audit-wave-2` |
| 三 | E1 球員名冊 | ✅ | `feat/audit-wave-5` |
| 三 | E4 催繳訊息草稿 | ✅ | `feat/audit-wave-3` |
| 三 | E2 CSV 匯出 | ✅ | `feat/audit-wave-3` |
| 三 | E3 搜尋與篩選 | ✅ | `feat/audit-wave-3` |
| 四 | B1 球隊資料隔離 | ✅ | 已裁決：維持現狀並寫入說明 |
| 四 | B2 PIN 嘗試次數限制 | ✅ | `feat/audit-wave-5` |
| 四 | B3 middleware 路徑一致性 | ✅ | `feat/audit-wave-4a` |
| 四 | A2 inventory_summary 加 group 過濾 | ⏸ | 需 DB migration |
| 四 | C2 group_id 進 JWT claim | ⏸ | 需 Supabase Auth Hook |
| 四 | A3 FIFO 批次快照 | ⬜ | 暫不執行（等資料量） |
| 四 | E5 多帳號與角色權限 | ⏸ | 需產品決策 |
| 四 | F2 大檔案拆分 | ✅ | `feat/audit-wave-4a` |

---

## 待決策事項

以下項目已停在需要你授權或裁決的地方，**尚未動工**。

### 一、資料庫變更會直接套用到正式環境

`.github/workflows/supabase-migrations.yml` 設定為：push 到 `main` 且 `supabase/migrations/`
有變動時，**自動對東京正式機執行 `supabase db push`**。

因此下列項目一旦合併就會改動線上資料庫的 schema，需要你明確同意後才進行：

| 項目 | 需要的變更 | 風險 |
|------|-----------|------|
| ~~E1 球員名冊~~ | ~~新增 `club_members` 表~~ | ✅ 已完成 |
| ~~B2 PIN 嘗試次數限制~~ | ~~`clubs` 加兩欄~~ | ✅ 已完成 |
| A2 庫存彙總加 group 過濾 | 重建 `inventory_summary` view | **中**。view 被首頁、低庫存 cron、庫存管理共用，語意須完全等價 |

### 二、需要產品方向的裁決

| 項目 | 要決定的事 |
|------|-----------|
| ~~B1 球隊資料隔離~~ | ✅ 已裁決：維持現狀，改以文件明確告知保護範圍 |
| E5 多帳號與角色權限 | 是否會開放給第二個球館使用？若會，與 B1 是同一個工程，且應在開放前先做，因為它決定資料模型 |

### 三、需要在 Supabase 主控台操作

| 項目 | 說明 |
|------|------|
| C2 `group_id` 進 JWT claim | 需設定 Supabase Auth Hook（Custom Access Token），無法只靠程式碼完成 |

### 四、建議暫不執行

| 項目 | 理由 |
|------|------|
| A3 FIFO 批次快照 | 目前資料量下完全感覺不到。建議先加耗時 log 觀察，等領取紀錄破千筆再評估 |
| FIFO 演算法抽出與測試 | `settlement/calculate` 與 `shuttle-cost` 是兩套不同實作，抽出共用的重構風險高於已完成的項目，且正是最不該出錯的地方。建議單獨排一次，前後以測試夾住 |

---

## 環境限制（影響驗證強度）

> **2026-09-03 事故與修正**：先前在 WSL 內執行 `npm install -D vitest`，安裝以 EPERM 失敗，
> 但已留下 `node_modules/.bin/{vitest,vite,rolldown}` 三個 Linux symlink（目標不存在）
> 與空的 `@vitest/` 目錄。Windows 端的 npm 對這些 symlink 執行 `lstat` 回 EACCES，
> 導致正常的 `npm install` 也無法完成。
>
> **修正**：移除該批殘留（`package-lock.json` 未受污染），並將 vitest 由 `^4.1.11`
> 降為 `^3.2.7`——4.x 依賴 `rolldown` 這個較新的原生二進位模組，在此混合環境風險偏高；
> 3.x 走 vite/esbuild，是成熟路徑。65 項測試在 3.2.7 下全數通過。
>
> **往後規則**：套件一律在 Windows 端安裝，WSL 只用於 `npx` / `tsc` / `eslint` / `vitest`。


本機為 WSL 存取 `/mnt/d` 的 Windows 檔案系統，`npm install` 會因無法對 node_modules 執行
`chmod` 而失敗（EPERM）。連帶影響：

- `npm run build` 無法在本機執行（`lightningcss` 原生模組缺失）
- `vitest` 已寫入 `package.json`，但需在 **Windows 端執行一次 `npm install`** 才會實際安裝；
  本輪測試以 `npx vitest run` 驗證

因此所有改動的驗證強度為：**型別檢查通過、ESLint 無新增問題、65 項測試通過，但未經實機操作**。

---

## 變更紀錄

<!-- 每完成一項，於此區塊由新到舊追加一節 -->

### 2026-09-04 · 不存在的球隊與活動的處理（實機回報）

輸入不存在的球隊網址（如 `/clubs/88856`）時，畫面**先跳出 PIN 輸入框**，
使用者輸入完才被告知「找不到此球隊」；而且該 PIN 畫面的標題是「進入 球隊」——
球隊名稱是空的，因為頁面根本沒確認過球隊是否存在。

成因：`page.tsx` 取得球隊資料後只寫 `if (d.id) setClub(d)`，**404 完全沒有處理**，
於是 `club` 保持 null，流程照樣往下走到 PIN 閘門，名稱用 fallback 的「球隊」帶過。
API 本身早已正確回傳 404，是前端沒有接。

**改法**：`fetch` 檢查 `res.ok`，失敗時呼叫 Next.js 的 `notFound()`，
交給 `app/(app)/not-found.tsx` 呈現——該頁的文案本來就寫著「這筆球隊、活動紀錄已經被刪除了」，
正好切題，也保有側邊欄與回首頁的出口。PIN 閘門改為僅在球隊確實存在時渲染，
因此標題一定帶得出正確的球隊名稱。

**同源問題一併修正**：活動詳情對話框的 `fetchEvent` 同樣只在 `res.ok` 時 `setEvent`，
載入失敗時 `loading` 已結束但 `event` 仍為 null，畫面會**永遠停在轉圈圈**。
改為記錄錯誤並顯示「找不到這場活動 / 可能已被刪除」與關閉按鈕。

### 2026-09-04 · 球隊名冊排序修正（實機回報）

名冊原本依 `display_name` 升冪，但中文姓名在資料庫是按 **Unicode 碼位**排序，
對使用者等同隨機——實際回報的案例是「炯文（U+70AF）→ 輝（U+8F1D）→ 阿玫（U+963F）」，
既非筆劃也非注音，最後加入的人卻排在中間。

當初直接套用了英文名單常見的按名稱排序，未考慮中文的排序結果對使用者沒有意義。

**改為依 `created_at` 升冪**（加入順序），並以 `id` 作為同毫秒時的穩定 tie-break。
名冊規模通常十餘人，加入順序本身也隱含了誰是老隊員、誰是新加入的。

同時修正名冊批次新增 API 的時間戳：同批次寫入時資料庫 `now()` 完全相同會使排序失去意義，
改為逐筆遞增 1 毫秒——與出席者批次寫入相同的處理。此 API 目前尚無 UI 入口，
但若日後加入「從出席名單一鍵建檔」就會用到。

### 2026-09-04 · CSV 匯出的型別修正（實機回報）

實機驗證入庫紀錄匯出時發現兩個問題，成因相同：

| 現象 | 成因 |
|------|------|
| 進貨日期整欄顯示 `#####` | Excel 判定為日期型別，欄寬不足即以 `#####` 表示 |
| 球種「5」靠右、「5+」靠左 | 「5」被判定為數值，同欄的文字則靠左，並排參差 |

**CSV 無法攜帶欄寬資訊**（純文字格式），因此調欄寬不是可行的解法。
改為讓這些欄位以文字型別輸出——文字欄位寬度不足只會截斷或溢出，不會變成 `#####`，
而且同欄位型別一致，對齊就整齊了。

`lib/csv.ts` 新增 `asText()`，以 `="..."` 語法標記（Excel／Google Sheets／LibreOffice 通用），
需要兩層跳脫：先讓引號在 Excel 公式內合法，再讓整格在 CSV 內合法。
套用於三處匯出的日期與名稱欄位；數量、單價、金額維持數值型別以保留計算能力。

入庫紀錄的日期同時由 `toLocaleString`（如「2026/9/4 上午12:00:00」）改為
`YYYY-MM-DD HH:mm`，較短且可直接排序。

新增 6 項測試（總數 65 → 71）。

**環境變化**：`node_modules` 現為 Windows 平台安裝，其中的 `rollup` 原生模組是 win32 版，
因此 **WSL 內已無法執行 vitest**（缺 `@rollup/rollup-linux-x64-gnu`），`npx` 亦同，
因為模組解析仍會找到專案本地的 rollup。WSL 這邊僅能執行 `tsc` 與 `eslint`；
測試需在 Windows 端以 `npm test` 執行。本次的跳脫邏輯改以 Node 腳本做往返驗證
（輸入 → CSV → 模擬 Excel 解析），六項預期值全部核對相符。

### 2026-09-03 · 球員名冊、PIN 鎖定與 B1 裁決

#### E1 — 球隊名冊

**Migration**：`20260903000000_add_club_members_and_pin_lockout.sql`（純新增，不動既有資料）

- `club_members`：club_id、display_name、default_fee、is_free、is_active、note。
  同一 club 內 display_name 唯一，否則名冊失去辨識作用。
- `event_attendees.member_id`：**nullable** 選填關聯，`ON DELETE SET NULL`。
  臨時客人仍可直接打字；刪除成員時歷史出席紀錄保留姓名，不影響已結算帳目。
- RLS 透過 club → group 隔離，寫法與 `badminton_events` 一致。

**API**：`/api/clubs/[id]/members`（GET 列表、POST 單筆或批次）與
`/api/clubs/[id]/members/[mid]`（PATCH、DELETE）。同名時回 409。

**介面**：
- 球隊頁右上新增「球隊名冊」，開啟管理對話框（新增、改預設費用、切換免費、停用、刪除）
- 建立活動時名冊成員顯示為可點選標籤，點一下加入並帶入費用；支援「全部加入」
- **LINE 訊息解析後自動比對名冊**：對得上的套用其預設費用與免費設定並記下關聯，
  解析結果會顯示「其中 N 位對應到名冊」

#### B2 — PIN 連錯鎖定

`clubs` 新增 `failed_pin_attempts`、`pin_locked_until`。連錯 5 次鎖 15 分鐘，
驗證成功即清零。鎖定中直接回 429，不比對 PIN 也不累加次數；鎖定期已過的失敗算重新起算。
失敗回應會告知剩餘次數。

#### B1 — 裁決：維持現狀，寫入說明

各球隊的收費資料在 API 層確實沒有互相隔離（PIN 只是畫面上的門）。經裁決維持現行架構，
改以文件明確告知，避免 PIN 給人錯誤的安全感：

- `docs/user-manual.md`：新增「關於 PIN 碼的保護範圍」警示框，說明 PIN 是操作區隔而非
  資料層級隔離，並要求「只有互相信任的球隊共用同一個球團帳號」。
  同時修正系統簡介中「每個球隊的資料完全獨立」這句過度承諾的描述。
- `CLAUDE.md`：記錄此為刻意取捨及其前提，並指向 Phase 2 的升級路徑。

### 2026-09-03 · 第四梯（不需資料庫變更的部分）

#### B3 — middleware 改為預設保護

原本列舉「受保護路徑」（`['/', '/clubs']`），`/settings` 不在其中，只靠頁面自己的
`getSession()` 把關——而該方法在伺服器端只解 cookie、不驗證簽章。

改為列舉「公開路徑」（`/login`、`/manual`），其餘一律要求登入並經 `getUser()` 驗證。
方向反過來之後，日後新增頁面預設就是受保護的，不會因為忘了加進清單而外露。

#### F2 — 拆分大檔案與抽出重複的格式化函式

| 檔案 | 變化 |
|------|------|
| `app/(app)/clubs/[id]/page.tsx` | 853 → 491 行 |
| `components/create-event-dialog.tsx` | 新增，320 行 |
| `components/club-pin-gate.tsx` | 新增，58 行 |
| `lib/format.ts` | 新增，集中金額與損益的顯示格式 |

`fmtMoney`／`profitClass`／`profitLabel` 原本在球隊頁與活動詳情各有一份（兩處的
`profitClass` 差在字重），現改為共用；球隊頁保留一層加上 `font-bold` 的包裝，顯示結果不變。

**累計成果**：`clubs/[id]/page.tsx` 自稽核前的 843 行降至 491 行（−42%），
職責由四項（解析器、建立對話框、PIN 閘門、頁面本體）收斂為一項。

### 2026-09-03 · 第三梯（不需資料庫變更的部分）

#### E4 — 催繳訊息草稿

新增 `lib/payment-reminder.ts`，於活動詳情的名單工具列加入「催繳訊息」。
點擊後產生可直接貼進 LINE 群組的文字並複製到剪貼簿：逐筆列出未繳者與金額、
附合計與人數。免費者與已繳者不會被點名。

**刻意不做自動推播**：何時催、催誰由負責人決定，系統自動發送容易造成困擾。
作法與既有的下訂草稿一致，也完全不佔用 LINE 推播額度。

#### E2 — CSV 匯出

新增 `lib/csv.ts`，三處加入匯出：

| 位置 | 內容 |
|------|------|
| 結算對話框 | 各球種的批次明細、小計、均價與區間總成本 |
| 活動詳情 | 出席名單、應繳金額、繳費狀態，附應收／實收／未收合計 |
| 庫存管理中心的紀錄分頁 | 進貨日期、品牌球種、數量、單價、總額 |

檔案帶 UTF-8 BOM（否則 Excel 開啟中文會亂碼），含逗號、引號、換行的欄位依 RFC 4180 逸出，
檔名自動附加日期避免覆蓋。

#### E3 — 搜尋與篩選

- **領取紀錄**：新增姓名／球種搜尋與月份下拉（月份選項取自實際資料）。
  已載入資料達上限時，提示會說明「搜尋與篩選在此範圍內進行」。
- **活動列表**：新增全部／未結算／已結算切換。日期篩選原本就有（後端 `start`／`end` 參數），
  狀態篩選為前端過濾；兩者的結果都會連動彙總統計、合計列與趨勢圖。

順帶修正建立活動時的載入文案——C1 改為批次寫入後，「逐一新增 N 位出席者」已不符實際。

#### 測試

新增 `lib/csv.test.ts`（10 項）與 `lib/payment-reminder.test.ts`（9 項）。
**測試總數 46 → 65，全數通過。**

### 2026-09-02 · 第二梯完成

#### F1 — 抽出 LINE 訊息解析器

`parseLineMessage()` 從 `app/(app)/clubs/[id]/page.tsx`（843 行）搬到 `lib/line-parser.ts`，
補上 `ParsedLineMessage` 型別。頁面降至 826 行，解析器成為可獨立測試的純函式。

#### D1 — 建立測試基礎並涵蓋三處高風險邏輯

導入 Vitest，新增 `npm test` / `npm run test:watch`。**46 個測試全數通過**。

| 測試檔 | 涵蓋範圍 | 案例數 |
|--------|----------|--------|
| `lib/line-parser.test.ts` | PRD 第 4.3 節的六種名單格式、候補截斷、活動資訊解析、邊界情況 | 20 |
| `lib/date-boundary.test.ts` | 台北日界換算、結算區間的四個臨界時刻、跨月跨年 | 14 |
| `lib/event-finance.test.ts` | 應收／實收／未收、免費者處理、兩種利潤基準 | 12 |

順帶抽出 `lib/date-boundary.ts`：原本 `/api/events/[id]/shuttle-cost` 與
`/api/settlement/calculate` 各有一份台北日界換算，現改為共用單一實作，並被測試涵蓋。
其中「行內的『候補 0』不可誤判為區段標題」與「結算區間四個臨界時刻」兩組案例，
守的正是先前實際發生過的錯誤。

**尚未涵蓋**：FIFO 批次歸屬演算法本身仍在 route 內（`settlement/calculate` 與 `shuttle-cost`
是兩套不同實作）。抽出共用需要較大重構，風險高於本梯其餘項目，另列待辦。

#### D2 — 錯誤邊界與找不到頁面

新增 `app/(app)/error.tsx` 與 `app/(app)/not-found.tsx`，取代 Next.js 的英文預設頁。
兩者都在 AppShell 之內，保有側邊欄，並提供重新載入與回首頁的出口。

#### C3 — 列表截斷提示

領取紀錄（100 筆）與入庫紀錄（500 筆）在達到上限時顯示
「僅顯示最近 N 筆，更早的紀錄仍保存於系統中」。上限提取至 `lib/limits.ts` 由前後端共用
（Next.js 的 route.ts 不允許匯出非約定名稱，故不能定義在 route 內）。

**環境限制**：本機 `npm install` 因 WSL 無法對 `/mnt/d` 上的 node_modules 執行 chmod 而失敗
（EPERM），`vitest` 已寫入 `package.json` 但需在 Windows 端執行一次 `npm install` 才會實際安裝。
測試以 `npx vitest run` 驗證通過。同一限制也使 `npm run build` 無法在本機執行。

### 2026-09-02 · 第一梯完成

#### A1 — 利潤改以應收為基準

**問題**：總收入只計 `paid && !is_free`（實收），但場租在活動建立當下全額計入成本。
一場尚未收費的新活動因此顯示大額虧損。

**改法**：新增 `lib/event-finance.ts` 作為財務計算的單一事實來源，
`/api/events` 與 `/api/events/[id]` 兩處重複的計算改為呼叫它。回傳欄位擴充為：

| 欄位 | 意義 |
|------|------|
| `total_due` | 應收（Σ 非免費者應繳） |
| `total_paid` | 實收（Σ 已繳且非免費） |
| `total_unpaid` | 未收 |
| `unpaid_count` / `payer_count` | 未繳人數／應繳人數 |
| `profit` | **語意變更**：改為應收基準 |
| `profit_paid` | 實收基準利潤 |
| `total_revenue` | 保留相容，等同 `total_paid`，標記 deprecated |

**介面**：活動詳情摘要卡「總收費」改為「應收」，下方新增收款進度列
（未繳人數、未收金額、實收利潤）；球隊頁的統計列、手機摘要、表格與合計列
一併改用應收，並在有未收時以琥珀色標示。

#### C1 — 出席者批次寫入

**問題**：建立活動後以 `for...of` 逐筆 POST，20 人即 21 個往返、40+ 次查詢；
迴圈內未檢查 `res.ok`，中途失敗會靜默且留下半套資料。

**改法**：`POST /api/events/[id]/attendees` 同時接受單筆物件與 `{ attendees: [...] }` 批次，
批次以單次 `insert()` 寫入。前端改為一次呼叫，失敗時明確告知「活動已建立但名單寫入失敗」。

**保序細節**：出席順序依 `created_at` 升冪。同批次寫入時資料庫 `now()` 會完全相同，
順序將不穩定，因此批次路徑逐筆遞增 1 毫秒的時間戳，維持 LINE 名單的原始順序。

**驗證**：`tsc --noEmit` 通過、`eslint` 無新增問題。未實機執行（WSL 環境 `lightningcss` 缺失，
`npm run build` 無法啟動）。

### 2026-09-02 · 稽核報告產出

- 全專案掃描：62 個 TypeScript 檔案、6 個 migration、18 個 API 路由
- 報告留存於 `docs/technical-audit.html`
- 建立本追蹤文件
