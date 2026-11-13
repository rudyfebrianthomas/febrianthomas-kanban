alter table public.kanban_boards
  add column is_active boolean not null default false;

update public.kanban_boards
  set is_active = true
  where id = '00000000-0000-0000-0000-000000000001'::uuid;

create unique index kanban_boards_single_active_idx
  on public.kanban_boards (is_active)
  where is_active;

grant insert (is_active) on public.kanban_boards to authenticated;
grant update (is_active) on public.kanban_boards to authenticated;
