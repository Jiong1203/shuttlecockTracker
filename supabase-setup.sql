-- ==========================================
-- 資料庫初始化腳本：含多球種與 FIFO 支援
-- ==========================================

-- 1. 建立團體表
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_email TEXT,
    restock_password TEXT,
    created_by UUID REFERENCES auth.users,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. 建立使用者擴充資料表 (Profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id),
    full_name TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. 建立球種表 (shuttlecock_types)
CREATE TABLE IF NOT EXISTS public.shuttlecock_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) NOT NULL,
    brand TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_by UUID REFERENCES auth.users
);

-- 4. 建立入庫紀錄表 (restock_records)
CREATE TABLE IF NOT EXISTS public.restock_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) NOT NULL,
    shuttlecock_type_id UUID REFERENCES public.shuttlecock_types(id) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_by UUID REFERENCES auth.users
);

-- 5. 建立領取紀錄表 (pickup_records)
CREATE TABLE IF NOT EXISTS public.pickup_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) NOT NULL,
    shuttlecock_type_id UUID REFERENCES public.shuttlecock_types(id) NOT NULL,
    picker_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. 建立檢視表以計算剩餘庫存 (inventory_summary)
CREATE OR REPLACE VIEW public.inventory_summary AS
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
    st.is_active,
    COALESCE(rs.total_qty, 0) as total_restocked,
    COALESCE(ps.total_qty, 0) as total_picked,
    COALESCE(rs.total_qty, 0) - COALESCE(ps.total_qty, 0) as current_stock
FROM public.groups g
JOIN public.shuttlecock_types st ON g.id = st.group_id
LEFT JOIN restock_stats rs ON st.id = rs.shuttlecock_type_id
LEFT JOIN pickup_stats ps ON st.id = ps.shuttlecock_type_id;

-- 7. 設定安全性 (RLS)
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shuttlecock_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restock_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_records ENABLE ROW LEVEL SECURITY;

-- 設定 View 安全性為 invoker
ALTER VIEW public.inventory_summary SET (security_invoker = on);

-- RLS 策略 (Policies)

-- Groups
CREATE POLICY "Users can view their own group" ON public.groups
    FOR SELECT USING (
        id = (SELECT group_id FROM public.profiles WHERE id = auth.uid()) OR 
        created_by = auth.uid()
    );
CREATE POLICY "Users can create groups" ON public.groups
    FOR INSERT WITH CHECK (auth.role() = 'authenticated'); -- 簡化，允許已登入者建立
CREATE POLICY "Users can update their own group" ON public.groups
    FOR UPDATE USING (
        id = (SELECT group_id FROM public.profiles WHERE id = auth.uid()) OR 
        created_by = auth.uid()
    );

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can create own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Shuttlecock Types
CREATE POLICY "Group members can view types" ON public.shuttlecock_types
    FOR SELECT USING (group_id = (SELECT group_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Group admins/members can manage types" ON public.shuttlecock_types
    FOR ALL USING (group_id = (SELECT group_id FROM public.profiles WHERE id = auth.uid()));

-- Restock Records
CREATE POLICY "Group members can view restock" ON public.restock_records
    FOR SELECT USING (group_id = (SELECT group_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Group members can create restock" ON public.restock_records
    FOR INSERT WITH CHECK (group_id = (SELECT group_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Group members can delete restock" ON public.restock_records
    FOR DELETE USING (group_id = (SELECT group_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Group members can update restock" ON public.restock_records
    FOR UPDATE USING (group_id = (SELECT group_id FROM public.profiles WHERE id = auth.uid()));

-- Pickup Records
CREATE POLICY "Group members can access pickup_records" ON public.pickup_records
    FOR ALL USING (group_id = (SELECT group_id FROM public.profiles WHERE id = auth.uid()));

