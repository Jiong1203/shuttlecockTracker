-- 球員名冊（E1）與 PIN 嘗試次數限制（B2）
--
-- 兩者皆為純新增：不修改既有欄位、不搬移既有資料，
-- 現有的出席名單維持以純文字姓名運作，member_id 為選填。

-- ----------------------------------------
-- E1：球隊常用名冊
-- ----------------------------------------
-- 同一群人每週打球，名字卻每場重打一次，打錯字就變成另一個人，
-- 導致「這個人累計來過幾次、還欠多少」在資料上無法回答。
CREATE TABLE IF NOT EXISTS public.club_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  default_fee   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (default_fee >= 0),
  is_free       BOOLEAN NOT NULL DEFAULT false,  -- 例如不收費的負責人
  is_active     BOOLEAN NOT NULL DEFAULT true,   -- 停用而非刪除，保留歷史關聯
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 同一隊內不重名，否則名冊本身就失去辨識作用
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_members_unique_name
  ON public.club_members (club_id, display_name);

CREATE INDEX IF NOT EXISTS idx_club_members_club
  ON public.club_members (club_id, is_active);

-- 出席紀錄選擇性關聯到名冊。
-- 維持 nullable：臨時來的客人仍可直接打字，不必先建檔。
-- ON DELETE SET NULL：名冊成員被刪除時，歷史出席紀錄保留姓名文字，不受影響。
ALTER TABLE public.event_attendees
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.club_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_event_attendees_member
  ON public.event_attendees (member_id);

-- RLS：透過 club → group 隔離，寫法與 badminton_events 一致
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_members_group_isolation" ON public.club_members;
CREATE POLICY "club_members_group_isolation" ON public.club_members
  FOR ALL
  USING (
    club_id IN (
      SELECT c.id FROM public.clubs c
      WHERE c.group_id = (
        SELECT p.group_id FROM public.profiles p
        WHERE p.id = auth.uid()
      )
    )
  );

-- ----------------------------------------
-- B2：PIN 連續錯誤鎖定
-- ----------------------------------------
-- 原本 PIN 可無限次嘗試，四位數僅一萬種組合，腳本幾秒即可窮舉。
-- 攻擊面雖限於已登入該球團帳號者，但 PIN 的用意本來就是防同團的其他人。
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS failed_pin_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until    TIMESTAMPTZ;

COMMENT ON COLUMN public.clubs.failed_pin_attempts IS '連續 PIN 驗證失敗次數，驗證成功時歸零';
COMMENT ON COLUMN public.clubs.pin_locked_until IS '鎖定至此時刻前不接受 PIN 驗證，NULL 表示未鎖定';
