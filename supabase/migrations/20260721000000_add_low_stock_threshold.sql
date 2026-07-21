-- 低庫存通知功能
-- 1) shuttlecock_types 新增每球種安全庫存門檻（單位：桶），預設 5
-- 2) 更新 inventory_summary view 帶出 low_stock_threshold，供 cron 掃描判斷
-- 3) 新增 low_stock_alerts 表做「已通知」去重，避免每天重複寄同一筆

-- 1) 門檻欄位（沿用前端原本寫死的 5 作為預設）
alter table "public"."shuttlecock_types"
  add column if not exists "low_stock_threshold" integer not null default 5;

-- 門檻不可為負
alter table "public"."shuttlecock_types"
  add constraint "shuttlecock_types_low_stock_threshold_check"
  check (low_stock_threshold >= 0) not valid;
alter table "public"."shuttlecock_types"
  validate constraint "shuttlecock_types_low_stock_threshold_check";

-- 2) 更新 view，新增 st.low_stock_threshold 欄位（其餘定義與原本一致）
create or replace view "public"."inventory_summary" as  WITH restock_stats AS (
         SELECT restock_records.shuttlecock_type_id,
            sum(restock_records.quantity) AS total_qty
           FROM public.restock_records
          GROUP BY restock_records.shuttlecock_type_id
        ), pickup_stats AS (
         SELECT pickup_records.shuttlecock_type_id,
            sum(pickup_records.quantity) AS total_qty
           FROM public.pickup_records
          GROUP BY pickup_records.shuttlecock_type_id
        )
 SELECT g.id AS group_id,
    st.id AS shuttlecock_type_id,
    st.brand,
    st.name,
    st.is_active,
    st.low_stock_threshold,
    COALESCE(rs.total_qty, (0)::bigint) AS total_restocked,
    COALESCE(ps.total_qty, (0)::bigint) AS total_picked,
    (COALESCE(rs.total_qty, (0)::bigint) - COALESCE(ps.total_qty, (0)::bigint)) AS current_stock
   FROM (((public.groups g
     JOIN public.shuttlecock_types st ON ((g.id = st.group_id)))
     LEFT JOIN restock_stats rs ON ((st.id = rs.shuttlecock_type_id)))
     LEFT JOIN pickup_stats ps ON ((st.id = ps.shuttlecock_type_id)));

-- 3) 去重記錄表：某球種一旦低於門檻並已寄信，即在此留一筆；
--    庫存回補到門檻以上時由 cron 清除該筆，之後再度低於門檻才會重新通知。
create table if not exists "public"."low_stock_alerts" (
    "shuttlecock_type_id" uuid not null primary key
        references public.shuttlecock_types(id) on delete cascade,
    "group_id" uuid not null references public.groups(id),
    "notified_at" timestamp with time zone not null default timezone('utc'::text, now())
);

-- 僅由後端 service role（cron）存取，啟用 RLS 且不建立 policy（service role 會繞過 RLS）
alter table "public"."low_stock_alerts" enable row level security;

create index if not exists idx_low_stock_alerts_group
    on public.low_stock_alerts using btree (group_id);
