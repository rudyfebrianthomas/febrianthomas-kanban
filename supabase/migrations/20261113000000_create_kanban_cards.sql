-- Kanban cards are public; only the site owner's confirmed account can create, update, or delete.
create table public.kanban_cards (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id),
  stage_number text not null default '01' check (stage_number in ('01', '02', '03', '04', '05', '06')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null check (char_length(btrim(description)) between 1 and 240),
  requestors text[] not null default '{}',
  image_path text check (image_path is null or image_path ~ '^[0-9a-f-]{36}\.(png|jpg|webp|gif)$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint kanban_cards_requestors_limit check (cardinality(requestors) between 1 and 10 and char_length(array_to_string(requestors, ',')) <= 400)
);

alter table public.kanban_cards enable row level security;
revoke all on public.kanban_cards from anon, authenticated;
grant select on public.kanban_cards to anon, authenticated;
grant insert (stage_number, title, description, requestors, image_path) on public.kanban_cards to authenticated;
grant update (stage_number, title, description, requestors, image_path) on public.kanban_cards to authenticated;
grant delete on public.kanban_cards to authenticated;

create policy "Anyone can read kanban cards" on public.kanban_cards
  for select to anon, authenticated using (true);

create policy "Only the site owner can create kanban cards" on public.kanban_cards
  for insert to authenticated
  with check (
    (select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid
    and author_id = (select auth.uid())
  );

create policy "Only the site owner can update kanban cards" on public.kanban_cards
  for update to authenticated
  using ((select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid)
  with check ((select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid);

create policy "Only the site owner can delete kanban cards" on public.kanban_cards
  for delete to authenticated
  using ((select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid);

create trigger prepare_kanban_card_features before update on public.kanban_cards
  for each row execute function public.prepare_post_features();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kanban-images', 'kanban-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "Site owner can upload kanban images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'kanban-images'
    and (select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid
    and name ~ '^[0-9a-f-]{36}\.(png|jpg|webp|gif)$'
  );

create policy "Site owner can find kanban images" on storage.objects
  for select to authenticated
  using (bucket_id = 'kanban-images' and (select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid);

create policy "Site owner can remove unused kanban images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'kanban-images'
    and (select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid
    and not exists (select 1 from public.kanban_cards where image_path = storage.objects.name)
  );
