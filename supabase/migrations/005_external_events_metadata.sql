ALTER TABLE external_calendar_events
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';
