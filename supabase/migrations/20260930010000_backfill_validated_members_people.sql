-- Backfill approved public associate signups into the people registry.
-- Only profiles that were explicitly validated are considered, avoiding unrelated
-- active accounts such as the initial administrator.
DO $$
DECLARE
  member_record RECORD;
  existing_person_id uuid;
BEGIN
  FOR member_record IN
    SELECT
      p.id AS user_id,
      p.full_name,
      p.phone,
      p.validated_by,
      u.email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.membership_status = 'active'
      AND p.validated_at IS NOT NULL
  LOOP
    SELECT id
      INTO existing_person_id
      FROM public.people
     WHERE linked_user_id = member_record.user_id
     LIMIT 1;

    IF existing_person_id IS NULL AND member_record.email IS NOT NULL THEN
      SELECT id
        INTO existing_person_id
        FROM public.people
       WHERE linked_user_id IS NULL
         AND lower(email) = lower(member_record.email)
       ORDER BY created_at
       LIMIT 1;
    END IF;

    IF existing_person_id IS NOT NULL THEN
      UPDATE public.people
         SET full_name = COALESCE(member_record.full_name, full_name),
             phone = COALESCE(member_record.phone, phone),
             email = COALESCE(member_record.email, email),
             person_type = 'associate',
             status = 'active',
             linked_user_id = member_record.user_id,
             updated_at = now()
       WHERE id = existing_person_id;
    ELSE
      INSERT INTO public.people (
        full_name,
        phone,
        email,
        person_type,
        status,
        linked_user_id,
        created_by
      )
      VALUES (
        COALESCE(member_record.full_name, split_part(COALESCE(member_record.email, 'sem-email'), '@', 1)),
        member_record.phone,
        member_record.email,
        'associate',
        'active',
        member_record.user_id,
        member_record.validated_by
      );
    END IF;
  END LOOP;
END
$$;
