-- KOL 工作台：邀约、寄样、合作历史稳定关联迁移
-- 可在 Supabase Dashboard -> SQL Editor 中整段执行，可重复执行。

BEGIN;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS source_invitation_id UUID;

ALTER TABLE public.collaborations
  ADD COLUMN IF NOT EXISTS shipment_id UUID;

-- 兼容旧库：RPC 会读取这些 V5/V6 字段，先补齐再创建函数。
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS progress_status TEXT DEFAULT '待制作';

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS progress_notes TEXT;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS expected_publish_date DATE;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS completed_at DATE;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS quoted_fee TEXT;

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS decision TEXT DEFAULT '待评估';

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS decision_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shipments_source_invitation_id_fkey'
      AND conrelid = 'public.shipments'::regclass
  ) THEN
    ALTER TABLE public.shipments
      ADD CONSTRAINT shipments_source_invitation_id_fkey
      FOREIGN KEY (source_invitation_id)
      REFERENCES public.invitations(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'collaborations_shipment_id_fkey'
      AND conrelid = 'public.collaborations'::regclass
  ) THEN
    ALTER TABLE public.collaborations
      ADD CONSTRAINT collaborations_shipment_id_fkey
      FOREIGN KEY (shipment_id)
      REFERENCES public.shipments(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.collaborations AS collaboration
    CROSS JOIN LATERAL regexp_matches(
      coalesce(collaboration.notes, ''),
      '\[shipment:([^]]+)\]',
      'g'
    ) AS marker(match)
    LEFT JOIN public.shipments AS shipment
      ON lower(shipment.id::text) = lower(marker.match[1])
    WHERE shipment.id IS NULL
  ) THEN
    RAISE EXCEPTION '发现无法解析或不存在的 shipment 标记，请先人工处理后重试';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.collaborations AS collaboration
    CROSS JOIN LATERAL regexp_matches(
      coalesce(collaboration.notes, ''),
      '\[shipment:([^]]+)\]',
      'g'
    ) AS marker(match)
    INNER JOIN public.shipments AS shipment
      ON lower(shipment.id::text) = lower(marker.match[1])
    WHERE collaboration.kol_id IS DISTINCT FROM shipment.kol_id
       OR (
         collaboration.shipment_id IS NOT NULL
         AND collaboration.shipment_id IS DISTINCT FROM shipment.id
       )
  ) THEN
    RAISE EXCEPTION '发现 shipment marker 与合作历史的 KOL 或既有关联不一致，请先人工处理后重试';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.collaborations AS collaboration
    CROSS JOIN LATERAL (
      SELECT count(*) AS marker_count
      FROM regexp_matches(coalesce(collaboration.notes, ''), '\[shipment:[^]]+\]', 'g')
    ) AS markers
    WHERE markers.marker_count > 1
  ) THEN
    RAISE EXCEPTION '发现合作备注包含多个 shipment 标记，请先人工拆分后重试';
  END IF;
END $$;

WITH parsed_markers AS (
  SELECT
    collaboration.id AS collaboration_id,
    substring(
      collaboration.notes
      FROM '\[shipment:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\]'
    )::UUID AS shipment_id
  FROM public.collaborations AS collaboration
  WHERE collaboration.shipment_id IS NULL
    AND collaboration.notes ~ '\[shipment:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\]'
), valid_markers AS (
  SELECT parsed.collaboration_id, parsed.shipment_id
  FROM parsed_markers AS parsed
  INNER JOIN public.shipments AS shipment ON shipment.id = parsed.shipment_id
)
UPDATE public.collaborations AS collaboration
SET shipment_id = valid.shipment_id
FROM valid_markers AS valid
WHERE collaboration.id = valid.collaboration_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT shipment_id
    FROM public.collaborations
    WHERE shipment_id IS NOT NULL
    GROUP BY shipment_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '同一寄样关联了多条合作历史，请先处理重复记录后重试';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT source_invitation_id
    FROM public.shipments
    WHERE source_invitation_id IS NOT NULL
    GROUP BY source_invitation_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '发现同一邀约关联了多条寄样记录，请先处理重复记录后重试';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_source_invitation_unique
  ON public.shipments (source_invitation_id)
  WHERE source_invitation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_collaborations_shipment_unique
  ON public.collaborations (shipment_id)
  WHERE shipment_id IS NOT NULL;

UPDATE public.collaborations
SET notes = NULLIF(
  btrim(regexp_replace(notes, '[[:space:]]*\[shipment:[^]]+\]', '', 'g')),
  ''
)
WHERE notes ~ '\[shipment:[^]]+\]';

CREATE OR REPLACE FUNCTION public.delete_stale_auto_shipment(
  p_shipment_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_expected_product TEXT,
  p_expected_source_invitation_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_shipment public.shipments%ROWTYPE;
  v_source_invitation_id UUID;
  v_reply_result TEXT;
  v_decision TEXT;
  v_has_approved_invitation BOOLEAN := false;
BEGIN
  SELECT shipment.source_invitation_id
  INTO v_source_invitation_id
  FROM public.shipments AS shipment
  WHERE shipment.id = p_shipment_id;

  IF NOT FOUND OR v_source_invitation_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT invitation.reply_result, invitation.decision
  INTO v_reply_result, v_decision
  FROM public.invitations AS invitation
  WHERE invitation.id = v_source_invitation_id
  FOR SHARE;

  v_has_approved_invitation := FOUND
    AND v_reply_result = '同意合作'
    AND v_decision = '继续推进';

  SELECT * INTO v_shipment
  FROM public.shipments
  WHERE id = p_shipment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_shipment.updated_at IS DISTINCT FROM p_expected_updated_at
     OR v_shipment.product IS DISTINCT FROM p_expected_product
     OR v_shipment.source_invitation_id IS DISTINCT FROM p_expected_source_invitation_id
     OR v_shipment.status IS DISTINCT FROM '待寄出'
     OR btrim(coalesce(v_shipment.tracking_number, '')) <> ''
     OR v_shipment.sample_date IS NOT NULL
     OR v_shipment.delivered_at IS NOT NULL
     OR v_shipment.archived_at IS NOT NULL
     OR v_shipment.completed_at IS NOT NULL
     OR v_shipment.expected_publish_date IS NOT NULL
     OR v_shipment.progress_status IS DISTINCT FROM '待制作'
     OR btrim(coalesce(v_shipment.progress_notes, '')) <> ''
     OR v_shipment.updated_at IS DISTINCT FROM v_shipment.created_at
     OR btrim(coalesce(v_shipment.notes, '')) <> '邀约同意且我方继续推进后自动生成' THEN
    RETURN false;
  END IF;

  IF v_has_approved_invitation THEN
    RETURN false;
  END IF;

  DELETE FROM public.shipments WHERE id = v_shipment.id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_invitation_with_stale_shipment(
  p_invitation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_invitation_id UUID;
  v_deleted_shipment_count INTEGER := 0;
BEGIN
  SELECT invitation.id
  INTO v_invitation_id
  FROM public.invitations AS invitation
  WHERE invitation.id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'deleted', false,
      'already_missing', true,
      'shipment_deleted', false
    );
  END IF;

  PERFORM shipment.id
  FROM public.shipments AS shipment
  WHERE shipment.source_invitation_id = p_invitation_id
  FOR UPDATE;

  DELETE FROM public.shipments AS shipment
  WHERE shipment.source_invitation_id = p_invitation_id
    AND shipment.status = '待寄出'
    AND btrim(coalesce(shipment.tracking_number, '')) = ''
    AND shipment.sample_date IS NULL
    AND shipment.delivered_at IS NULL
    AND shipment.archived_at IS NULL
    AND shipment.completed_at IS NULL
    AND shipment.expected_publish_date IS NULL
    AND shipment.progress_status = '待制作'
    AND btrim(coalesce(shipment.progress_notes, '')) = ''
    AND shipment.updated_at IS NOT DISTINCT FROM shipment.created_at
    AND btrim(coalesce(shipment.notes, '')) = '邀约同意且我方继续推进后自动生成';
  GET DIAGNOSTICS v_deleted_shipment_count = ROW_COUNT;

  DELETE FROM public.invitations
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object(
    'deleted', true,
    'already_missing', false,
    'shipment_deleted', v_deleted_shipment_count > 0
  );
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
