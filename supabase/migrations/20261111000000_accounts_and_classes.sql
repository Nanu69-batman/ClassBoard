-- ClassBoard — everyone has an account; classes work like Discord servers.
--
-- Replaces the earlier model (anonymous students, CRs bound to one class by a
-- superadmin invite). Now:
--
--   * Every signed-in person has a `profiles` row, created by a trigger on
--     auth.users the moment they sign up.
--   * Anyone can create a class and becomes its owner. A class has an invite
--     code; anyone holding it can join as a member.
--   * Roles are per class: owner > admin > member. Owners and admins post
--     assignments and manage subjects. Only the owner manages roles, renames or
--     deletes the class.
--   * Completion ("I've done this") is stored per user in `completions`, not in
--     the browser.
--   * Files are private: only members of the class can read them, through
--     signed URLs.
--
-- This migration DROPS the old tables and their data. It is meant for a project
-- that only holds seed/test data.

-- ------------------------------------------------------------ tear down old

drop policy if exists "attachments: class staff read"   on storage.objects;
drop policy if exists "attachments: class staff upload" on storage.objects;
drop policy if exists "attachments: class staff update" on storage.objects;
drop policy if exists "attachments: class staff delete" on storage.objects;

drop table if exists public.cr_invites  cascade;
drop table if exists public.assignments cascade;
drop table if exists public.subjects    cascade;
drop table if exists public.profiles    cascade;
drop table if exists public.classes     cascade;

drop function if exists public.claim_invite(text, text);
drop function if exists public.peek_invite(text);
drop function if exists public.is_superadmin();
drop function if exists public.my_class_id();
drop function if exists public.is_cr_of(text);
drop function if exists public.class_is_active(text);
drop function if exists public.guard_profile_update();
drop function if exists public.prepare_assignment();
drop function if exists public.notify_class_change();

-- ------------------------------------------------------------------ tables

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

/**
 * A 10-character join code from an unambiguous alphabet (no 0/o, 1/l/i).
 * ~49 bits from gen_random_uuid(), which is cryptographically random. Bytes are
 * taken from outside the UUID version/variant nibbles.
 */
create function public.new_invite_code() returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + get_byte(b, i) % 31, 1), '' order by i)
  from (select uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()) as b) s,
       lateral (values (0), (1), (2), (3), (4), (16), (17), (18), (19), (20)) v(i);
$$;

create table public.classes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 80),
  description text not null default '' check (length(description) <= 300),
  invite_code text not null unique default public.new_invite_code(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.class_members (
  class_id  uuid not null references public.classes (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);

create index class_members_user_idx on public.class_members (user_id);
-- Exactly one owner per class (at most one here; create_class guarantees one).
create unique index class_members_one_owner on public.class_members (class_id) where role = 'owner';

create table public.subjects (
  id       uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  name     text not null check (length(btrim(name)) between 1 and 120),
  active   boolean not null default true,
  unique (class_id, name),
  -- Lets assignments reference (class_id, id), so a subject from another class
  -- cannot be attached to an assignment.
  unique (class_id, id)
);

create table public.assignments (
  id              uuid primary key default gen_random_uuid(),
  class_id        uuid not null references public.classes (id) on delete cascade,
  subject_id      uuid,
  subject_name    text not null default 'General',
  title           text not null check (length(btrim(title)) between 1 and 200),
  description     text not null default '' check (length(description) <= 4000),
  due_date        date,
  due_note        text check (due_note is null or length(due_note) <= 120),
  priority        text not null default 'none' check (priority in ('none', 'low', 'normal', 'high')),
  -- Object path inside the `attachments` bucket. Never the bytes.
  attachment_path text check (attachment_path is null or attachment_path like class_id::text || '/%'),
  attachment_name text check (attachment_name is null or length(attachment_name) <= 200),
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

-- One row per (person, assignment) they have marked done.
create table public.completions (
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  -- Copied from the assignment by a trigger, so a class's completions can be
  -- read in one filtered query and checked against membership.
  class_id      uuid not null references public.classes (id) on delete cascade,
  completed_at  timestamptz not null default now(),
  primary key (user_id, assignment_id)
);

create index completions_user_class_idx on public.completions (user_id, class_id);

-- ----------------------------------------------------------------- helpers
--
-- SECURITY DEFINER so they read `class_members` without tripping its own RLS
-- (which calls them — invoker rights would recurse). They only ever answer
-- questions about the caller.

create function public.class_role(p_class uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.class_members where class_id = p_class and user_id = auth.uid();
$$;

create function public.is_member(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.class_members where class_id = p_class and user_id = auth.uid());
$$;

/** Owners and admins: may post assignments and manage subjects. */
create function public.can_manage(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_members
    where class_id = p_class and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

create function public.is_owner(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_members
    where class_id = p_class and user_id = auth.uid() and role = 'owner'
  );
$$;

/** True when the caller and this person are in at least one class together. */
create function public.shares_class(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.class_members mine
    join public.class_members theirs on theirs.class_id = mine.class_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user
  );
$$;

/** The class a storage object belongs to: its first folder, if that is a uuid. */
create function public.object_class(p_name text) returns uuid
language sql stable set search_path = '' as $$
  select case
    when (storage.foldername(p_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(p_name))[1])::uuid
  end;
$$;

-- ---------------------------------------------------------------- triggers

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger classes_touch before update on public.classes
  for each row execute function public.touch_updated_at();

/** Every new account gets a profile. The name comes from sign-up or Google. */
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  v_name := btrim(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'New user'
  ));

  insert into public.profiles (id, display_name)
  values (new.id, btrim(left(v_name, 80)))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts that existed before this migration.
insert into public.profiles (id, display_name)
select
  u.id,
  btrim(left(coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'New user'
  ), 80))
from auth.users u
on conflict (id) do nothing;

/**
 * Who posted an assignment is decided here, not by the client.
 *
 * On insert, the caller's uid and display name are stamped on. On update, the
 * authorship columns and the class are pinned to their old values. The subject
 * name is always re-derived from the subject row.
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

/** A completion always belongs to the class of its assignment. */
create function public.prepare_completion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select class_id into new.class_id from public.assignments where id = new.assignment_id;
  return new;
end;
$$;

create trigger completions_prepare before insert on public.completions
  for each row execute function public.prepare_completion();

/**
 * Live updates without leaking rows.
 *
 * Every change pings a broadcast topic carrying no data, and clients refetch
 * through RLS. `class:<id>` is for the open class page; `user:<id>` tells a
 * person their list of classes changed (joined, kicked, class renamed/deleted).
 */
create function public.notify_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row   jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_class text  := case when tg_table_name = 'classes' then v_row ->> 'id' else v_row ->> 'class_id' end;
  v_user  record;
begin
  begin
    perform realtime.send(jsonb_build_object('table', tg_table_name), 'changed', 'class:' || v_class, false);

    if tg_table_name = 'class_members' then
      perform realtime.send(jsonb_build_object('table', tg_table_name), 'changed', 'user:' || (v_row ->> 'user_id'), false);
    elsif tg_table_name = 'classes' and tg_op = 'UPDATE' then
      for v_user in select user_id from public.class_members where class_id = (v_row ->> 'id')::uuid loop
        perform realtime.send(jsonb_build_object('table', tg_table_name), 'changed', 'user:' || v_user.user_id, false);
      end loop;
    end if;
  exception when others then
    -- A realtime hiccup must never fail the write itself.
    null;
  end;
  return null;
end;
$$;

create trigger assignments_notify after insert or update or delete on public.assignments
  for each row execute function public.notify_change();
create trigger subjects_notify after insert or update or delete on public.subjects
  for each row execute function public.notify_change();
create trigger members_notify after insert or update or delete on public.class_members
  for each row execute function public.notify_change();
create trigger classes_notify after update on public.classes
  for each row execute function public.notify_change();

-- -------------------------------------------------------------------- RLS

alter table public.profiles      enable row level security;
alter table public.classes       enable row level security;
alter table public.class_members enable row level security;
alter table public.subjects      enable row level security;
alter table public.assignments   enable row level security;
alter table public.completions   enable row level security;

-- profiles: yourself, and anyone you share a class with (for member lists).
create policy "profiles: read self or classmates" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_class(id));

create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- classes: members read; the owner edits and deletes. Creating goes through
-- create_class(), so there is no insert policy.
create policy "classes: members read" on public.classes
  for select to authenticated
  using (public.is_member(id));

create policy "classes: owner updates" on public.classes
  for update to authenticated
  using (public.is_owner(id))
  with check (public.is_owner(id));

create policy "classes: owner deletes" on public.classes
  for delete to authenticated
  using (public.is_owner(id));

-- class_members: members see each other. Joining and role changes go through
-- functions. Removing a row is leaving (anyone but the owner), or kicking
-- (owner kicks anyone else; admins kick plain members).
create policy "members: members read" on public.class_members
  for select to authenticated
  using (public.is_member(class_id));

create policy "members: leave or kick" on public.class_members
  for delete to authenticated
  using (
    role <> 'owner'
    and (
      user_id = auth.uid()
      or public.is_owner(class_id)
      or (role = 'member' and public.class_role(class_id) = 'admin')
    )
  );

-- subjects: members see active ones; managers see and edit all.
create policy "subjects: members read" on public.subjects
  for select to authenticated
  using ((active and public.is_member(class_id)) or public.can_manage(class_id));

create policy "subjects: managers insert" on public.subjects
  for insert to authenticated
  with check (public.can_manage(class_id));

create policy "subjects: managers update" on public.subjects
  for update to authenticated
  using (public.can_manage(class_id))
  with check (public.can_manage(class_id));

-- assignments: members see active ones; managers see archived too and write.
-- Archiving (active = false) is the delete; there is no hard delete from the app.
create policy "assignments: members read" on public.assignments
  for select to authenticated
  using ((active and public.is_member(class_id)) or public.can_manage(class_id));

create policy "assignments: managers insert" on public.assignments
  for insert to authenticated
  with check (public.can_manage(class_id));

create policy "assignments: managers update" on public.assignments
  for update to authenticated
  using (public.can_manage(class_id))
  with check (public.can_manage(class_id));

-- completions: strictly your own, and only in classes you belong to.
create policy "completions: read own" on public.completions
  for select to authenticated
  using (user_id = auth.uid());

create policy "completions: add own" on public.completions
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(class_id));

create policy "completions: remove own" on public.completions
  for delete to authenticated
  using (user_id = auth.uid());

-- -------------------------------------------------------------- functions

/** Creates a class with the caller as owner and a "General" subject. */
create function public.create_class(p_name text, p_description text default '') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_id   uuid;
begin
  if v_uid is null then
    raise exception 'not-signed-in' using errcode = '28000';
  end if;

  if length(v_name) = 0 or length(v_name) > 80 then
    raise exception 'invalid-name' using errcode = '22023';
  end if;

  if (select count(*) from public.class_members where user_id = v_uid and role = 'owner') >= 25 then
    raise exception 'too-many-classes' using errcode = '54000';
  end if;

  insert into public.classes (name, description)
  values (v_name, left(btrim(coalesce(p_description, '')), 300))
  returning id into v_id;

  insert into public.class_members (class_id, user_id, role) values (v_id, v_uid, 'owner');
  insert into public.subjects (class_id, name) values (v_id, 'General');

  return v_id;
end;
$$;

/** What a join link points at, so the join page can name the class. */
create function public.peek_class(p_code text)
returns table (id uuid, name text, description text, member_count bigint, is_member boolean)
language sql stable security definer set search_path = '' as $$
  select
    c.id,
    c.name,
    c.description,
    (select count(*) from public.class_members m where m.class_id = c.id),
    exists (select 1 from public.class_members m where m.class_id = c.id and m.user_id = auth.uid())
  from public.classes c
  where c.invite_code = lower(btrim(p_code));
$$;

/** Joins the class behind an invite code as a member. Idempotent. */
create function public.join_class(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_class uuid;
begin
  if v_uid is null then
    raise exception 'not-signed-in' using errcode = '28000';
  end if;

  select id into v_class from public.classes where invite_code = lower(btrim(coalesce(p_code, '')));
  if v_class is null then
    raise exception 'invite-invalid' using errcode = '42501';
  end if;

  insert into public.class_members (class_id, user_id, role)
  values (v_class, v_uid, 'member')
  on conflict (class_id, user_id) do nothing;

  return v_class;
end;
$$;

/** A fresh invite code; the old one stops working. Owners and admins. */
create function public.regenerate_invite_code(p_class uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
begin
  if not public.can_manage(p_class) then
    raise exception 'not-allowed' using errcode = '42501';
  end if;

  update public.classes set invite_code = public.new_invite_code()
  where id = p_class
  returning invite_code into v_code;

  return v_code;
end;
$$;

/**
 * Owner only. 'admin' or 'member' promotes/demotes; 'owner' hands the class
 * over, and the outgoing owner becomes an admin.
 */
create function public.set_member_role(p_class uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner(p_class) then
    raise exception 'not-allowed' using errcode = '42501';
  end if;

  if p_user = auth.uid() or p_role not in ('owner', 'admin', 'member') then
    raise exception 'invalid-role' using errcode = '22023';
  end if;

  if not exists (select 1 from public.class_members where class_id = p_class and user_id = p_user) then
    raise exception 'not-a-member' using errcode = '22023';
  end if;

  if p_role = 'owner' then
    update public.class_members set role = 'admin' where class_id = p_class and user_id = auth.uid();
  end if;

  update public.class_members set role = p_role where class_id = p_class and user_id = p_user;
end;
$$;

-- --------------------------------------------------------------- storage
--
-- Files live at  attachments/<class_id>/<assignment_id>/<file name>.
-- The bucket is private: members read through signed URLs; owners and admins
-- write. Size and type limits are enforced by Storage itself.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
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

create policy "attachments: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and public.is_member(public.object_class(name)));

create policy "attachments: managers upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and public.can_manage(public.object_class(name)));

create policy "attachments: managers update" on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments' and public.can_manage(public.object_class(name)));

create policy "attachments: managers delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and public.can_manage(public.object_class(name)));

-- ---------------------------------------------------------------- grants
--
-- Grants open the door; RLS decides which rows come through it. Column-level
-- update grants mean a client cannot even attempt to change, say, a class's
-- invite code or a member's role directly — those go through the functions.

grant usage on schema public to anon, authenticated, service_role;

revoke all on public.profiles, public.classes, public.class_members,
              public.subjects, public.assignments, public.completions
  from anon, authenticated;

grant select on public.profiles, public.classes, public.class_members,
                public.subjects, public.assignments, public.completions
  to authenticated;

grant update (display_name)       on public.profiles    to authenticated;
grant update (name, description)  on public.classes     to authenticated;
grant delete                      on public.classes     to authenticated;
grant delete                      on public.class_members to authenticated;
grant insert                      on public.subjects    to authenticated;
grant update (name, active)       on public.subjects    to authenticated;
grant insert, update              on public.assignments to authenticated;
grant insert, delete              on public.completions to authenticated;

grant all on public.profiles, public.classes, public.class_members,
             public.subjects, public.assignments, public.completions
  to service_role;

revoke execute on function
  public.create_class(text, text),
  public.join_class(text),
  public.regenerate_invite_code(uuid),
  public.set_member_role(uuid, uuid, text),
  public.peek_class(text)
  from public, anon;

grant execute on function
  public.create_class(text, text),
  public.join_class(text),
  public.regenerate_invite_code(uuid),
  public.set_member_role(uuid, uuid, text),
  public.peek_class(text)
  to authenticated;

-- Helpers called from inside RLS policies.
grant execute on function
  public.class_role(uuid),
  public.is_member(uuid),
  public.can_manage(uuid),
  public.is_owner(uuid),
  public.shares_class(uuid),
  public.object_class(text)
  to authenticated, service_role;
