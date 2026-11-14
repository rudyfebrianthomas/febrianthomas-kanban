alter table public.commission_offers
  add column if not exists price_usd numeric(12, 2) not null default 0 check (price_usd >= 0),
  add column if not exists price_idr numeric(14, 0) not null default 0 check (price_idr >= 0);

update public.commission_offers
set
  price_usd = coalesce(nullif(regexp_replace(price, '[^0-9.]', '', 'g'), '')::numeric, 0),
  price_idr = round(coalesce(nullif(regexp_replace(price, '[^0-9.]', '', 'g'), '')::numeric, 0) * 16000)
where price_usd = 0 and price_idr = 0;

grant insert (price_usd, price_idr) on public.commission_offers to authenticated;
grant update (price_usd, price_idr) on public.commission_offers to authenticated;

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

  select id, commission_type, title, is_open
  into v_offer
  from public.commission_offers
  where id = p_offer_id;

  if not found or (not v_offer.is_open and (select auth.uid()) is distinct from v_owner_id) then
    raise exception 'Commission offer not available';
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
    v_description,
    array[v_channel_label || ': ' || v_contact],
    v_image
  )
  returning id into v_card_id;

  return v_card_id;
end;
$$;

revoke all on function public.submit_commission_request(uuid, text, text, text, text, boolean) from public;
grant execute on function public.submit_commission_request(uuid, text, text, text, text, boolean) to anon, authenticated;
