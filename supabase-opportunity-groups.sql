-- 合作机会来源与多产品会话分组
-- 可整段复制到 Supabase SQL Editor 执行。
BEGIN;

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS conversation_id UUID DEFAULT gen_random_uuid();

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound';

UPDATE public.invitations
SET conversation_id = gen_random_uuid()
WHERE conversation_id IS NULL;

UPDATE public.invitations
SET direction = 'outbound'
WHERE direction IS NULL OR direction NOT IN ('outbound', 'inbound');

ALTER TABLE public.invitations
  ALTER COLUMN conversation_id SET NOT NULL;

ALTER TABLE public.invitations
  ALTER COLUMN direction SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invitations_direction_check'
      AND conrelid = 'public.invitations'::regclass
  ) THEN
    ALTER TABLE public.invitations
      ADD CONSTRAINT invitations_direction_check
      CHECK (direction IN ('outbound', 'inbound'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invitations_conversation_id
  ON public.invitations (conversation_id);

COMMIT;
