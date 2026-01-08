-- ==========================================
-- 資料庫遷移腳本：單一租戶 -> 多租戶多團體架構
-- ==========================================

-- 1. 建立團體表
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES auth.users,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. 插入一個預設團體 (將先前的資料歸屬到此)
INSERT INTO public.groups (id, name) 
VALUES ('00000000-0000-0000-0000-000000000000', '預設系統團體')
ON CONFLICT (id) DO NOTHING;

-- 3. 修改庫存設定表
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_config' AND column_name='group_id') THEN
        ALTER TABLE public.inventory_config ADD COLUMN group_id UUID REFERENCES public.groups(id);
        UPDATE public.inventory_config SET group_id = '00000000-0000-0000-0000-000000000000' WHERE group_id IS NULL;
        ALTER TABLE public.inventory_config ALTER COLUMN group_id SET NOT NULL;
    END IF;
END $$;

-- 4. 修改領取紀錄表
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pickup_records' AND column_name='group_id') THEN
        ALTER TABLE public.pickup_records ADD COLUMN group_id UUID REFERENCES public.groups(id);
        UPDATE public.pickup_records SET group_id = '00000000-0000-0000-0000-000000000000' WHERE group_id IS NULL;
        ALTER TABLE public.pickup_records ALTER COLUMN group_id SET NOT NULL;
    END IF;
END $$;

-- 如果 groups 表已經存在，但沒有 created_by 或 contact_email 欄位，就補上它
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='groups' AND column_name='created_by') THEN
        ALTER TABLE public.groups ADD COLUMN created_by UUID REFERENCES auth.users;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='groups' AND column_name='contact_email') THEN
        ALTER TABLE public.groups ADD COLUMN contact_email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='groups' AND column_name='restock_password') THEN
        ALTER TABLE public.groups ADD COLUMN restock_password TEXT;
    END IF;
END $$;

-- 5. 建立使用者擴充資料表 (Profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id),
    full_name TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. 更新檢視表 (先刪除舊的再建立新的)
DROP VIEW IF EXISTS public.inventory_summary;
CREATE VIEW public.inventory_summary AS
SELECT 
    g.id as group_id,
    COALESCE((
        SELECT initial_quantity 
        FROM public.inventory_config ic 
        WHERE ic.group_id = g.id 
        ORDER BY created_at DESC LIMIT 1
    ), 0) as initial_stock,
    COALESCE(SUM(pr.quantity), 0) as total_picked,
    COALESCE((
        SELECT initial_quantity 
        FROM public.inventory_config ic 
        WHERE ic.group_id = g.id 
        ORDER BY created_at DESC LIMIT 1
    ), 0) - COALESCE(SUM(pr.quantity), 0) as current_stock
FROM public.groups g
LEFT JOIN public.pickup_records pr ON g.id = pr.group_id
GROUP BY g.id;

-- 7. 重設 RLS 策略 (清理舊的並加入新的)
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_records ENABLE ROW LEVEL SECURITY;

-- 刪除可能存在的舊策略
DROP POLICY IF EXISTS "Allow public read-write for inventory_config" ON public.inventory_config;
DROP POLICY IF EXISTS "Allow public read-write for pickup_records" ON public.pickup_records;
DROP POLICY IF EXISTS "Users can view their own group" ON public.groups;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Group members can access inventory_config" ON public.inventory_config;
DROP POLICY IF EXISTS "Group members can access pickup_records" ON public.pickup_records;
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own group" ON public.groups;

-- Groups: 使用者只能看到自己所屬的團體，或者是該團體的建立者
CREATE POLICY "Users can view their own group" ON public.groups
    FOR SELECT USING (
        id = (SELECT group_id FROM public.profiles WHERE id = auth.uid()) OR 
        created_by = auth.uid()
    );
CREATE POLICY "Users can create groups" ON public.groups
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());
CREATE POLICY "Users can update their own group" ON public.groups
    FOR UPDATE USING (
        id = (SELECT group_id FROM public.profiles WHERE id = auth.uid()) OR 
        created_by = auth.uid()
    );

-- Profiles: 使用者只能查看與修改自己的 Profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can create own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Inventory Config: 只有同團體的人可以讀寫
CREATE POLICY "Group members can access inventory_config" ON public.inventory_config
    FOR ALL USING (group_id = (SELECT group_id FROM public.profiles WHERE id = auth.uid()));

-- Pickup Records: 只有同團體的人可以讀寫
CREATE POLICY "Group members can access pickup_records" ON public.pickup_records
    FOR ALL USING (group_id = (SELECT group_id FROM public.profiles WHERE id = auth.uid()));

-- 修改現有的視圖，將其安全性設定為 invoker
alter view public.inventory_summary 
set (security_invoker = on);

-- ==========================================
-- 資料庫遷移腳本：多球種庫存與 FIFO 支援 (第二階段)
-- ==========================================

-- 1. 建立 shuttlecock_types (球種) 表
CREATE TABLE IF NOT EXISTS public.shuttlecock_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) NOT NULL,
    brand TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_by UUID REFERENCES auth.users
);

-- 開啟 RLS
ALTER TABLE public.shuttlecock_types ENABLE ROW LEVEL SECURITY;

-- 2. 建立 restock_records (入庫紀錄) 表
CREATE TABLE IF NOT EXISTS public.restock_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) NOT NULL,
    shuttlecock_type_id UUID REFERENCES public.shuttlecock_types(id) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price INTEGER NOT NULL DEFAULT 0, -- 購入單價
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_by UUID REFERENCES auth.users
);

-- 開啟 RLS
ALTER TABLE public.restock_records ENABLE ROW LEVEL SECURITY;

-- 3. 修改 pickup_records (領取紀錄) 表
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pickup_records' AND column_name='shuttlecock_type_id') THEN
        ALTER TABLE public.pickup_records ADD COLUMN shuttlecock_type_id UUID REFERENCES public.shuttlecock_types(id);
    END IF;
END $$;

-- 4. 資料遷移：建立預設球種並遷移舊資料

DO $$
DECLARE
    g_rec RECORD;
    default_type_id UUID;
    last_config RECORD;
    sys_default_name TEXT := '預設系統球種';
BEGIN
    -- 遍歷所有團體
    FOR g_rec IN SELECT id FROM public.groups LOOP
        -- 檢查是否已有該團體的預設球種，若無則建立
        SELECT id INTO default_type_id FROM public.shuttlecock_types 
        WHERE group_id = g_rec.id AND name = sys_default_name LIMIT 1;
        
        IF default_type_id IS NULL THEN
            INSERT INTO public.shuttlecock_types (group_id, brand, name, is_active)
            VALUES (g_rec.id, 'System', sys_default_name, true)
            RETURNING id INTO default_type_id;
        END IF;

        -- 遷移 inventory_config 到 restock_records
        -- 邏輯：取最後一筆 inventory_config 作為初始庫存記錄
        -- 注意：這是一個簡化的遷移，假設最後一次設定就是當前的"總累積入庫量" (或者是初始量，視原系統邏輯而定)
        -- 原邏輯 inventory_summary 是: last(initial_quantity) - sum(pickup)
        -- 所以我們把 last(initial_quantity) 視為一次性的 "初始入庫"
        FOR last_config IN SELECT initial_quantity, created_at 
                           FROM public.inventory_config 
                           WHERE group_id = g_rec.id AND initial_quantity > 0
                           ORDER BY created_at DESC LIMIT 1 
        LOOP
            -- 檢查是否已經遷移過 (避免重複執行導致重複資料)
            IF NOT EXISTS (SELECT 1 FROM public.restock_records WHERE group_id = g_rec.id AND created_at = last_config.created_at) THEN
                INSERT INTO public.restock_records (group_id, shuttlecock_type_id, quantity, unit_price, created_at)
                VALUES (g_rec.id, default_type_id, last_config.initial_quantity, 0, last_config.created_at);
            END IF;
        END LOOP;

        -- 更新該團體的 pickup_records，補上 shuttlecock_type_id
        UPDATE public.pickup_records 
        SET shuttlecock_type_id = default_type_id 
        WHERE group_id = g_rec.id AND shuttlecock_type_id IS NULL;
        
    END LOOP;
END $$;

-- 將 shuttlecock_type_id 設為 NOT NULL (遷移後)
ALTER TABLE public.pickup_records ALTER COLUMN shuttlecock_type_id SET NOT NULL;


-- 5. 更新檢視表 inventory_summary
DROP VIEW IF EXISTS public.inventory_summary;

CREATE VIEW public.inventory_summary AS
WITH restock_stats AS (
    SELECT shuttlecock_type_id, SUM(quantity) as total_qty
    FROM public.restock_records
    GROUP BY shuttlecock_type_id
),
pickup_stats AS (
    SELECT shuttlecock_type_id, SUM(quantity) as total_qty
    FROM public.pickup_records
    GROUP BY shuttlecock_type_id
)
SELECT 
    g.id as group_id,
    st.id as shuttlecock_type_id,
    st.brand,
    st.name,
    COALESCE(rs.total_qty, 0) as total_restocked,
    COALESCE(ps.total_qty, 0) as total_picked,
    COALESCE(rs.total_qty, 0) - COALESCE(ps.total_qty, 0) as current_stock
FROM public.groups g
JOIN public.shuttlecock_types st ON g.id = st.group_id
LEFT JOIN restock_stats rs ON st.id = rs.shuttlecock_type_id
LEFT JOIN pickup_stats ps ON st.id = ps.shuttlecock_type_id;


-- 6. 設定 RLS 策略

-- Shuttlecock Types
DROP POLICY IF EXISTS "Group members can view types" ON public.shuttlecock_types;
DROP POLICY IF EXISTS "Group admins can manage types" ON public.shuttlecock_types;

CREATE POLICY "Group members can view types" ON public.shuttlecock_types
    FOR SELECT USING (group_id = (SELECT group_id FROM public.profiles WHERE id = auth.uid()));
    
CREATE POLICY "Group admins can manage types" ON public.shuttlecock_types
    FOR ALL USING (
        group_id = (SELECT group_id FROM public.profiles WHERE id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.groups WHERE id = shuttlecock_types.group_id AND created_by = auth.uid())
    );

-- Restock Records
DROP POLICY IF EXISTS "Group members can view restock" ON public.restock_records;
DROP POLICY IF EXISTS "Group admins can manage restock" ON public.restock_records; -- Keep for cleanup of potential old names
DROP POLICY IF EXISTS "Group members can create restock" ON public.restock_records;

CREATE POLICY "Group members can view restock" ON public.restock_records
    FOR SELECT USING (group_id = (SELECT group_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Group members can create restock" ON public.restock_records
    FOR INSERT WITH CHECK (group_id = (SELECT group_id FROM public.profiles WHERE id = auth.uid()));
    
-- Pickup Records (既有的策略可能需要更新，這裡確保沒問題)
-- 使用既有的 "Group members can access pickup_records" 即可，因為它只檢查 group_id

-- 7. 讓 view 安全性設為 invoker
ALTER VIEW public.inventory_summary SET (security_invoker = on);
