-- ==========================================
-- Migration: 2026-06-22 為開團活動新增「用球數」欄位
-- 追蹤每場活動實際使用的羽球顆數（顆）。
-- nullable：NULL 代表尚未記錄，與 0 顆（確實沒用球）區分。
-- ==========================================

ALTER TABLE public.badminton_events
  ADD COLUMN shuttle_count INTEGER
    CHECK (shuttle_count IS NULL OR shuttle_count >= 0);

COMMENT ON COLUMN public.badminton_events.shuttle_count
  IS '本場用球數（顆）；NULL = 尚未記錄。庫存計算單位為桶（12 顆/桶），此處以顆為單位顯示。';
