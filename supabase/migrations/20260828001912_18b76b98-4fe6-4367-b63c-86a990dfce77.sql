REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_profile_membership() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_critical_role_permission() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_user_role_assignment() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_critical_permission(public.app_permission) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.role_has_critical_permission(uuid) FROM anon, authenticated;