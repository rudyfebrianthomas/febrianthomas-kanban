-- Commission offers catalog with prices; public reads open offers, site owner manages all.
create table public.commission_offers (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id),
  commission_type text not null default 'Illustration'
    check (commission_type in ('Emote', 'GIF', 'Animation', 'Illustration', 'Transition')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null check (char_length(btrim(description)) between 1 and 240),
  price text not null check (char_length(btrim(price)) between 1 and 60),
  is_open boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.commission_offers enable row level security;
revoke all on public.commission_offers from anon, authenticated;
grant select on public.commission_offers to anon, authenticated;
grant insert (commission_type, title, description, price, is_open, sort_order) on public.commission_offers to authenticated;
grant update (commission_type, title, description, price, is_open, sort_order) on public.commission_offers to authenticated;
grant delete on public.commission_offers to authenticated;

create policy "Anyone can read open commission offers or site owner reads all" on public.commission_offers
  for select to anon, authenticated
  using (is_open or (select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid);

create policy "Only the site owner can create commission offers" on public.commission_offers
  for insert to authenticated
  with check (
    (select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid
    and author_id = (select auth.uid())
  );

create policy "Only the site owner can update commission offers" on public.commission_offers
  for update to authenticated
  using ((select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid)
  with check ((select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid);

create policy "Only the site owner can delete commission offers" on public.commission_offers
  for delete to authenticated
  using ((select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid);

create trigger prepare_commission_offers_features before update on public.commission_offers
  for each row execute function public.prepare_post_features();

insert into public.commission_offers (id, author_id, commission_type, title, description, price, is_open, sort_order)
values
  ('00000000-0000-0000-0000-000000000101'::uuid, '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid, 'Emote', 'Custom Emote', 'Expressive static emote for Twitch, Discord, or YouTube.', '$20', true, 1),
  ('00000000-0000-0000-0000-000000000102'::uuid, '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid, 'GIF', 'Animated GIF / Emote', 'Looping animated emote or reaction GIF with smooth motion.', '$35', true, 2),
  ('00000000-0000-0000-0000-000000000103'::uuid, '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid, 'Illustration', 'Character Illustration', 'Clean lined and rendered illustration of your character.', '$60', true, 3),
  ('00000000-0000-0000-0000-000000000104'::uuid, '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid, 'Animation', '2D Character Animation', 'Short 2D loop or character animation with shading.', '$90', true, 4),
  ('00000000-0000-0000-0000-000000000105'::uuid, '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid, 'Transition', 'Stream Stinger Transition', 'Custom animated transition tailored to your stream branding.', '$80', true, 5)
on conflict (id) do nothing;

-- Allow visitors to upload optional reference images for open commission requests.
create policy "Visitors can upload request reference images" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'kanban-images'
    and name ~ '^[0-9a-f-]{36}\.(png|jpg|webp|gif)$'
    and (
      (select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid
      or coalesce((select status from public.commission_status where id = 'default'), 'open') <> 'closed'
    )
  );

drop function if exists public.submit_commission_request(text, text, text, text, text, boolean);

create or replace function public.submit_commission_request(
  p_offer_id uuid,
  p_contact_channel text,
  p_contact_value text,
  p_image_path text,
  p_tos_accepted boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id constant uuid := '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid;
  v_status text;
  v_backlog_id uuid;
  v_offer record;
  v_contact text := btrim(coalesce(p_contact_value, ''));
  v_image text := nullif(btrim(coalesce(p_image_path, '')), '');
  v_channel_label text;
  v_card_id uuid;
begin
  if coalesce(p_tos_accepted, false) is not true then
    raise exception 'Terms of Service must be accepted';
  end if;

  select status into v_status
  from public.commission_status
  where id = 'default';

  if coalesce(v_status, 'open') = 'closed'
     and (select auth.uid()) is distinct from v_owner_id then
    raise exception 'Commissions are currently closed';
  end if;

  select id, commission_type, title, description, is_open
  into v_offer
  from public.commission_offers
  where id = p_offer_id;

  if not found or (not v_offer.is_open and (select auth.uid()) is distinct from v_owner_id) then
    raise exception 'Commission offer not available';
  end if;

  if char_length(v_contact) not between 1 and 120 then
    raise exception 'Contact must be between 1 and 120 characters';
  end if;

  if v_image is not null and v_image !~ '^[0-9a-f-]{36}\.(png|jpg|webp|gif)$' then
    raise exception 'Invalid image path';
  end if;

  v_channel_label := case p_contact_channel
    when 'email' then 'Email'
    when 'discord' then 'Discord'
    when 'twitter' then 'Twitter'
    when 'instagram' then 'Instagram'
    else null
  end;

  if v_channel_label is null then
    raise exception 'Invalid contact channel';
  end if;

  select id into v_backlog_id
  from public.kanban_boards
  where is_backlog = true
  limit 1;

  if v_backlog_id is null then
    raise exception 'Backlog board not found';
  end if;

  insert into public.kanban_cards (
    author_id,
    board_id,
    stage_number,
    commission_type,
    title,
    description,
    requestors,
    image_path
  )
  values (
    v_owner_id,
    v_backlog_id,
    '01',
    v_offer.commission_type,
    v_offer.title,
    v_offer.description,
    array[v_channel_label || ': ' || v_contact],
    v_image
  )
  returning id into v_card_id;

  return v_card_id;
end;
$$;

revoke all on function public.submit_commission_request(uuid, text, text, text, text, boolean) from public;
grant execute on function public.submit_commission_request(uuid, text, text, text, text, boolean) to anon, authenticated;
