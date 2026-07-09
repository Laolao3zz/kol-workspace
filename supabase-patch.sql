-- ============================================================
-- KOL 工作台数据库补丁
-- 用途：补齐 V5/V6 升级遗漏的字段，解决以下错误：
--   "Could not find the 'archived_at' column of 'shipments' in the schema cache"
--   "Could not find the 'quoted_fee' column of 'invitations' in the schema cache"
--   等同类 schema 缺失错误
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

-- 强制 PostgREST 重新加载 schema 缓存
-- 不加这一行的话，即使列已经存在，PostgREST 仍可能返回 PGRST204
NOTIFY pgrst, 'reload schema';

-- 校验：执行下面这两段（任选其一）确认字段已经齐全
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name='shipments' AND table_schema='public' ORDER BY ordinal_position;

-- SELECT column_name FROM information_schema.columns
-- WHERE table_name='invitations' AND table_schema='public' ORDER BY ordinal_position;
