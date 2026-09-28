-- Enable pg_cron extension (run as superuser in Supabase dashboard if needed)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Sport configs
CREATE TABLE IF NOT EXISTS sport_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  rules jsonb NOT NULL DEFAULT '{}'
);

INSERT INTO sport_configs (name, rules) VALUES (
  'basketball',
  '{
    "quarters": 4,
    "quarter_duration_minutes": 10,
    "players_per_team": 5,
    "fouls_limit": 5,
    "timeouts_per_half": 3
  }'::jsonb
) ON CONFLICT (name) DO NOTHING;

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  logo_url text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Players
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  numero_camiseta integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, numero_camiseta)
);

-- Matches
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_home_id uuid NOT NULL REFERENCES teams(id),
  team_away_id uuid NOT NULL REFERENCES teams(id),
  status text NOT NULL DEFAULT 'en_curso' CHECK (status IN ('en_curso', 'finalizado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Match events
CREATE TABLE IF NOT EXISTS match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id),
  event_type text NOT NULL CHECK (event_type IN (
    'canasta_2', 'canasta_3', 'tiro_libre', 'falta',
    'tiempo_fuera', 'robo', 'bloqueo', 'rebote'
  )),
  coord_x numeric,
  coord_y numeric,
  calculated_points integer NOT NULL DEFAULT 0,
  timestamp timestamptz NOT NULL DEFAULT now()
);

-- Auto-purge job: delete matches older than 24 hours
-- Run in Supabase SQL editor with pg_cron enabled:
-- SELECT cron.schedule(
--   'purge-old-matches',
--   '0 * * * *',
--   $$DELETE FROM matches WHERE created_at < now() - interval '24 hours'$$
-- );

-- Enable Row Level Security (adjust policies for your auth setup)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;

-- Permissive policies for development (tighten for production)
CREATE POLICY "public_read_teams" ON teams FOR SELECT USING (true);
CREATE POLICY "public_write_teams" ON teams FOR ALL USING (true);
CREATE POLICY "public_read_players" ON players FOR SELECT USING (true);
CREATE POLICY "public_write_players" ON players FOR ALL USING (true);
CREATE POLICY "public_read_matches" ON matches FOR SELECT USING (true);
CREATE POLICY "public_write_matches" ON matches FOR ALL USING (true);
CREATE POLICY "public_read_events" ON match_events FOR SELECT USING (true);
CREATE POLICY "public_write_events" ON match_events FOR ALL USING (true);
