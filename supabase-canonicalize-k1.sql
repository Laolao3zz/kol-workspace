BEGIN;

DO $$
DECLARE
  canonical_count INTEGER;
BEGIN
  SELECT count(*) INTO canonical_count
  FROM public.products
  WHERE name = 'K1' AND status IS DISTINCT FROM '归档';

  IF canonical_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one active canonical K1 product; found %.', canonical_count;
  END IF;

  UPDATE public.invitations
  SET product = 'K1'
  WHERE lower(btrim(coalesce(product, ''))) IN ('k1', 'k1/nas', 'nas/k1')
    AND product IS DISTINCT FROM 'K1';

  UPDATE public.shipments
  SET product = 'K1', updated_at = now()
  WHERE lower(btrim(coalesce(product, ''))) IN ('k1', 'k1/nas', 'nas/k1')
    AND product IS DISTINCT FROM 'K1';

  UPDATE public.collaborations
  SET product = 'K1'
  WHERE lower(btrim(coalesce(product, ''))) IN ('k1', 'k1/nas', 'nas/k1')
    AND product IS DISTINCT FROM 'K1';

  IF EXISTS (
    SELECT 1 FROM public.invitations
    WHERE lower(btrim(coalesce(product, ''))) IN ('k1', 'k1/nas', 'nas/k1')
      AND product IS DISTINCT FROM 'K1'
  ) OR EXISTS (
    SELECT 1 FROM public.shipments
    WHERE lower(btrim(coalesce(product, ''))) IN ('k1', 'k1/nas', 'nas/k1')
      AND product IS DISTINCT FROM 'K1'
  ) OR EXISTS (
    SELECT 1 FROM public.collaborations
    WHERE lower(btrim(coalesce(product, ''))) IN ('k1', 'k1/nas', 'nas/k1')
      AND product IS DISTINCT FROM 'K1'
  ) THEN
    RAISE EXCEPTION 'Non-canonical K1 workflow references remain.';
  END IF;
END $$;

COMMIT;
