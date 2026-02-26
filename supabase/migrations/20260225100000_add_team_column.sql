alter table live_players add column team text;

create policy "Anyone can update" on live_players for update using (true) with check (true);
