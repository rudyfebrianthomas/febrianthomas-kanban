alter table public.kanban_cards
  add column commission_type text not null default 'Illustration'
  check (commission_type in ('Emote', 'GIF', 'Animation', 'Illustration', 'Transition'));

grant insert (commission_type) on public.kanban_cards to authenticated;
grant update (commission_type) on public.kanban_cards to authenticated;
