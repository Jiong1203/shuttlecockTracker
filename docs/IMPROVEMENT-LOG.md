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
| 三 | E1 球員名冊 | ⏸ | 需 DB migration |
| 三 | E4 催繳訊息草稿 | ⬜ | — |
| 三 | E2 CSV 匯出 | ⬜ | — |
| 三 | E3 搜尋與篩選 | ⬜ | — |
| 四 | B1 球隊資料隔離 | ⏸ | 需產品決策 |
| 四 | B2 PIN 嘗試次數限制 | ⏸ | 需 DB migration |
| 四 | B3 middleware 路徑一致性 | ⬜ | — |
| 四 | A2 inventory_summary 加 group 過濾 | ⏸ | 需 DB migration |
| 四 | C2 group_id 進 JWT claim | ⏸ | 需 Supabase Auth Hook |
| 四 | A3 FIFO 批次快照 | ⬜ | 暫不執行（等資料量） |
| 四 | E5 多帳號與角色權限 | ⏸ | 需產品決策 |
| 四 | F2 大檔案拆分 | ⬜ | — |

---

## 變更紀錄

<!-- 每完成一項，於此區塊由新到舊追加一節 -->

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
