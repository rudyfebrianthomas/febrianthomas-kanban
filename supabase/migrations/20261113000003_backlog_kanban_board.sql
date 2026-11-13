alter table public.kanban_boards
  add column is_backlog boolean not null default false;

create unique index kanban_boards_single_backlog_idx
  on public.kanban_boards (is_backlog)
  where is_backlog;

insert into public.kanban_boards (id, author_id, title, description, is_active, is_backlog)
values (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid,
  'Backlog',
  'Cards waiting to be assigned to a board.',
  false,
  true
)
on conflict (id) do update
  set is_backlog = true,
      is_active = false;

alter policy "Only the site owner can delete kanban boards" on public.kanban_boards
  using (
    (select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid
    and not is_backlog
  );
