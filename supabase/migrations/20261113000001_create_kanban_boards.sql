-- Kanban boards are public; only the site owner's confirmed account can create, update, or delete.
create table public.kanban_boards (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (description is null or char_length(btrim(description)) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.kanban_boards enable row level security;
revoke all on public.kanban_boards from anon, authenticated;
grant select on public.kanban_boards to anon, authenticated;
grant insert (title, description) on public.kanban_boards to authenticated;
grant update (title, description) on public.kanban_boards to authenticated;
grant delete on public.kanban_boards to authenticated;

create policy "Anyone can read kanban boards" on public.kanban_boards
  for select to anon, authenticated using (true);

create policy "Only the site owner can create kanban boards" on public.kanban_boards
  for insert to authenticated
  with check (
    (select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid
    and author_id = (select auth.uid())
  );

create policy "Only the site owner can update kanban boards" on public.kanban_boards
  for update to authenticated
  using ((select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid)
  with check ((select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid);

create policy "Only the site owner can delete kanban boards" on public.kanban_boards
  for delete to authenticated
  using ((select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid);

create trigger prepare_kanban_board_features before update on public.kanban_boards
  for each row execute function public.prepare_post_features();

insert into public.kanban_boards (id, author_id, title, description)
values (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid,
  'Commission Board',
  'Default illustration commission board'
)
on conflict (id) do nothing;

alter table public.kanban_cards
  add column board_id uuid not null default '00000000-0000-0000-0000-000000000001'::uuid references public.kanban_boards(id) on delete cascade;

alter table public.kanban_cards
  alter column board_id drop default;

create index kanban_cards_board_id_idx on public.kanban_cards(board_id);

grant insert (board_id) on public.kanban_cards to authenticated;
grant update (board_id) on public.kanban_cards to authenticated;
