-- 建立庫存設定表
CREATE TABLE public.inventory_config (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    initial_quantity INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 建立領取紀錄表
CREATE TABLE public.pickup_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    picker_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 插入預設庫存設定 (預設 100 桶)
INSERT INTO public.inventory_config (initial_quantity) VALUES (100);

-- 建立檢視表以計算剩餘庫存
CREATE VIEW public.inventory_summary AS
SELECT 
    (SELECT initial_quantity FROM public.inventory_config ORDER BY created_at DESC LIMIT 1) as initial_stock,
    COALESCE(SUM(quantity), 0) as total_picked,
    (SELECT initial_quantity FROM public.inventory_config ORDER BY created_at DESC LIMIT 1) - COALESCE(SUM(quantity), 0) as current_stock
FROM public.pickup_records;

-- 開放 RLS (Row Level Security) - 這裡先設為公開訪問，實際運作建議加入驗證
ALTER TABLE public.inventory_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-write for inventory_config" ON public.inventory_config FOR ALL USING (true);
CREATE POLICY "Allow public read-write for pickup_records" ON public.pickup_records FOR ALL USING (true);
