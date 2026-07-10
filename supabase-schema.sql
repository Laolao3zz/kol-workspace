-- KOL 工作台数据库建表脚本
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本

-- 1. KOL 主表
CREATE TABLE IF NOT EXISTS kols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  homepage_url TEXT,
  platform TEXT,
  followers TEXT,
  country TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  status TEXT DEFAULT '未首触',
  sample_product TEXT,
  sample_date DATE,
  tracking_number TEXT,
  shipping_details TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 邀约记录表
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_id UUID REFERENCES kols(id) ON DELETE CASCADE,
  product TEXT,
  invited_at DATE,
  email_subject TEXT,
  replied BOOLEAN DEFAULT false,
  reply_result TEXT,
  quoted_fee TEXT,
  decision TEXT DEFAULT '待评估',
  decision_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 合作记录表
CREATE TABLE IF NOT EXISTS collaborations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_id UUID REFERENCES kols(id) ON DELETE CASCADE,
  product TEXT,
  publish_date DATE,
  work_url TEXT,
  views INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  fee TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 邮件记录表
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_id UUID REFERENCES kols(id) ON DELETE CASCADE,
  kol_email TEXT,
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  from_address TEXT,
  to_address TEXT,
  subject TEXT,
  body TEXT,
  sent_at TIMESTAMPTZ,
  message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. 寄样记录表：一个 KOL 可有多条寄样记录
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_id UUID REFERENCES kols(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  sample_date DATE,
  tracking_number TEXT,
  shipping_details TEXT,
  status TEXT DEFAULT '待寄出',
  notes TEXT,
  delivered_at DATE,
  progress_status TEXT DEFAULT '待制作',
  progress_notes TEXT,
  expected_publish_date DATE,
  completed_at DATE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 策略：公开访问，允许所有读写操作
ALTER TABLE kols ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- 允许所有读写（无认证模式）
CREATE POLICY "Allow all access" ON kols FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON invitations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON collaborations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON emails FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON shipments FOR ALL USING (true) WITH CHECK (true);

-- 索引
CREATE INDEX IF NOT EXISTS idx_kols_name ON kols (name);
CREATE INDEX IF NOT EXISTS idx_kols_status ON kols (status);
CREATE INDEX IF NOT EXISTS idx_invitations_kol_id ON invitations (kol_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_kol_id ON collaborations (kol_id);
CREATE INDEX IF NOT EXISTS idx_emails_kol_id ON emails (kol_id);
CREATE INDEX IF NOT EXISTS idx_shipments_kol_id ON shipments (kol_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments (status);
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments (created_at DESC);

-- ============================================================
-- V3 升级：删除冗余字段，统一状态体系
-- 如有旧表请执行以下语句：
-- ============================================================
-- ALTER TABLE kols DROP COLUMN IF EXISTS products CASCADE;
-- ALTER TABLE kols DROP COLUMN IF EXISTS content_progress CASCADE;
-- ALTER TABLE kols DROP COLUMN IF EXISTS expected_publish_date CASCADE;
-- ALTER TABLE kols DROP COLUMN IF EXISTS final_work_url CASCADE;
-- ALTER TABLE kols DROP COLUMN IF EXISTS cooperation_fee CASCADE;
-- ALTER TABLE kols DROP COLUMN IF EXISTS engagement_snapshot CASCADE;
-- ALTER TABLE kols DROP COLUMN IF EXISTS communication_notes CASCADE;
-- ALTER TABLE kols DROP COLUMN IF EXISTS shipment_status CASCADE;

-- ============================================================
-- V4 升级：增加寄送产品字段
-- 如已有旧表请执行：
-- ============================================================
-- ============================================================
-- V5 升级：送达后的内容进度跟踪
-- 如已有旧表请执行：
-- ============================================================
-- ============================================================
-- V6 升级：邀约报价与我方决策；补齐 tags 和内容进度字段
-- 如已有旧表请执行：
-- ============================================================
-- ALTER TABLE invitations ADD COLUMN IF NOT EXISTS quoted_fee TEXT;
-- ALTER TABLE invitations ADD COLUMN IF NOT EXISTS decision TEXT DEFAULT '待评估';
-- ALTER TABLE invitations ADD COLUMN IF NOT EXISTS decision_reason TEXT;
-- ALTER TABLE shipments ADD COLUMN IF NOT EXISTS progress_status TEXT DEFAULT '待制作';
-- ALTER TABLE shipments ADD COLUMN IF NOT EXISTS progress_notes TEXT;
-- ALTER TABLE shipments ADD COLUMN IF NOT EXISTS expected_publish_date DATE;
-- ALTER TABLE shipments ADD COLUMN IF NOT EXISTS completed_at DATE;
-- ALTER TABLE shipments ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
-- ALTER TABLE kols ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- ============================================================
-- V7 升级：产品主数据表，用于产品机会匹配和真实产品管理
-- ============================================================
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

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON products FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);
CREATE INDEX IF NOT EXISTS idx_products_priority ON products (priority DESC);

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

  SELECT name INTO v_product_name
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

CREATE TRIGGER invitations_require_managed_product
BEFORE INSERT OR UPDATE OF product ON public.invitations
FOR EACH ROW EXECUTE FUNCTION public.enforce_managed_product_reference();

CREATE TRIGGER shipments_require_managed_product
BEFORE INSERT OR UPDATE OF product ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.enforce_managed_product_reference();

CREATE TRIGGER collaborations_require_managed_product
BEFORE INSERT OR UPDATE OF product ON public.collaborations
FOR EACH ROW EXECUTE FUNCTION public.enforce_managed_product_reference();

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

  SELECT name INTO v_product_name
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('deleted', true, 'already_missing', true, 'reference_count', 0);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.products
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
