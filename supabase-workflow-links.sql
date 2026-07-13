-- KOL 工作台：邀约、寄样、合作历史稳定关联迁移
-- 可在 Supabase Dashboard -> SQL Editor 中整段执行，可重复执行。

BEGIN;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS source_invitation_id UUID;

ALTER TABLE public.collaborations
  ADD COLUMN IF NOT EXISTS shipment_id UUID;

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

COMMIT;

NOTIFY pgrst, 'reload schema';
