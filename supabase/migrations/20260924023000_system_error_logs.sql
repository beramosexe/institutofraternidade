create table if not exists public.system_error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category text not null,
  event text not null,
  message text not null,
  user_id uuid references auth.users(id) on delete set null,
  audio_id uuid references public.audios(id) on delete set null,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists system_error_logs_created_at_idx
  on public.system_error_logs (created_at desc);

create index if not exists system_error_logs_category_idx
  on public.system_error_logs (category);

create index if not exists system_error_logs_audio_id_idx
  on public.system_error_logs (audio_id);

alter table public.system_error_logs enable row level security;

grant all on public.system_error_logs to service_role;
grant select on public.system_error_logs to authenticated;

drop policy if exists system_error_logs_admin_read on public.system_error_logs;
create policy system_error_logs_admin_read
  on public.system_error_logs
  for select to authenticated
  using (public.is_admin(auth.uid()));

revoke insert, update, delete on public.system_error_logs from authenticated, anon;
