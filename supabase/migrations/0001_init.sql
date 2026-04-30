-- Initial schema for Habitly
-- Creates tables with proper indexes and Row Level Security policies
-- Ensures user data isolation per GDPR requirements

-- Enable RLS on auth.users (should already be enabled)
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Habits table
CREATE TABLE habits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) >= 1 AND length(trim(name)) <= 80),
  description TEXT CHECK (description IS NULL OR length(description) <= 500),
  color TEXT NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Completions table
CREATE TABLE completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(habit_id, completed_on)
);

-- Performance indexes per guardrails requirements
CREATE INDEX idx_habits_user_archived ON habits(user_id, archived);
CREATE INDEX idx_completions_habit_date ON completions(habit_id, completed_on DESC);
CREATE INDEX idx_completions_user_date ON completions(user_id, completed_on);

-- Row Level Security policies
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE completions ENABLE ROW LEVEL SECURITY;

-- Habits policies
CREATE POLICY "Users can view own habits" ON habits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own habits" ON habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own habits" ON habits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own habits" ON habits
  FOR DELETE USING (auth.uid() = user_id);

-- Completions policies
CREATE POLICY "Users can view own completions" ON completions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own completions" ON completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own completions" ON completions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own completions" ON completions
  FOR DELETE USING (auth.uid() = user_id);

-- Additional constraint: completions.user_id must match habits.user_id
ALTER TABLE completions ADD CONSTRAINT completions_user_habit_match
  CHECK (user_id = (SELECT user_id FROM habits WHERE id = habit_id));