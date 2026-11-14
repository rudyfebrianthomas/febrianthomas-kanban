alter table public.commission_offers
  add column image_path text
  check (image_path is null or image_path ~ '^[0-9a-f-]{36}\.(png|jpg|webp|gif)$');

grant insert (image_path) on public.commission_offers to authenticated;
grant update (image_path) on public.commission_offers to authenticated;

alter policy "Site owner can remove unused kanban images" on storage.objects
  using (
    bucket_id = 'kanban-images'
    and (select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid
    and not exists (select 1 from public.kanban_cards where image_path = storage.objects.name)
    and not exists (select 1 from public.commission_offers where image_path = storage.objects.name)
  );
