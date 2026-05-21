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

-- 强制 PostgREST 重新加载 schema 缓存
-- 不加这一行的话，即使列已经存在，PostgREST 仍可能返回 PGRST204
NOTIFY pgrst, 'reload schema';

-- 校验：执行下面这两段（任选其一）确认字段已经齐全
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name='shipments' AND table_schema='public' ORDER BY ordinal_position;

-- SELECT column_name FROM information_schema.columns
-- WHERE table_name='invitations' AND table_schema='public' ORDER BY ordinal_position;
