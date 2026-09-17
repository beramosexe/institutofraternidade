GRANT SELECT ON TABLE public.site_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.site_posts TO authenticated;
GRANT ALL ON TABLE public.site_posts TO service_role;