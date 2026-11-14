-- Derive global commission_status from active/waitlist/inactive commission_offer_boards:
-- - waitlist list exists (alone or with active) -> 'waitlist'
-- - active list exists (no waitlist)           -> 'open'
-- - neither active nor waitlist exists          -> 'closed'

create or replace function public.sync_commission_status_from_offer_boards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_status text;
begin
  select
    case
      when exists (select 1 from public.commission_offer_boards where status = 'waitlist') then 'waitlist'
      when exists (select 1 from public.commission_offer_boards where status = 'active') then 'open'
      else 'closed'
    end
  into v_next_status;

  update public.commission_status
  set status = v_next_status
  where id = 'default';

  return null;
end;
$$;

drop trigger if exists sync_commission_status_after_offer_board_change on public.commission_offer_boards;
create trigger sync_commission_status_after_offer_board_change
  after insert or update of status or delete on public.commission_offer_boards
  for each statement
  execute function public.sync_commission_status_from_offer_boards();

update public.commission_status
set status = case
  when exists (select 1 from public.commission_offer_boards where status = 'waitlist') then 'waitlist'
  when exists (select 1 from public.commission_offer_boards where status = 'active') then 'open'
  else 'closed'
end
where id = 'default';
