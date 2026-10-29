-- Dare MVP. The doer never stakes money. Funded bounties are separate charges
-- and transfers. Solo misses are marked donated; nothing here pays a charity API.

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username text,
  handle text,
  display_name text,
  email text,
  avatar_url text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  stripe_account_id text,
  payouts_enabled boolean NOT NULL DEFAULT false,
  dob date,
  age_confirmed boolean NOT NULL DEFAULT false,
  is_admin boolean NOT NULL DEFAULT false
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS handle text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stripe_account_id text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS payouts_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dob date;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS age_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.charities (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

INSERT INTO public.charities (id, name, url, active) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Swiss Red Cross', 'https://www.redcross.ch', true),
  ('22222222-2222-4222-8222-222222222222', 'Médecins Sans Frontières', 'https://www.msf.ch', true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.dares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.users (id),
  doer_id uuid REFERENCES public.users (id),
  mode text NOT NULL CHECK (mode IN ('funded', 'solo')),
  title text NOT NULL,
  rules text NOT NULL,
  category text NOT NULL CHECK (category IN ('fitness', 'skills', 'habits')),
  proof_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  deadline_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN (
    'draft', 'open', 'accepted', 'proof_submitted', 'in_review',
    'completed', 'failed', 'refunded', 'paid_out', 'cancelled'
  )),
  charity_id uuid REFERENCES public.charities (id),
  currency text NOT NULL DEFAULT 'CHF',
  created_at timestamptz NOT NULL DEFAULT now(),
  code_word text,
  gesture text,
  dispute_window_ends_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.fundings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dare_id uuid NOT NULL REFERENCES public.dares (id) ON DELETE CASCADE,
  funder_id uuid REFERENCES public.users (id),
  amount_cents integer NOT NULL CHECK (amount_cents BETWEEN 1000 AND 10000),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text,
  capture_method text NOT NULL DEFAULT 'automatic' CHECK (capture_method IN ('automatic', 'manual')),
  status text NOT NULL CHECK (status IN ('pending', 'captured', 'refunded', 'transferred', 'donated')),
  refund_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dare_id uuid NOT NULL REFERENCES public.dares (id) ON DELETE CASCADE,
  doer_id uuid NOT NULL REFERENCES public.users (id),
  storage_path text NOT NULL,
  duration_s integer NOT NULL,
  sha256 text NOT NULL,
  code_word text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  ai_verdict text CHECK (ai_verdict IN ('pass', 'fail', 'unsure')),
  ai_confidence numeric,
  ai_rationale text,
  ai_model text,
  review_status text NOT NULL DEFAULT 'none' CHECK (review_status IN ('none', 'pending', 'approved', 'rejected')),
  reviewer_id uuid REFERENCES public.users (id),
  reviewed_at timestamptz,
  rep_count integer,
  cut_detected boolean
);

CREATE TABLE IF NOT EXISTS public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dare_id uuid NOT NULL REFERENCES public.dares (id) ON DELETE CASCADE,
  opened_by uuid NOT NULL REFERENCES public.users (id),
  reason text NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dare_id uuid NOT NULL UNIQUE REFERENCES public.dares (id) ON DELETE CASCADE,
  stripe_transfer_id text UNIQUE,
  gross_cents integer NOT NULL,
  fee_cents integer NOT NULL,
  net_cents integer NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'transferred', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.events (
  id bigserial PRIMARY KEY,
  dare_id uuid REFERENCES public.dares (id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS dares_deadline_status_idx ON public.dares (deadline_at, status);
CREATE INDEX IF NOT EXISTS fundings_dare_idx ON public.fundings (dare_id);
CREATE INDEX IF NOT EXISTS proofs_dare_idx ON public.proofs (dare_id);
CREATE INDEX IF NOT EXISTS proofs_sha_idx ON public.proofs (sha256);

-- One settlement row per parked USDC challenge, so a second settle cannot double-count.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'settlement_records_one_per_challenge'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX settlement_records_one_per_challenge ON public.settlement_records (challenge_id);
    EXCEPTION WHEN undefined_table OR unique_violation THEN
      NULL;
    END;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.transition_dare(p_id uuid, p_to text)
RETURNS public.dares
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.dares;
  allowed boolean;
BEGIN
  SELECT * INTO rec FROM public.dares WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dare not found';
  END IF;
  allowed := CASE rec.status
    WHEN 'draft' THEN p_to IN ('open', 'cancelled')
    WHEN 'open' THEN p_to IN ('accepted', 'cancelled', 'failed')
    WHEN 'accepted' THEN p_to IN ('proof_submitted', 'failed', 'cancelled')
    WHEN 'proof_submitted' THEN p_to IN ('in_review', 'completed', 'failed', 'accepted')
    WHEN 'in_review' THEN p_to IN ('completed', 'failed', 'accepted')
    WHEN 'completed' THEN p_to IN ('paid_out', 'refunded', 'in_review')
    WHEN 'failed' THEN p_to IN ('refunded')
    WHEN 'cancelled' THEN p_to IN ('refunded')
    ELSE false
  END;
  IF NOT allowed THEN
    RAISE EXCEPTION 'illegal dare transition % -> %', rec.status, p_to;
  END IF;
  UPDATE public.dares SET status = p_to WHERE id = p_id RETURNING * INTO rec;
  INSERT INTO public.events (dare_id, type, payload)
  VALUES (p_id, 'status', jsonb_build_object('to', p_to));
  RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_dare_payout(p_id uuid, p_gross integer, p_fee integer, p_net integer)
RETURNS TABLE (claimed boolean, payout_id uuid, stripe_transfer_id text, net_cents integer, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.dares;
  p public.payouts;
BEGIN
  SELECT * INTO d FROM public.dares WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dare not found';
  END IF;
  SELECT * INTO p FROM public.payouts WHERE dare_id = p_id;
  IF p.id IS NOT NULL THEN
    claimed := false;
    payout_id := p.id;
    stripe_transfer_id := p.stripe_transfer_id;
    net_cents := p.net_cents;
    status := p.status;
    RETURN NEXT;
    RETURN;
  END IF;
  IF d.status <> 'completed' THEN
    RAISE EXCEPTION 'cannot claim payout from %', d.status;
  END IF;
  IF d.dispute_window_ends_at IS NOT NULL AND d.dispute_window_ends_at > now() THEN
    RAISE EXCEPTION 'dispute window open';
  END IF;
  PERFORM public.transition_dare(p_id, 'paid_out');
  INSERT INTO public.payouts (dare_id, gross_cents, fee_cents, net_cents, status)
  VALUES (p_id, p_gross, p_fee, p_net, 'pending')
  RETURNING * INTO p;
  claimed := true;
  payout_id := p.id;
  stripe_transfer_id := p.stripe_transfer_id;
  net_cents := p.net_cents;
  status := p.status;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_doer_funding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  doer uuid;
BEGIN
  SELECT doer_id INTO doer FROM public.dares WHERE id = NEW.dare_id;
  IF doer IS NOT NULL AND doer = NEW.funder_id THEN
    RAISE EXCEPTION 'doer cannot fund their own dare';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fundings_doer_cannot_fund ON public.fundings;
CREATE TRIGGER fundings_doer_cannot_fund
  BEFORE INSERT ON public.fundings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_doer_funding();

CREATE OR REPLACE FUNCTION public.protect_user_privileged_cols()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  NEW.stripe_account_id := OLD.stripe_account_id;
  NEW.payouts_enabled := OLD.payouts_enabled;
  NEW.is_admin := OLD.is_admin;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_protect_privileged ON public.users;
CREATE TRIGGER users_protect_privileged
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_privileged_cols();

REVOKE ALL ON FUNCTION public.transition_dare(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_dare_payout(uuid, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_dare(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_dare_payout(uuid, integer, integer, integer) TO service_role;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fundings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.proofs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payouts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events FORCE ROW LEVEL SECURITY;

-- Invite links are unlisted: knowing the id can read a non-draft dare. Proofs stay private.
DROP POLICY IF EXISTS dares_select ON public.dares;
CREATE POLICY dares_select ON public.dares FOR SELECT
  USING (
    status <> 'draft'
    OR creator_id = auth.uid()
    OR doer_id = auth.uid()
  );

DROP POLICY IF EXISTS dares_insert_own ON public.dares;
CREATE POLICY dares_insert_own ON public.dares FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND status IN ('open', 'accepted')
    AND currency = 'CHF'
    AND (doer_id IS NULL OR doer_id = auth.uid())
  );

DROP POLICY IF EXISTS users_select_self ON public.users;
CREATE POLICY users_select_self ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin = true);

DROP POLICY IF EXISTS users_update_self ON public.users;
CREATE POLICY users_update_self ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS users_insert_self ON public.users;
CREATE POLICY users_insert_self ON public.users FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND is_admin = false AND payouts_enabled = false AND stripe_account_id IS NULL);

DROP POLICY IF EXISTS charities_select ON public.charities;
CREATE POLICY charities_select ON public.charities FOR SELECT USING (active = true);

DROP POLICY IF EXISTS proofs_select ON public.proofs;
CREATE POLICY proofs_select ON public.proofs FOR SELECT TO authenticated
  USING (
    doer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.dares d
      WHERE d.id = proofs.dare_id
        AND (d.creator_id = auth.uid() OR d.doer_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.fundings f
      WHERE f.dare_id = proofs.dare_id AND f.funder_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_admin = true
    )
  );

DROP POLICY IF EXISTS fundings_select ON public.fundings;
CREATE POLICY fundings_select ON public.fundings FOR SELECT TO authenticated
  USING (
    funder_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.dares d
      WHERE d.id = fundings.dare_id
        AND (d.creator_id = auth.uid() OR d.doer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS payouts_select ON public.payouts;
CREATE POLICY payouts_select ON public.payouts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dares d
      WHERE d.id = payouts.dare_id
        AND (d.doer_id = auth.uid() OR d.creator_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true)
  );

DROP POLICY IF EXISTS disputes_select ON public.disputes;
CREATE POLICY disputes_select ON public.disputes FOR SELECT TO authenticated
  USING (
    opened_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.dares d
      WHERE d.id = disputes.dare_id AND (d.creator_id = auth.uid() OR d.doer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS events_select ON public.events;
CREATE POLICY events_select ON public.events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dares d
      WHERE d.id = events.dare_id
        AND (d.creator_id = auth.uid() OR d.doer_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true)
  );

-- Authenticated clients cannot write money or proof rows. Service role bypasses RLS.
REVOKE INSERT, UPDATE, DELETE ON public.fundings FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.proofs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payouts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.disputes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.events FROM anon, authenticated;
REVOKE ALL ON public.stripe_webhook_events FROM anon, authenticated;
GRANT SELECT ON public.fundings TO authenticated;
GRANT SELECT ON public.proofs TO authenticated;
GRANT SELECT ON public.payouts TO authenticated;
GRANT SELECT ON public.disputes TO authenticated;
GRANT SELECT ON public.events TO authenticated;
GRANT SELECT ON public.dares TO anon, authenticated;
GRANT SELECT ON public.charities TO anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('proofs', 'proofs', false, 209715200)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 209715200;
