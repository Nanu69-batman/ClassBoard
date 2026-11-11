-- Each subject gets a colour, so its work is recognisable at a glance.
-- Empty means "not chosen"; the app then picks one from its palette.

alter table public.subjects
  add column color text not null default '' check (color = '' or color ~ '^#[0-9a-f]{6}$');

grant update (color) on public.subjects to authenticated;
