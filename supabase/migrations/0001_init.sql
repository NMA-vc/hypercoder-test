-- Habitly Database Schema
-- Creates tables for habits and completions with RLS policies

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Habits table
CREATE TABLE IF NOT EXISTS habits (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
    description text CHECK (description IS NULL OR length(description) <= 500),
    color text NOT NULL DEFAULT '#3b82f6' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    archived boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Completions table
CREATE TABLE IF NOT EXISTS completions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    completed_on date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(habit_id, completed_on)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_habits_user_archived ON habits(user_id, archived);
CREATE INDEX IF NOT EXISTS idx_completions_habit_date ON completions(habit_id, completed_on DESC);
CREATE INDEX IF NOT EXISTS idx_completions_user_date ON completions(user_id, completed_on);

-- Enable Row Level Security
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for habits table
CREATE POLICY "Users can view their own habits" ON habits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own habits" ON habits
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own habits" ON habits
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own habits" ON habits
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for completions table
CREATE POLICY "Users can view their own completions" ON completions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own completions" ON completions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own completions" ON completions
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own completions" ON completions
    FOR DELETE USING (auth.uid() = user_id);