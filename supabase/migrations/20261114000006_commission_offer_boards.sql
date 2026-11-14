-- Group commission offers into boards with active / waitlist / inactive status (max 2 active boards at once).
create table public.commission_offer_boards (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (description is null or char_length(btrim(description)) <= 240),
  status text not null default 'inactive' check (status in ('active', 'waitlist', 'inactive')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.commission_offer_boards enable row level security;
revoke all on public.commission_offer_boards from anon, authenticated;
grant select on public.commission_offer_boards to anon, authenticated;
grant insert (title, description, status, sort_order) on public.commission_offer_boards to authenticated;
grant update (title, description, status, sort_order) on public.commission_offer_boards to authenticated;
grant delete on public.commission_offer_boards to authenticated;

create policy "Anyone can read visible commission offer boards or site owner reads all"
  on public.commission_offer_boards
  for select to anon, authenticated
  using (
    status in ('active', 'waitlist')
    or (select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid
  );

create policy "Only the site owner can create commission offer boards"
  on public.commission_offer_boards
  for insert to authenticated
  with check (
    (select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid
    and author_id = (select auth.uid())
  );

create policy "Only the site owner can update commission offer boards"
  on public.commission_offer_boards
  for update to authenticated
  using ((select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid)
  with check ((select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid);

create policy "Only the site owner can delete commission offer boards"
  on public.commission_offer_boards
  for delete to authenticated
  using ((select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid);

create trigger prepare_commission_offer_boards_features
  before update on public.commission_offer_boards
  for each row execute function public.prepare_post_features();

create or replace function public.enforce_max_active_offer_boards()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'active' then
    if (
      select count(*)
      from public.commission_offer_boards
      where status = 'active' and id <> new.id
    ) >= 2 then
      raise exception 'At most 2 open commission lists can be active at a time'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_enforce_max_active_offer_boards
  before insert or update on public.commission_offer_boards
  for each row execute function public.enforce_max_active_offer_boards();

insert into public.commission_offer_boards (id, author_id, title, description, status, sort_order)
values
  (
    '00000000-0000-0000-0000-000000000301'::uuid,
    '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid,
    'Streaming & Emotes',
    'Custom static emotes, animated GIFs, and stream stinger transitions.',
    'active',
    1
  ),
  (
    '00000000-0000-0000-0000-000000000302'::uuid,
    '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid,
    'Character Illustrations',
    'Clean lined and shaded busts or half-body character illustrations.',
    'active',
    2
  ),
  (
    '00000000-0000-0000-0000-000000000303'::uuid,
    '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid,
    'Animation Waitlist',
    'Longer 2D animation loops queued on a rolling waitlist.',
    'waitlist',
    3
  ),
  (
    '00000000-0000-0000-0000-000000000304'::uuid,
    '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid,
    'Seasonal Specials',
    'Paused seasonal packs and limited specials.',
    'inactive',
    4
  )
on conflict (id) do nothing;

alter table public.commission_offers
  add column if not exists board_id uuid
    not null
    default '00000000-0000-0000-0000-000000000301'::uuid
    references public.commission_offer_boards(id) on delete cascade;

update public.commission_offers
set board_id = case id
  when '00000000-0000-0000-0000-000000000103'::uuid then '00000000-0000-0000-0000-000000000302'::uuid
  when '00000000-0000-0000-0000-000000000104'::uuid then '00000000-0000-0000-0000-000000000303'::uuid
  when '00000000-0000-0000-0000-000000000106'::uuid then '00000000-0000-0000-0000-000000000304'::uuid
  else board_id
end;

insert into public.commission_offers (
  id, author_id, board_id, commission_type, title, description, price, price_usd, price_idr, image_path, is_open, sort_order, max_requests, request_count
)
values (
  '00000000-0000-0000-0000-000000000107'::uuid,
  '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid,
  '00000000-0000-0000-0000-000000000303'::uuid,
  'Animation',
  'VTuber Loop Waitlist',
  'Expressive 2D looping idle or reaction clip queued via waitlist.',
  '110',
  110,
  1760000,
  null,
  true,
  7,
  2,
  0
)
on conflict (id) do nothing;

alter table public.commission_offers
  alter column board_id drop default;

create index if not exists commission_offers_board_id_idx on public.commission_offers(board_id);

grant insert (board_id) on public.commission_offers to authenticated;
grant update (board_id) on public.commission_offers to authenticated;

drop policy if exists "Anyone can read open commission offers or site owner reads all" on public.commission_offers;
create policy "Anyone can read open commission offers or site owner reads all"
  on public.commission_offers
  for select to anon, authenticated
  using (
    (
      is_open
      and exists (
        select 1
        from public.commission_offer_boards b
        where b.id = commission_offers.board_id
          and b.status in ('active', 'waitlist')
      )
    )
    or (select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid
  );

create or replace function public.submit_commission_request(
  p_offer_id uuid,
  p_description text,
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
  v_board_status text;
  v_description text := btrim(coalesce(p_description, ''));
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

  select id, board_id, commission_type, title, is_open, max_requests, request_count
  into v_offer
  from public.commission_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Commission offer not available';
  end if;

  select status into v_board_status
  from public.commission_offer_boards
  where id = v_offer.board_id;

  if (not v_offer.is_open or coalesce(v_board_status, 'inactive') not in ('active', 'waitlist'))
     and (select auth.uid()) is distinct from v_owner_id then
    raise exception 'Commission offer not available';
  end if;

  if v_offer.max_requests is not null and v_offer.request_count >= v_offer.max_requests then
    raise exception 'Commission request limit reached';
  end if;

  if char_length(v_description) not between 1 and 240 then
    raise exception 'Description must be between 1 and 240 characters';
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
    offer_id,
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
    v_offer.id,
    '01',
    v_offer.commission_type,
    v_offer.title,
    v_description,
    array[v_channel_label || ': ' || v_contact],
    v_image
  )
  returning id into v_card_id;

  update public.commission_offers
  set request_count = request_count + 1
  where id = v_offer.id;

  return v_card_id;
end;
$$;

revoke all on function public.submit_commission_request(uuid, text, text, text, text, boolean) from public;
grant execute on function public.submit_commission_request(uuid, text, text, text, text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
