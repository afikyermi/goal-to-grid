-- Add explicit multi-day recurrence to user_constraints.
-- recurrence_days replaces the single day_of_week int with an array,
-- enabling Google Calendar-style recurring blocks (e.g. [1,3] = Mon+Wed).
-- day_of_week is kept for backward compatibility; code falls back to it when
-- recurrence_days is NULL (pre-migration rows).

ALTER TABLE user_constraints
  ADD COLUMN IF NOT EXISTS recurrence_days int[] DEFAULT NULL;

-- Migrate existing single-day rows: wrap the int in a single-element array.
UPDATE user_constraints
  SET recurrence_days = ARRAY[day_of_week]
  WHERE day_of_week IS NOT NULL
    AND recurrence_days IS NULL;

-- Rows with day_of_week IS NULL meant "every day" — represent as all 7 days.
UPDATE user_constraints
  SET recurrence_days = ARRAY[0,1,2,3,4,5,6]
  WHERE day_of_week IS NULL
    AND recurrence_days IS NULL;
