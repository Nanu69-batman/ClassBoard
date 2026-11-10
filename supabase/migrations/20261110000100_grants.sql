-- ClassBoard — table and function privileges
--
-- Newer Supabase projects do not grant the API roles access to new tables by
-- default, so without this every request fails with "permission denied" before
-- row-level security is even consulted.
--
-- These grants open the *door*; the RLS policies in the init migration decide
-- which *rows* each caller gets through it. A grant here never widens what a
-- policy allows.

-- Students (anon) only ever read the public feed.
grant usage on schema public to anon, authenticated, service_role;

grant select on public.classes, public.subjects, public.assignments to anon;

-- Signed-in users: RLS limits every one of these to their own class, their own
-- profile, or superadmin.
grant select, insert, update, delete
  on public.classes, public.subjects, public.assignments, public.profiles, public.cr_invites
  to authenticated;

-- The local admin scripts (seed, invite, bind:superadmin).
grant all
  on public.classes, public.subjects, public.assignments, public.profiles, public.cr_invites
  to service_role;

-- Helpers called from inside RLS policies, so every API role must be able to run
-- them. They only ever answer questions about the caller.
grant execute on function
  public.is_superadmin(),
  public.my_class_id(),
  public.is_cr_of(text),
  public.class_is_active(text)
  to anon, authenticated, service_role;

grant execute on function public.peek_invite(text) to anon, authenticated, service_role;
grant execute on function public.claim_invite(text, text) to authenticated;
