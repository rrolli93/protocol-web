-- Create settlement_records table for challenge settlement engine
CREATE TABLE IF NOT EXISTS settlement_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  settled_at timestamptz NOT NULL DEFAULT now(),
  total_pot numeric(12,2) NOT NULL DEFAULT 0,
  winner_count integer NOT NULL DEFAULT 0,
  loser_count integer NOT NULL DEFAULT 0,
  platform_fee numeric(12,2) NOT NULL DEFAULT 0,
  winner_payout numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add winner and payout_amount columns to challenge_participants
ALTER TABLE challenge_participants
  ADD COLUMN IF NOT EXISTS winner boolean,
  ADD COLUMN IF NOT EXISTS payout_amount numeric(12,2) DEFAULT 0;

-- Indexes (using ends_at column which is the actual column name in challenges)
CREATE INDEX IF NOT EXISTS idx_settlement_records_challenge ON settlement_records(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenges_ends_at_status ON challenges(ends_at, status);

-- RLS
ALTER TABLE settlement_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'settlement_records' AND policyname = 'settlement_records_read'
  ) THEN
    CREATE POLICY "settlement_records_read" ON settlement_records FOR SELECT USING (true);
  END IF;
END $$;
