-- ==========================================
-- Migration: 2026-04-01 add club/event/attendee tables for 開團紀錄 module
-- ==========================================

-- 球團（隸屬於 group，使用 PIN 進行二次驗證）
CREATE TABLE public.clubs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  leader_name  TEXT NOT NULL,
  pin_hash     TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 活動（隸屬於 club）
CREATE TABLE public.badminton_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id            UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  event_date         DATE NOT NULL,
  venue_name         TEXT,
  court_count        INT NOT NULL DEFAULT 1 CHECK (court_count > 0),
  hours              NUMERIC(4,1) NOT NULL CHECK (hours > 0),
  hourly_rate        NUMERIC(10,2) NOT NULL CHECK (hourly_rate >= 0),
  shuttle_cost_mode  TEXT NOT NULL DEFAULT 'manual'
                       CHECK (shuttle_cost_mode IN ('auto', 'manual')),
  shuttle_cost       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shuttle_cost >= 0),
  is_settled         BOOLEAN NOT NULL DEFAULT false,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 出席者（隸屬於活動，每場獨立，無固定名冊）
CREATE TABLE public.event_attendees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.badminton_events(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  fee           NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  paid          BOOLEAN NOT NULL DEFAULT false,
  is_free       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- 效能索引
-- ----------------------------------------
CREATE INDEX idx_clubs_group_id
  ON public.clubs (group_id);

CREATE INDEX idx_badminton_events_club_date
  ON public.badminton_events (club_id, event_date DESC);

CREATE INDEX idx_event_attendees_event_id
  ON public.event_attendees (event_id);

-- ----------------------------------------
-- Row Level Security
-- ----------------------------------------
ALTER TABLE public.clubs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badminton_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees  ENABLE ROW LEVEL SECURITY;

-- clubs：只能存取自己 group 底下的 clubs
CREATE POLICY "clubs_group_isolation" ON public.clubs
  FOR ALL
  USING (
    group_id = (
      SELECT p.group_id FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- badminton_events：透過 club → group 隔離
CREATE POLICY "events_group_isolation" ON public.badminton_events
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

-- event_attendees：透過 event → club → group 隔離
CREATE POLICY "attendees_group_isolation" ON public.event_attendees
  FOR ALL
  USING (
    event_id IN (
      SELECT e.id FROM public.badminton_events e
      WHERE e.club_id IN (
        SELECT c.id FROM public.clubs c
        WHERE c.group_id = (
          SELECT p.group_id FROM public.profiles p
          WHERE p.id = auth.uid()
        )
      )
    )
  );
