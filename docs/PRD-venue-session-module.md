# PRD — 開團紀錄模組 (Badminton Event Record)

**版本**: 0.4 Final  
**日期**: 2026-04-01  
**狀態**: 定稿，待實作

---

## 1. 背景與目標

目前系統已具備球的庫存追蹤與 FIFO 成本結算。但每次打球的「整場財務狀況」——場租、出席、收費、利潤——缺乏統一記錄入口。

**目標**：新增「開團紀錄」模組，讓球隊可在每場球局結束後完整記錄一場的營運數字，並一鍵算出當場利潤。

---

## 2. 概念模型

```
group（球館 / 大隊）
  ├── 庫存管理（現有功能，group 層級共用）
  └── club（球隊 / 小隊）
        └── badminton_events（活動場次）
              └── event_attendees（出席 & 收費名單）
```

**角色說明：**

| 角色 | 說明 |
|------|------|
| 球館管理員 | 持有 group 帳號，管理庫存入庫（用入庫密碼） |
| 球隊負責人 | 登入同一 group 帳號，輸入 club PIN 後操作自己 club 的活動與收費 |
| 球員 | 不持有帳號，由負責人代為登記，只管來打球付錢 |

---

## 3. 子帳號設計（方案 A，MVP）

### 方案 A：統一登入 group 帳號 + club PIN 二次驗證

```
使用者登入 group 帳號（Supabase Auth）
  → 首頁顯示所有 clubs 列表
  → 點擊 club → 輸入 PIN
  → 前端驗證通過 → 將 club_id 存入 sessionStorage
  → 進入 club 功能頁（活動列表、利潤摘要）
  → 關閉分頁 / 登出 → 自動清除，下次需重新輸入 PIN
```

**安全邊界**：資料隔離建立在 PIN 管理紀律上（PIN 不外流即可保護各 club 資料）。  
**未來升級**：Phase 2 可升級至方案 C（邀請碼 + 獨立帳號 + DB/RLS 層真正隔離）。

### Club 建立（等同球隊開戶）

建立 club 時同步填寫所有必要資訊，一次完成：

1. 球館管理員點選「新增球隊」
2. 填寫：**球隊名稱**、**隊長 / 負責人姓名**、**PIN 碼**（三欄均必填）
3. 系統以 PBKDF2 雜湊 PIN 後儲存（沿用 `lib/crypto.ts` 的 `hashPin`）

### API 安全層

```
所有 /api/events/* 與 /api/clubs/* 路由：
  1. 驗證 Supabase Auth → 取得 group_id（現有機制）
  2. 驗證 club.group_id = 當前 group_id（防跨 group 存取）
  3. PIN 驗證僅在「進入 club」時做一次，後續 API 不重複驗證
     （PIN 是 UI gate，group auth 是 API gate）
```

---

## 4. 功能範圍（MVP — 單一 Club 先行）

### MVP 邊界

- 初期不預設建立 club，由使用者手動建立
- UI 初期不需要 club 切換器，但資料模型預留多 club 擴展
- Club 管理（多 club 切換、停用）留待 Phase 2

### 4.1 Club 管理

- **建立 club**：球隊名稱 + 隊長/負責人 + PIN（三欄均必填）
- **更新 club**：名稱 / 負責人 / PIN（從 club 清單開啟設定 Dialog）

### 4.2 活動基本資訊

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| 活動日期 | DATE | ✅ | 預設今日；可從 LINE 訊息自動帶入 |
| 場地名稱 | TEXT | ❌ | 自由輸入；可從 LINE 訊息自動帶入 |
| 場地數 | INT | ✅ | 幾塊場地 |
| 時數 | NUMERIC | ✅ | 例：2.5 小時；可從 LINE 訊息自動推算 |
| 每小時場租 | NUMERIC | ✅ | 單位：元 |
| **場租小計** | 計算欄 | — | 場地數 × 時數 × 每小時場租 |
| 備註 | TEXT | ❌ | 自由輸入 |

### 4.3 LINE 訊息解析（出席名單輔助輸入）

負責人從 LINE 群組複製報名訊息後貼入系統，系統自動解析並輔助建立活動資訊與出席名單。

#### 解析邏輯

```
Step 1 — 提取活動基本資訊（自動帶入表單）
  日期：比對 YYYY/MM/DD、YYYY.MM.DD、MM/DD、M/D 等格式
  時間：比對 HH:MM-HH:MM 或 HH-HH，計算小時數
  場館：比對「場館：xxx」、「場地：xxx」關鍵字

Step 2 — 找候補分界線
  遇到「候補」、「——」、「🈵」等關鍵字即停止讀取正選名單

Step 3 — 提取編號條目
  Regex: ^\d+[.．、]\s*(.+)
  空白條目（僅有數字）跳過

Step 4 — 顯示解析預覽
  每筆名單可個別勾選、編輯名稱、設定費用、標記免費
```

#### 實際案例對應

| 案例格式 | 特點 | 解析結果 |
|---------|------|---------|
| `1. 阿呆` | 數字+點+空格+名字 | ✅ 正常解析 |
| `1.晟` | 數字+點+名字（無空格） | ✅ 正常解析 |
| `14. 愛玉（可到10）` | 括號備註 | 保留原文，名稱含備註，供用戶自行編輯 |
| `9.   馬戲團` | 多餘空格 | trim 後正常解析 |
| `16.`（空白） | 空位 | 跳過 |
| 候補區段 | `候補1:`、`候補：` | 整段排除，不列入名單 |

### 4.4 出席 & 收費

- 每場活動出席者獨立填寫（純文字姓名，無帳號綁定，無固定名冊）
- 每位出席者欄位：**姓名**、**應繳金額**、**是否已繳**、**是否免費**
- **免費設定**：負責人通常不收費，可將特定出席者標記為免費
  - 免費出席者的金額不計入總收費
  - 免費出席者不顯示繳費狀態切換
- 快捷功能：
  - 「設定統一費用」— 一鍵套用相同金額給所有非免費出席者
  - 「全部標記已繳」— 批次確認所有非免費出席者

**總收費** = Σ 已繳者的應繳金額（免費出席者不計）

### 4.5 用球成本（兩種模式，互斥）

| 模式 | 說明 | 適用情境 |
|------|------|---------|
| **manual** | 直接填入用球成本（元） | 跨日球局或已知成本 |
| **auto** | 選球種 + 顆數，以活動日為基準做 FIFO 試算 | 當日領球對應此活動 |

UI 提供 toggle 切換；auto 模式顯示 FIFO 試算結果供確認後寫入。

### 4.6 利潤計算（即時顯示於 club 頁面）

```
場租費用  = 場地數 × 時數 × 每小時場租
用球成本  = FIFO 計算 or 手動輸入
總收費    = Σ 已繳者金額（免費出席者不計）

利潤 = 總收費 − 用球成本 − 場租費用
```

**顏色規則（台股慣例）：**
- 正利潤 → 紅色
- 負利潤 → 綠色
- 利潤為零 → 灰色

### 4.7 結算標記

- `is_settled`：手動觸發，按下「標記已結算」後鎖定
- 已結算活動：**不可刪除**，API 返回 403

---

## 5. 資料模型

```sql
-- 球隊
CREATE TABLE clubs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  leader_name  TEXT NOT NULL,  -- 隊長 / 負責人姓名
  pin_hash     TEXT NOT NULL,  -- pbkdf2:<saltHex>:<hashHex>，同 restock_password 規格
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 活動
CREATE TABLE badminton_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id            UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  event_date         DATE NOT NULL,
  venue_name         TEXT,
  court_count        INT NOT NULL DEFAULT 1,
  hours              NUMERIC(4,1) NOT NULL,
  hourly_rate        NUMERIC(10,2) NOT NULL,
  shuttle_cost_mode  TEXT NOT NULL DEFAULT 'manual'
                     CHECK (shuttle_cost_mode IN ('auto', 'manual')),
  shuttle_cost       NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_settled         BOOLEAN NOT NULL DEFAULT false,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- 出席者（每場獨立，無固定名冊）
CREATE TABLE event_attendees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES badminton_events(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  fee           NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid          BOOLEAN NOT NULL DEFAULT false,
  is_free       BOOLEAN NOT NULL DEFAULT false,  -- 免費（如負責人），不計入收費
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

**動態計算欄（不存 DB，由 API 回傳）：**

```
venue_cost    = court_count × hours × hourly_rate
total_revenue = SUM(fee) WHERE paid = true AND is_free = false
profit        = total_revenue − shuttle_cost − venue_cost
```

---

## 6. API 端點

| Method | Path | 描述 |
|--------|------|------|
| `GET` | `/api/clubs` | 列出 group 底下所有 clubs（不含 pin_hash） |
| `POST` | `/api/clubs` | 建立 club（name + leader_name + pin） |
| `POST` | `/api/clubs/[id]/verify-pin` | 驗證 club PIN |
| `PATCH` | `/api/clubs/[id]` | 更新 club（名稱 / 負責人 / PIN） |
| `GET` | `/api/events?club_id=` | 列出活動（支援日期篩選） |
| `POST` | `/api/events` | 建立活動 |
| `GET` | `/api/events/[id]` | 取得活動詳情（含動態計算欄） |
| `PATCH` | `/api/events/[id]` | 更新活動（含 `is_settled` 標記） |
| `DELETE` | `/api/events/[id]` | 刪除活動（`is_settled=true` 時拒絕） |
| `GET` | `/api/events/[id]/attendees` | 列出出席者 |
| `POST` | `/api/events/[id]/attendees` | 新增出席者 |
| `PATCH` | `/api/events/[id]/attendees/[aid]` | 更新繳費狀態 / 金額 / 免費標記 |
| `DELETE` | `/api/events/[id]/attendees/[aid]` | 移除出席者 |
| `POST` | `/api/events/[id]/shuttle-cost` | FIFO 試算（auto 模式，以活動日為基準） |
| `POST` | `/api/events/parse-line` | 解析 LINE 訊息，回傳結構化資料（純前端亦可） |

---

## 7. UI 頁面結構

```
首頁 Header
 └── [開團紀錄] 入口
       └── Club 列表頁
             ├── Club 卡片（點擊後輸入 PIN）
             ├── [⚙] 設定 → Club 設定 Dialog（改名/改負責人/改PIN）
             └── [＋ 新增球隊] → 新增 Club Dialog

Club 活動列表頁（PIN 通過後）
  ├── 活動列表（每行：日期、場地、利潤摘要、結算狀態）
  ├── [篩選] 日期範圍
  └── [＋ 新增活動] → 新增活動 Dialog
        ├── 貼上 LINE 訊息區塊（選填，自動帶入）
        ├── 場地資訊欄位
        └── 用球成本欄位

活動詳情 Dialog（點擊既有活動）
  ├── 利潤卡片（場租 / 球費 / 收費 / 利潤）
  ├── 出席名單
  │     ├── 每人：姓名、金額、已繳切換、免費切換、刪除
  │     ├── [統一費用] [全繳]
  │     └── [＋ 新增出席者]
  ├── [編輯活動資訊]
  └── [標記已結算]（已結算後變灰並顯示鎖定圖示）
```

---

## 8. 未解決項目（Phase 2）

| 項目 | 說明 |
|------|------|
| 多 club 切換 UI | Club 切換器、側欄或 Tab |
| 子帳號升級 | 方案 C：邀請碼 + 獨立帳號 + RLS 真正隔離 |
| 首頁利潤摘要 | 考量多 club 後是否需要 group 層級報表 |
| Club 停用 / 封存 | 暫停某球隊的功能 |
| LINE 訊息解析強化 | 更多格式支援、自訂分隔規則 |

---

## 9. 技術備注

- PIN 雜湊：沿用 `lib/crypto.ts` 的 `hashPin` / `verifyPin`（PBKDF2-SHA256, 100k iterations）
- 所有 API 沿用 `getGroupId(supabase)` 作為第一層驗證
- 活動日期格式：`YYYY-MM-DD`（DATE 型別，不含時區）
- `revalidate` / `force-dynamic` 策略同現有 API 慣例
- LINE 訊息解析建議在前端執行（純 JS，無需後端），解析結果再由用戶確認後送出 API
- 利潤顏色：正利潤紅色、負利潤綠色（台股慣例），利潤為零灰色
