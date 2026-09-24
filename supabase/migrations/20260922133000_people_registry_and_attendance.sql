create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  person_type text not null default 'visitor',
  status text not null default 'active',
  linked_user_id uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint people_person_type_check check (person_type in ('visitor','associate')),
  constraint people_status_check check (status in ('active','inactive'))
);

create index if not exists people_name_idx on public.people(lower(full_name));
create index if not exists people_email_idx on public.people(lower(email));
create index if not exists people_phone_idx on public.people(phone);
create index if not exists people_linked_user_idx on public.people(linked_user_id);

alter table public.people enable row level security;
grant select, insert, update on public.people to authenticated;
grant all on public.people to service_role;

create policy people_manage on public.people
  for all to authenticated
  using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(), 'member.manage'))
  with check (public.is_admin(auth.uid()) or public.has_permission(auth.uid(), 'member.manage'));

alter table public.attendance
  add column if not exists person_id uuid references public.people(id) on delete set null;

create index if not exists attendance_person_idx on public.attendance(person_id);

create or replace function public.set_people_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_people_updated_at on public.people;
create trigger update_people_updated_at
before update on public.people
for each row execute function public.set_people_updated_at();
