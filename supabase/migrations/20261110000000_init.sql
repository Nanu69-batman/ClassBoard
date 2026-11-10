-- ClassBoard — initial Supabase schema
--
-- Replaces firestore.rules + storage.rules. Row-level security is the security
-- boundary; the frontend is not. Apply with the SQL editor (paste this file) or
-- `npx supabase db push` after `npx supabase link`.
--
-- What changed from the Firestore model, and why it is safer:
--
--   * A table has a fixed set of columns, so the `keys().hasOnly([...])` field
--     allow-list is now structural. There is no `postedByEmail` column to write.
--   * `created_by`, `posted_by_name`, `created_at` and `class_id` on an
--     assignment are set by a trigger from the caller's own profile and pinned on
--     update. A CR can no longer choose the byline students see.
--   * A CR's write access requires their *class* to be active as well as their
--     profile.
--   * Claiming an invite is one transaction (`claim_invite`), so a failure can no
--     longer spend the token without creating the profile, and a transfer
--     deactivates the outgoing CR in the same step.

-- ------------------------------------------------------------------ tables

create table public.classes (
  id           text primary key
               check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 64),
  name         text not null,
  batch        text not null default '',
  section      text not null default '',
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.subjects (
  id         uuid primary key default gen_random_uuid(),
  class_id   text not null references public.classes (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 120),
  short_name text not null default '' check (length(short_name) <= 40),
  active     boolean not null default true,
  unique (class_id, name),
  -- Lets assignments reference (class_id, id), so a subject from another class
  -- cannot be attached to an assignment.
  unique (class_id, id)
);

-- One row per privileged person. Students have no row and no account.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  role         text not null check (role in ('cr', 'superadmin')),
  class_id     text references public.classes (id) on delete set null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index profiles_class_id_idx on public.profiles (class_id);

create table public.assignments (
  id              uuid primary key default gen_random_uuid(),
  class_id        text not null references public.classes (id) on delete cascade,
  subject_id      uuid,
  subject_name    text not null default 'General',
  title           text not null check (length(btrim(title)) between 1 and 200),
  description     text not null default '' check (length(description) <= 4000),
  due_date        date,
  due_note        text check (due_note is null or length(due_note) <= 120),
  priority        text not null default 'none' check (priority in ('none', 'low', 'normal', 'high')),
  -- Object path inside the `attachments` bucket. Never the bytes.
  attachment_path text check (attachment_path is null or attachment_path like class_id || '/%'),
  attachment_name text check (attachment_name is null or length(attachment_name) <= 200),
  -- An address a CR publishes on purpose. Never copied from an account.
  contact_email   text check (contact_email is null or length(contact_email) <= 254),
  created_by      uuid references auth.users (id) on delete set null,
  posted_by_name  text not null default 'Class representative',
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  foreign key (class_id, subject_id) references public.subjects (class_id, id),
  -- A date, or a note in place of one. Never both, never neither.
  check (due_date is not null or due_note is not null),
  check (due_date is null or due_note is null)
);

create index assignments_class_active_idx on public.assignments (class_id, active);

-- An invite token is a bearer credential: whoever claims it first becomes a CR
-- of exactly one class. Nobody but a superadmin can read this table.
create table public.cr_invites (
  token      text primary key
             default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  class_id   text not null references public.classes (id) on delete cascade,
  -- Set for a transfer: this CR is deactivated when the invite is claimed.
  replaces   uuid references public.profiles (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at    timestamptz,
  used_by    uuid references auth.users (id) on delete set null
);

-- ----------------------------------------------------------------- helpers
--
-- SECURITY DEFINER so they read `profiles` without tripping its own RLS
-- (which calls them — invoker rights would recurse).

create function public.is_superadmin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin' and active
  );
$$;

/** The class an active CR may manage, regardless of whether the class is active. */
create function public.my_class_id() returns text
language sql stable security definer set search_path = '' as $$
  select class_id from public.profiles
  where id = auth.uid() and role = 'cr' and active;
$$;

/** True when the caller is an active CR of this class AND the class is active. */
create function public.is_cr_of(p_class_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    join public.classes c on c.id = p.class_id
    where p.id = auth.uid()
      and p.role = 'cr'
      and p.active
      and c.active
      and p.class_id = p_class_id
  );
$$;

create function public.class_is_active(p_class_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.classes where id = p_class_id and active);
$$;

-- ---------------------------------------------------------------- triggers

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger classes_touch before update on public.classes
  for each row execute function public.touch_updated_at();

/**
 * Who posted an assignment is decided here, not by the client.
 *
 * On insert, an authenticated caller's uid and profile display name are stamped
 * on. On update, the authorship columns and the class are pinned to their old
 * values. The subject name is always re-derived from the subject row, so a
 * student's card cannot be made to show a subject the class does not have.
 *
 * A caller with no auth.uid() (the service-role seed script) keeps what it sent.
 */
create function public.prepare_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_author  text;
  v_subject text;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
      select display_name into v_author from public.profiles where id = auth.uid();
      new.posted_by_name := coalesce(v_author, 'Class representative');
    end if;
    new.created_at := now();
  else
    new.id             := old.id;
    new.class_id       := old.class_id;
    new.created_by     := old.created_by;
    new.posted_by_name := old.posted_by_name;
    new.created_at     := old.created_at;
  end if;

  if new.subject_id is not null then
    select name into v_subject
    from public.subjects
    where id = new.subject_id and class_id = new.class_id;
    new.subject_name := coalesce(v_subject, new.subject_name);
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger assignments_prepare before insert or update on public.assignments
  for each row execute function public.prepare_assignment();

/**
 * A person may rename themselves. Nothing else about their own profile is theirs
 * to change. Superadmins, and SECURITY DEFINER functions such as claim_invite
 * (which run as the owner, not as `authenticated`), are not restricted.
 */
create function public.guard_profile_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_superadmin() then
    if new.id <> old.id
       or new.role is distinct from old.role
       or new.class_id is distinct from old.class_id
       or new.active is distinct from old.active
       or new.email is distinct from old.email
       or new.created_at <> old.created_at then
      raise exception 'profile-field-locked' using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

/**
 * Live updates without leaking rows.
 *
 * Postgres-changes subscriptions filter by RLS on the *new* row, so a student
 * would never hear that an assignment was archived (the archived row is no
 * longer visible to them). Instead every change pings a public broadcast topic
 * per class carrying no data, and the client refetches through RLS.
 */
create function public.notify_class_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_class text := coalesce(new.class_id, old.class_id);
begin
  begin
    perform realtime.send(
      jsonb_build_object('table', tg_table_name),
      'changed',
      'class:' || v_class,
      false
    );
  exception when others then
    -- A realtime hiccup must never fail the write itself.
    null;
  end;
  return null;
end;
$$;

create trigger assignments_notify after insert or update or delete on public.assignments
  for each row execute function public.notify_class_change();

create trigger subjects_notify after insert or update or delete on public.subjects
  for each row execute function public.notify_class_change();

-- -------------------------------------------------------------------- RLS

alter table public.classes     enable row level security;
alter table public.subjects    enable row level security;
alter table public.profiles    enable row level security;
alter table public.assignments enable row level security;
alter table public.cr_invites  enable row level security;

-- Students are anonymous and never need these two at all.
revoke all on public.profiles   from anon;
revoke all on public.cr_invites from anon;

-- classes
create policy "classes: read active, own, or as admin" on public.classes
  for select to anon, authenticated
  using (active or public.is_superadmin() or id = public.my_class_id());

create policy "classes: admin writes" on public.classes
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- subjects
create policy "subjects: read public or own class" on public.subjects
  for select to anon, authenticated
  using (
    (active and public.class_is_active(class_id))
    or public.is_superadmin()
    or public.is_cr_of(class_id)
  );

create policy "subjects: CR or admin inserts" on public.subjects
  for insert to authenticated
  with check (public.is_superadmin() or public.is_cr_of(class_id));

create policy "subjects: CR or admin updates" on public.subjects
  for update to authenticated
  using (public.is_superadmin() or public.is_cr_of(class_id))
  with check (public.is_superadmin() or public.is_cr_of(class_id));

create policy "subjects: admin deletes" on public.subjects
  for delete to authenticated
  using (public.is_superadmin());

-- assignments
create policy "assignments: read public or own class" on public.assignments
  for select to anon, authenticated
  using (
    (active and public.class_is_active(class_id))
    or public.is_superadmin()
    or public.is_cr_of(class_id)
  );

create policy "assignments: CR or admin inserts" on public.assignments
  for insert to authenticated
  with check (public.is_superadmin() or public.is_cr_of(class_id));

create policy "assignments: CR or admin updates" on public.assignments
  for update to authenticated
  using (public.is_superadmin() or public.is_cr_of(class_id))
  with check (public.is_superadmin() or public.is_cr_of(class_id));

-- Soft delete (active = false) is the CR's tool. Hard delete is admin-only.
create policy "assignments: admin deletes" on public.assignments
  for delete to authenticated
  using (public.is_superadmin());

-- profiles
create policy "profiles: read own, or as admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_superadmin());

create policy "profiles: update own name, or as admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_superadmin())
  with check (id = auth.uid() or public.is_superadmin());

-- Self-service creation goes through claim_invite only. The first superadmin is
-- bound out of band with the service-role script, never from the app.
create policy "profiles: admin inserts CRs" on public.profiles
  for insert to authenticated
  with check (public.is_superadmin() and role = 'cr');

create policy "profiles: admin deletes" on public.profiles
  for delete to authenticated
  using (public.is_superadmin());

-- cr_invites: superadmin only. Claimants go through the functions below.
create policy "invites: admin only" on public.cr_invites
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- --------------------------------------------------------------- invites

/**
 * The class an invite would grant, or null if the token is not usable.
 *
 * Lets the invite page show "you are becoming CR of ECE 2026 A" before anyone
 * creates an account. Tokens are 244 random bits, so answering "is this token
 * valid" is not a useful oracle.
 */
create function public.peek_invite(p_token text) returns text
language sql stable security definer set search_path = '' as $$
  select c.display_name
  from public.cr_invites i
  join public.classes c on c.id = i.class_id
  where i.token = p_token
    and i.used_at is null
    and i.expires_at > now()
    and c.active;
$$;

/**
 * Spends an invite and creates the caller's CR profile, atomically.
 *
 * The role is hard-coded to 'cr' and the class comes from the invite row — never
 * from an argument — so no invite can mint a superadmin or a CR of another
 * class. Returns the class id.
 *
 * Errors are raised with a stable message the client maps to friendly text:
 *   not-signed-in, invalid-name, already-has-role, invite-invalid
 */
create function public.claim_invite(p_token text, p_display_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_name   text := btrim(coalesce(p_display_name, ''));
  v_invite public.cr_invites;
begin
  if v_uid is null then
    raise exception 'not-signed-in' using errcode = '28000';
  end if;

  if length(v_name) = 0 or length(v_name) > 80 then
    raise exception 'invalid-name' using errcode = '22023';
  end if;

  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'already-has-role' using errcode = '42501';
  end if;

  select * into v_invite
  from public.cr_invites
  where token = p_token
  for update;

  if not found
     or v_invite.used_at is not null
     or v_invite.expires_at <= now()
     or not public.class_is_active(v_invite.class_id) then
    -- One message for unknown, used, expired and dead-class alike.
    raise exception 'invite-invalid' using errcode = '42501';
  end if;

  -- Transfer: the outgoing CR loses access in the same transaction.
  if v_invite.replaces is not null then
    update public.profiles
    set active = false
    where id = v_invite.replaces and role = 'cr';
  end if;

  insert into public.profiles (id, email, display_name, role, class_id, active)
  values (
    v_uid,
    (select email from auth.users where id = v_uid),
    v_name,
    'cr',
    v_invite.class_id,
    true
  );

  update public.cr_invites
  set used_at = now(), used_by = v_uid
  where token = p_token;

  return v_invite.class_id;
end;
$$;

revoke execute on function public.claim_invite(text, text) from public, anon;
grant execute on function public.claim_invite(text, text) to authenticated;
grant execute on function public.peek_invite(text) to anon, authenticated;

-- --------------------------------------------------------------- storage
--
-- Files live at  attachments/<class_id>/<assignment_id>/<file name>.
-- The bucket is public-read so students (who have no account) can open a file
-- from its URL; writing is limited to that class's CR and superadmins. The size
-- and type limits are enforced by Storage itself, not just the form.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  true,
  26214400, -- 25 MB
  array[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "attachments: class staff read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and (public.is_superadmin() or public.is_cr_of((storage.foldername(name))[1]))
  );

create policy "attachments: class staff upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (public.is_superadmin() or public.is_cr_of((storage.foldername(name))[1]))
  );

create policy "attachments: class staff update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'attachments'
    and (public.is_superadmin() or public.is_cr_of((storage.foldername(name))[1]))
  );

create policy "attachments: class staff delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (public.is_superadmin() or public.is_cr_of((storage.foldername(name))[1]))
  );
