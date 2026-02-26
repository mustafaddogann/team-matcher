create table chat_messages (
  id uuid default gen_random_uuid() primary key,
  session_id text not null,
  channel text not null,          -- '__lobby__' or team name
  sender_name text not null,
  body text not null,
  sent_at timestamptz default now()
);

create index idx_chat_messages_lookup on chat_messages (session_id, channel);

alter table chat_messages enable row level security;
create policy "Anyone can insert" on chat_messages for insert with check (true);
create policy "Anyone can read" on chat_messages for select using (true);

alter publication supabase_realtime add table chat_messages;
