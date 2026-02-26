-- Enable full replica identity so realtime UPDATE events include all columns
alter table live_players replica identity full;
