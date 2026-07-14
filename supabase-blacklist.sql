ALTER TABLE public.kols
  ADD COLUMN IF NOT EXISTS blacklisted_at TIMESTAMPTZ;

ALTER TABLE public.kols
  ADD COLUMN IF NOT EXISTS blacklist_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_kols_blacklisted_at
  ON public.kols (blacklisted_at)
  WHERE blacklisted_at IS NOT NULL;
