-- 1. 建立團體表
CREATE TABLE public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_email TEXT,
    restock_password TEXT,
    created_by UUID REFERENCES auth.users,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. 建立使用者擴充資料表 (Profiles)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id),
    full_name TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. 修改庫存設定表 (加入 group_id)
CREATE TABLE public.inventory_config (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    group_id UUID REFERENCES public.groups(id) NOT NULL,
    initial_quantity INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. 修改領取紀錄表 (加入 group_id)
CREATE TABLE public.pickup_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) NOT NULL,
    picker_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. 建立檢視表以計算剩餘庫存 (依據 group_id)
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

-- 6. 開放 RLS (Row Level Security)
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_records ENABLE ROW LEVEL SECURITY;

-- 7. RLS 策略

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

-- Profiles: 使用者只能查看與修改自己的 Profile，以及允許建立自己的 Profile
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

-- 8. 自動為新使用者建立 Profile 的 Trigger (選用)
-- 這部分可以在前端註冊時處理，或者用 DB Trigger

-- 修改現有的視圖，將其安全性設定為 invoker
alter view public.inventory_summary 
set (security_invoker = on);