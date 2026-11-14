alter table public.commission_offers
  add column if not exists max_requests integer check (max_requests is null or max_requests >= 1),
  add column if not exists request_count integer not null default 0 check (request_count >= 0);

grant insert (max_requests) on public.commission_offers to authenticated;
grant update (max_requests, request_count) on public.commission_offers to authenticated;

alter table public.kanban_cards
  add column if not exists offer_id uuid references public.commission_offers(id) on delete set null;

create or replace function public.decrement_offer_request_count_on_backlog_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.offer_id is not null and exists (
    select 1
    from public.kanban_boards
    where id = old.board_id and is_backlog = true
  ) then
    update public.commission_offers
    set request_count = greatest(request_count - 1, 0)
    where id = old.offer_id;
  end if;
  return old;
end;
$$;

create trigger trg_kanban_cards_backlog_delete_offer_count
  after delete on public.kanban_cards
  for each row
  execute function public.decrement_offer_request_count_on_backlog_delete();

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

  select id, commission_type, title, is_open, max_requests, request_count
  into v_offer
  from public.commission_offers
  where id = p_offer_id
  for update;

  if not found or (not v_offer.is_open and (select auth.uid()) is distinct from v_owner_id) then
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
