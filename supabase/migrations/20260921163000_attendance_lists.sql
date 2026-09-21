CREATE TABLE public.attendance_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  work_id UUID REFERENCES public.works(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.attendance_list_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.attendance_lists(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name TEXT,
  expected BOOLEAN NOT NULL DEFAULT false,
  present BOOLEAN NOT NULL DEFAULT false,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attendance_list_entries_person CHECK (user_id IS NOT NULL OR guest_name IS NOT NULL)
);

CREATE UNIQUE INDEX attendance_list_entries_user_unique
  ON public.attendance_list_entries(list_id, user_id) WHERE user_id IS NOT NULL;

CREATE TRIGGER tg_attendance_lists_updated_at
BEFORE UPDATE ON public.attendance_lists
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_lists, public.attendance_list_entries TO authenticated;
GRANT ALL ON public.attendance_lists, public.attendance_list_entries TO service_role;
ALTER TABLE public.attendance_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_list_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attendance managers manage lists" ON public.attendance_lists
FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'attendance.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'attendance.manage'));

CREATE POLICY "Attendance managers manage list entries" ON public.attendance_list_entries
FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'attendance.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'attendance.manage'));