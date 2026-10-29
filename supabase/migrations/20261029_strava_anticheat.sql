-- Strava anti-cheat. Apply after 20261029_dare_mvp.sql.
-- Tokens are service-role only. Authenticated clients cannot read them.

ALTER TABLE public.dares ADD COLUMN IF NOT EXISTS proof_kind text NOT NULL DEFAULT 'video';
ALTER TABLE public.dares ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE public.dares ADD COLUMN IF NOT EXISTS proof_issued_at timestamptz;
ALTER TABLE public.dares ADD COLUMN IF NOT EXISTS strava_activity text;
ALTER TABLE public.dares ADD COLUMN IF NOT EXISTS strava_min_distance_m integer;
ALTER TABLE public.dares ADD COLUMN IF NOT EXISTS strava_min_elevation_m integer;
ALTER TABLE public.dares ADD COLUMN IF NOT EXISTS strava_max_pace_sec_per_km integer;

ALTER TABLE public.dares DROP CONSTRAINT IF EXISTS dares_proof_kind_check;
ALTER TABLE public.dares ADD CONSTRAINT dares_proof_kind_check CHECK (proof_kind IN ('video', 'strava'));

ALTER TABLE public.proofs ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'video';
ALTER TABLE public.proofs ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.proofs ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.proofs ADD COLUMN IF NOT EXISTS captured_at timestamptz;
ALTER TABLE public.proofs ADD COLUMN IF NOT EXISTS strava_activity_id text;
ALTER TABLE public.proofs ADD COLUMN IF NOT EXISTS strava_name text;
ALTER TABLE public.proofs ADD COLUMN IF NOT EXISTS strava_distance_m integer;
ALTER TABLE public.proofs ADD COLUMN IF NOT EXISTS strava_moving_time_s integer;
ALTER TABLE public.proofs ADD COLUMN IF NOT EXISTS strava_elevation_m integer;
ALTER TABLE public.proofs ADD COLUMN IF NOT EXISTS strava_polyline text;
ALTER TABLE public.proofs ADD COLUMN IF NOT EXISTS strava_device_name text;

CREATE UNIQUE INDEX IF NOT EXISTS proofs_strava_activity_idx
  ON public.proofs (dare_id, strava_activity_id)
  WHERE strava_activity_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.strava_connections (
  user_id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  athlete_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  scope text NOT NULL,
  demo boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS strava_connections_athlete_idx ON public.strava_connections (athlete_id);

ALTER TABLE public.strava_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_connections FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.strava_connections FROM anon, authenticated;
GRANT ALL ON public.strava_connections TO service_role;
