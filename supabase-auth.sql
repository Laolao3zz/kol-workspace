-- KOL Hub 内部访问加固
-- 在 Supabase SQL Editor 执行一次。执行前请先在 Authentication > Providers > Email
-- 关闭 "Allow new users to sign up"，之后只通过 Authentication > Users 邀请公司成员。

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'kols',
    'invitations',
    'collaborations',
    'emails',
    'shipments',
    'products'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all access', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Authenticated internal access', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL)',
      'Authenticated internal access',
      table_name
    );
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', table_name);
  END LOOP;
END $$;

DO $$
DECLARE
  function_signature TEXT;
BEGIN
  FOREACH function_signature IN ARRAY ARRAY[
    'public.delete_stale_auto_shipment(uuid,timestamp with time zone,text,uuid)',
    'public.delete_invitation_with_stale_shipment(uuid)',
    'public.delete_product_if_unreferenced(uuid)'
  ]
  LOOP
    IF to_regprocedure(function_signature) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', function_signature);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', function_signature);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
