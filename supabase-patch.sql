-- ============================================================
-- KOL 工作台数据库补丁
-- 用途：补齐 V5/V6 升级遗漏的字段，解决以下错误：
--   "Could not find the 'archived_at' column of 'shipments' in the schema cache"
--   "Could not find the 'quoted_fee' column of 'invitations' in the schema cache"
--   等同类 schema 缺失错误
--   产品永久删除需要事务内复核三张业务表引用
--
-- 执行方式：
--   1. 打开 Supabase Dashboard → SQL Editor → New query
--   2. 把整段 SQL 粘进去，点 Run（不要勾选 EXPLAIN，直接 Run）
--   3. 运行成功后回到应用刷新页面即可
--
-- 本脚本 idempotent，可重复执行
-- ============================================================

-- shipments 表：补齐 V5/V6 字段
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS progress_status TEXT DEFAULT '待制作';
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS progress_notes TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS expected_publish_date DATE;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS completed_at DATE;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- invitations 表：补齐 V6 字段
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS quoted_fee TEXT;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS decision TEXT DEFAULT '待评估';
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS decision_reason TEXT;

-- kols 表：确保 tags 字段存在
ALTER TABLE kols ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE kols ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE kols ADD COLUMN IF NOT EXISTS blacklisted_at TIMESTAMPTZ;
ALTER TABLE kols ADD COLUMN IF NOT EXISTS blacklist_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_kols_blacklisted_at ON kols (blacklisted_at) WHERE blacklisted_at IS NOT NULL;

-- products 表：真实产品主数据与产品机会匹配
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  target_kol_tags TEXT[] DEFAULT '{}',
  target_content_shapes TEXT[] DEFAULT '{}',
  status TEXT DEFAULT '在推',
  priority INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS target_kol_tags TEXT[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS target_content_shapes TEXT[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT '在推';
ALTER TABLE products ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND policyname = 'Allow all access'
  ) THEN
    CREATE POLICY "Allow all access" ON products FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);
CREATE INDEX IF NOT EXISTS idx_products_priority ON products (priority DESC);

-- 所有新建记录或产品改名都必须引用产品库中的精确名称，并锁定产品行直到写入提交
CREATE OR REPLACE FUNCTION public.enforce_managed_product_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.product IS NOT DISTINCT FROM OLD.product THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.product IS NULL OR btrim(NEW.product) = '' THEN
    RAISE EXCEPTION '产品名称不能为空' USING ERRCODE = '23503';
  END IF;

  SELECT name
  INTO v_product_name
  FROM public.products
  WHERE name = btrim(NEW.product)
    AND coalesce(status, '在推') <> '归档'
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '产品「%」不在产品库中，请先新增产品或在 KOL 档案中修正', NEW.product USING ERRCODE = '23503';
  END IF;

  NEW.product := v_product_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invitations_require_managed_product ON public.invitations;
CREATE TRIGGER invitations_require_managed_product
BEFORE INSERT OR UPDATE OF product ON public.invitations
FOR EACH ROW EXECUTE FUNCTION public.enforce_managed_product_reference();

DROP TRIGGER IF EXISTS shipments_require_managed_product ON public.shipments;
CREATE TRIGGER shipments_require_managed_product
BEFORE INSERT OR UPDATE OF product ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.enforce_managed_product_reference();

DROP TRIGGER IF EXISTS collaborations_require_managed_product ON public.collaborations;
CREATE TRIGGER collaborations_require_managed_product
BEFORE INSERT OR UPDATE OF product ON public.collaborations
FOR EACH ROW EXECUTE FUNCTION public.enforce_managed_product_reference();

-- 产品删除：锁住三张业务表，在同一事务中复核引用并删除，避免检查后新增引用的竞态
CREATE OR REPLACE FUNCTION public.delete_product_if_unreferenced(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_name TEXT;
  v_has_equivalent_sibling BOOLEAN;
  v_invitation_count INTEGER;
  v_shipment_count INTEGER;
  v_collaboration_count INTEGER;
  v_reference_count INTEGER;
BEGIN
  LOCK TABLE public.invitations, public.shipments, public.collaborations IN SHARE MODE;
  LOCK TABLE public.products IN SHARE ROW EXCLUSIVE MODE;

  SELECT name
  INTO v_product_name
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('deleted', true, 'already_missing', true, 'reference_count', 0);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.products
    WHERE id <> p_product_id
      AND lower(btrim(name)) = lower(btrim(v_product_name))
  ) INTO v_has_equivalent_sibling;

  IF v_has_equivalent_sibling THEN
    SELECT count(*) INTO v_invitation_count FROM public.invitations WHERE btrim(coalesce(product, '')) = btrim(v_product_name);
    SELECT count(*) INTO v_shipment_count FROM public.shipments WHERE btrim(coalesce(product, '')) = btrim(v_product_name);
    SELECT count(*) INTO v_collaboration_count FROM public.collaborations WHERE btrim(coalesce(product, '')) = btrim(v_product_name);
  ELSE
    SELECT count(*) INTO v_invitation_count FROM public.invitations WHERE lower(btrim(coalesce(product, ''))) = lower(btrim(v_product_name));
    SELECT count(*) INTO v_shipment_count FROM public.shipments WHERE lower(btrim(coalesce(product, ''))) = lower(btrim(v_product_name));
    SELECT count(*) INTO v_collaboration_count FROM public.collaborations WHERE lower(btrim(coalesce(product, ''))) = lower(btrim(v_product_name));
  END IF;

  v_reference_count := v_invitation_count + v_shipment_count + v_collaboration_count;
  IF v_reference_count > 0 THEN
    RETURN jsonb_build_object(
      'deleted', false,
      'reference_count', v_reference_count,
      'invitation_count', v_invitation_count,
      'shipment_count', v_shipment_count,
      'collaboration_count', v_collaboration_count
    );
  END IF;

  DELETE FROM public.products WHERE id = p_product_id;
  RETURN jsonb_build_object('deleted', true, 'already_missing', false, 'reference_count', 0);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_product_if_unreferenced(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_product_if_unreferenced(UUID) TO anon, authenticated;

-- 强制 PostgREST 重新加载 schema 缓存
-- 不加这一行的话，即使列已经存在，PostgREST 仍可能返回 PGRST204
NOTIFY pgrst, 'reload schema';

-- 校验：执行下面这两段（任选其一）确认字段已经齐全
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name='shipments' AND table_schema='public' ORDER BY ordinal_position;

-- SELECT column_name FROM information_schema.columns
-- WHERE table_name='invitations' AND table_schema='public' ORDER BY ordinal_position;
