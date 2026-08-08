INSERT INTO public.roles (slug, name, description, is_system)
VALUES ('acolhimento', 'Acolhimento', 'Responsável pelo controle de presença nos trabalhos', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission)
SELECT r.id, 'attendance.manage'::public.app_permission
FROM public.roles r WHERE r.slug = 'acolhimento'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission)
SELECT r.id, 'attendance.manage'::public.app_permission
FROM public.roles r WHERE r.slug = 'admin'
ON CONFLICT DO NOTHING;