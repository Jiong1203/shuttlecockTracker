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