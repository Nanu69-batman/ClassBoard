-- Subjects get a teacher, and assignments can carry several files.
--
--   * subjects.teacher: who teaches it. Optional (empty string when unknown).
--   * assignments.attachments: a JSON list of { path, name }, replacing the
--     single attachment_path / attachment_name pair. Existing files move over.
--   * Renaming a subject now renames it on its assignments too, so the edit
--     dialog can safely offer the name.

-- ---------------------------------------------------------------- subjects

alter table public.subjects
  add column teacher text not null default '' check (length(teacher) <= 120);

grant update (teacher) on public.subjects to authenticated;

/** Keeps the name copied onto assignments in step when a subject is renamed. */
create function public.sync_subject_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.name is distinct from old.name then
    update public.assignments set subject_name = new.name where subject_id = new.id;
  end if;
  return new;
end;
$$;

create trigger subjects_sync_name after update of name on public.subjects
  for each row execute function public.sync_subject_name();

-- ------------------------------------------------------------- attachments

/**
 * True when `p_files` is a list of at most 10 { path, name } objects, every
 * path inside this class's folder of the bucket. The storage policies decide
 * who may upload there; this stops a row pointing at another class's files.
 */
create function public.valid_attachments(p_class_id uuid, p_files jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_files) = 'array'
    and jsonb_array_length(p_files) <= 10
    and not exists (
      select 1
      from jsonb_array_elements(p_files) as f(item)
      where jsonb_typeof(f.item) <> 'object'
         or coalesce(jsonb_typeof(f.item -> 'path'), '') <> 'string'
         or coalesce(jsonb_typeof(f.item -> 'name'), '') <> 'string'
         or (f.item ->> 'path') not like p_class_id::text || '/%'
         or length(f.item ->> 'name') not between 1 and 200
    );
$$;

alter table public.assignments
  add column attachments jsonb not null default '[]'::jsonb;

update public.assignments
set attachments = jsonb_build_array(jsonb_build_object(
  'path', attachment_path,
  'name', coalesce(nullif(attachment_name, ''), regexp_replace(attachment_path, '^.*/', ''))
))
where attachment_path is not null;

alter table public.assignments
  add constraint assignments_attachments_valid check (public.valid_attachments(class_id, attachments));

alter table public.assignments
  drop column attachment_path,
  drop column attachment_name;
