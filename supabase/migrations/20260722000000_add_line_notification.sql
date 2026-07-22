-- LINE 官方帳號低庫存通知功能
-- 1) groups 新增 LINE 綁定相關欄位（通知開關、綁定的 userId、待驗證碼與其時效）
-- 2) low_stock_alerts 改為「分通道」去重：email / LINE 各自獨立記錄通知時間
--    避免只綁單一通道的球團出現漏通知或每日重複通知的問題

-- 1) groups 綁定欄位
alter table "public"."groups"
  add column if not exists "line_enabled" boolean not null default false,
  add column if not exists "line_user_id" text,
  add column if not exists "line_verify_code" text,
  add column if not exists "line_verify_expires_at" timestamp with time zone;

-- webhook 以 service role 依「未過期驗證碼」跨 group 反查，加部分索引加速
create index if not exists idx_groups_line_verify_code
  on public.groups using btree (line_verify_code)
  where line_verify_code is not null;

-- 2) 分通道去重欄位
alter table "public"."low_stock_alerts"
  add column if not exists "email_notified_at" timestamp with time zone,
  add column if not exists "line_notified_at" timestamp with time zone;

-- 回填：既有記錄在本功能前僅有 email 通道，將舊的 notified_at 視為 email 已通知時間，
-- 避免升級後對「先前已用 email 通知過」的球種再次重複寄送
update "public"."low_stock_alerts"
  set email_notified_at = notified_at
  where email_notified_at is null;
