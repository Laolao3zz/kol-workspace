BEGIN;

DO $$
DECLARE
  source_count INTEGER;
  target_count INTEGER;
  source_kol public.kols%ROWTYPE;
  target_kol public.kols%ROWTYPE;
BEGIN
  SELECT count(*) INTO source_count
  FROM public.kols
  WHERE name = 'KÎÖ ÐÎÊKÎÑ'
    AND lower(btrim(coalesce(email, ''))) = 'kiodiekin@gmail.com';

  IF source_count = 0 THEN
    RAISE NOTICE 'The duplicate Kio Diekin record has already been merged.';
    RETURN;
  END IF;

  SELECT count(*) INTO target_count
  FROM public.kols
  WHERE name = 'Kio Diekin'
    AND lower(btrim(coalesce(email, ''))) = 'kiodiekin@gmail.com';

  IF source_count <> 1 OR target_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one source and one target Kio Diekin record; found source %, target %.', source_count, target_count;
  END IF;

  SELECT * INTO source_kol
  FROM public.kols
  WHERE name = 'KÎÖ ÐÎÊKÎÑ'
    AND lower(btrim(coalesce(email, ''))) = 'kiodiekin@gmail.com'
  FOR UPDATE;

  SELECT * INTO target_kol
  FROM public.kols
  WHERE name = 'Kio Diekin'
    AND lower(btrim(coalesce(email, ''))) = 'kiodiekin@gmail.com'
  FOR UPDATE;

  UPDATE public.invitations SET kol_id = target_kol.id WHERE kol_id = source_kol.id;
  UPDATE public.shipments SET kol_id = target_kol.id WHERE kol_id = source_kol.id;
  UPDATE public.collaborations SET kol_id = target_kol.id WHERE kol_id = source_kol.id;
  UPDATE public.emails SET kol_id = target_kol.id WHERE kol_id = source_kol.id;

  UPDATE public.kols
  SET
    followers = coalesce(nullif(btrim(target_kol.followers), ''), source_kol.followers),
    country = coalesce(nullif(btrim(target_kol.country), ''), source_kol.country),
    tags = (
      SELECT coalesce(array_agg(DISTINCT tag ORDER BY tag), '{}')
      FROM unnest(coalesce(target_kol.tags, '{}') || coalesce(source_kol.tags, '{}')) AS tag
      WHERE btrim(tag) <> ''
    ),
    notes = CASE
      WHEN nullif(btrim(source_kol.notes), '') IS NULL THEN target_kol.notes
      WHEN nullif(btrim(target_kol.notes), '') IS NULL THEN source_kol.notes
      WHEN btrim(target_kol.notes) = btrim(source_kol.notes) THEN target_kol.notes
      ELSE target_kol.notes || E'\n' || source_kol.notes
    END,
    shipping_details = coalesce(nullif(btrim(target_kol.shipping_details), ''), source_kol.shipping_details),
    sample_product = coalesce(nullif(btrim(source_kol.sample_product), ''), target_kol.sample_product),
    sample_date = coalesce(source_kol.sample_date, target_kol.sample_date),
    tracking_number = coalesce(nullif(btrim(source_kol.tracking_number), ''), target_kol.tracking_number),
    blacklisted_at = coalesce(target_kol.blacklisted_at, source_kol.blacklisted_at),
    blacklist_reason = coalesce(nullif(btrim(target_kol.blacklist_reason), ''), source_kol.blacklist_reason),
    status = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.shipments
        WHERE kol_id = target_kol.id AND archived_at IS NULL
          AND completed_at IS NULL AND progress_status IS DISTINCT FROM '已完成'
          AND status = '已签收'
      ) THEN '内容跟进'
      WHEN EXISTS (
        SELECT 1 FROM public.shipments
        WHERE kol_id = target_kol.id AND archived_at IS NULL
          AND completed_at IS NULL AND progress_status IS DISTINCT FROM '已完成'
          AND (status = '运输中' OR nullif(btrim(tracking_number), '') IS NOT NULL)
      ) THEN '运输中'
      WHEN EXISTS (
        SELECT 1 FROM public.shipments
        WHERE kol_id = target_kol.id AND archived_at IS NULL
          AND completed_at IS NULL AND progress_status IS DISTINCT FROM '已完成'
      ) THEN '待寄出'
      ELSE target_kol.status
    END,
    updated_at = now()
  WHERE id = target_kol.id;

  IF EXISTS (SELECT 1 FROM public.invitations WHERE kol_id = source_kol.id)
    OR EXISTS (SELECT 1 FROM public.shipments WHERE kol_id = source_kol.id)
    OR EXISTS (SELECT 1 FROM public.collaborations WHERE kol_id = source_kol.id)
    OR EXISTS (SELECT 1 FROM public.emails WHERE kol_id = source_kol.id) THEN
    RAISE EXCEPTION 'References remain on the duplicate Kio Diekin record.';
  END IF;

  DELETE FROM public.kols WHERE id = source_kol.id;
END $$;

COMMIT;
