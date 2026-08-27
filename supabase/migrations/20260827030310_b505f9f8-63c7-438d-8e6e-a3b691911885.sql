-- 1) permissions
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'member.validate';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'member.manage';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'class.manage';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'member.role_assign';

-- 2) membership status enums
DO $$ BEGIN
  CREATE TYPE public.membership_status AS ENUM ('pending', 'active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.class_status AS ENUM ('planned', 'open', 'ongoing', 'closed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.class_member_status AS ENUM ('active', 'ended', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS membership_status public.membership_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- existing users keep working: anyone with a role is considered active
UPDATE public.profiles p SET membership_status = 'active'
 WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id);
