-- Limit open commission lists to at most 1 active and 1 waitlist at a time (2 visible total).

with ranked as (
  select
    id,
    row_number() over (partition by status order by sort_order asc, created_at asc, id asc) as rn
  from public.commission_offer_boards
  where status in ('active', 'waitlist')
)
update public.commission_offer_boards b
set status = 'inactive'
from ranked r
where b.id = r.id
  and r.rn > 1;

create or replace function public.enforce_max_active_offer_boards()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('active', 'waitlist') then
    if exists (
      select 1
      from public.commission_offer_boards
      where status = new.status and id <> new.id
    ) then
      if new.status = 'active' then
        raise exception 'At most 1 open commission list can be active at a time'
          using errcode = 'P0001';
      else
        raise exception 'At most 1 open commission list can be on waitlist at a time'
          using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create unique index if not exists commission_offer_boards_unique_visible_status_idx
  on public.commission_offer_boards (status)
  where status in ('active', 'waitlist');
