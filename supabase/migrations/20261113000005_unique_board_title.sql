create unique index if not exists kanban_boards_title_unique_idx
  on public.kanban_boards (lower(btrim(title)));
