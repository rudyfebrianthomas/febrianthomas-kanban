-- Commission availability status & slot indicator; public read, site owner update.
create table public.commission_status (
  id text primary key default 'default' check (id = 'default'),
  status text not null default 'open' check (status in ('open', 'waitlist', 'closed')),
  slots_open integer not null default 3 check (slots_open >= 0 and slots_open <= 99),
  slots_total integer not null default 5 check (slots_total >= 0 and slots_total <= 99),
  updated_at timestamptz
);

alter table public.commission_status enable row level security;
revoke all on public.commission_status from anon, authenticated;
grant select on public.commission_status to anon, authenticated;
grant update (status, slots_open, slots_total) on public.commission_status to authenticated;

create policy "Anyone can read commission status" on public.commission_status
  for select to anon, authenticated using (true);

create policy "Only the site owner can update commission status" on public.commission_status
  for update to authenticated
  using ((select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid)
  with check ((select auth.uid()) = '1007e0fb-6f2f-473f-8305-067666bc643f'::uuid);

create trigger prepare_commission_status_features before update on public.commission_status
  for each row execute function public.prepare_post_features();

insert into public.commission_status (id, status, slots_open, slots_total)
values ('default', 'open', 3, 5)
on conflict (id) do nothing;
