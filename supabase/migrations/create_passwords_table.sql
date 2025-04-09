/*
  # Create passwords table and policies

  This migration creates the `passwords` table to store user-saved passwords
  and sets up Row Level Security (RLS) policies to ensure users can only
  access and manage their own passwords.

  1. New Tables
     - `passwords`
       - `id` (uuid, primary key, default: gen_random_uuid()) - Unique identifier for the password entry.
       - `user_id` (uuid, foreign key to `auth.users`) - Links the password to the authenticated user. Indexed for performance.
       - `password_text` (text, not null) - The saved password string. Consider encryption in a real production scenario.
       - `label` (text, nullable) - An optional user-defined label for the password.
       - `created_at` (timestamptz, default: now()) - Timestamp of when the password was saved.

  2. Security
     - Enable RLS on `passwords` table.
     - Policy "Users can view their own passwords": Allows authenticated users to SELECT their own passwords.
     - Policy "Users can insert their own passwords": Allows authenticated users to INSERT passwords linked to their own user ID.
     - Policy "Users can delete their own passwords": Allows authenticated users to DELETE their own passwords.

  3. Indexes
     - Create an index on the `user_id` column for faster lookups.
*/

-- 1. Create Table
CREATE TABLE IF NOT EXISTS passwords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  password_text text NOT NULL,
  label text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create index for user_id lookup
CREATE INDEX IF NOT EXISTS idx_passwords_user_id ON passwords(user_id);

-- 2. Enable RLS
ALTER TABLE passwords ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies
CREATE POLICY "Users can view their own passwords"
  ON passwords
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own passwords"
  ON passwords
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own passwords"
  ON passwords
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Note: An UPDATE policy is omitted for simplicity, but would follow a similar pattern:
-- CREATE POLICY "Users can update their own passwords"
--   ON passwords
--   FOR UPDATE
--   TO authenticated
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);