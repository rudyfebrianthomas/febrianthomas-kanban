-- Public commission request intake: inserts onto the Backlog board when open/waitlist,
-- or always when called by the site owner.
create or replace function public.submit_commission_request(
  p_commission_type text,
  p_title text,
  p_description text,
  p_contact_channel text,
  p_contact_value text,
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
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_contact text := btrim(coalesce(p_contact_value, ''));
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

  if p_commission_type not in ('Emote', 'GIF', 'Animation', 'Illustration', 'Transition') then
    raise exception 'Invalid commission type';
  end if;

  if char_length(v_title) not between 1 and 120 then
    raise exception 'Title must be between 1 and 120 characters';
  end if;

  if char_length(v_description) not between 1 and 240 then
    raise exception 'Description must be between 1 and 240 characters';
  end if;

  if char_length(v_contact) not between 1 and 120 then
    raise exception 'Contact must be between 1 and 120 characters';
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
    requestors
  )
  values (
    v_owner_id,
    v_backlog_id,
    '01',
    p_commission_type,
    v_title,
    v_description,
    array[v_channel_label || ': ' || v_contact]
  )
  returning id into v_card_id;

  return v_card_id;
end;
$$;

revoke all on function public.submit_commission_request(text, text, text, text, text, boolean) from public;
grant execute on function public.submit_commission_request(text, text, text, text, text, boolean) to anon, authenticated;
