create table session_teams (
  session_id text primary key,
  teams_json text not null,
  published_at timestamptz default now()
);

alter table session_teams enable row level security;

create policy "Anyone can insert" on session_teams for insert with check (true);
create policy "Anyone can read" on session_teams for select using (true);
create policy "Anyone can update" on session_teams for update using (true) with check (true);
