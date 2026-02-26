create table live_players (
  id uuid default gen_random_uuid() primary key,
  session_id text not null,
  name text not null,
  skill integer not null default 0,
  joined_at timestamptz default now()
);

alter table live_players enable row level security;

create policy "Anyone can insert" on live_players for insert with check (true);
create policy "Anyone can read" on live_players for select using (true);

-- Enable realtime
alter publication supabase_realtime add table live_players;
