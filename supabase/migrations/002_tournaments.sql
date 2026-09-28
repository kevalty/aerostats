-- ============================================================
-- FASE 2: Tournaments, tournament teams, match schedule, etc.
-- ============================================================

-- Tournaments (created by admin)
CREATE TABLE IF NOT EXISTS tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  max_partidos integer NOT NULL DEFAULT 5,
  op_username text NOT NULL UNIQUE,
  op_password_hash text NOT NULL,        -- bcrypt hash
  expires_at timestamptz,               -- null = manual expiry
  status text NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'finalizado', 'expirado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Teams registered in a tournament
CREATE TABLE IF NOT EXISTS tournament_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  ciudad text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT '',    -- "Sub-14", "Sub-15", libre texto
  genero text NOT NULL DEFAULT '',       -- libre texto
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Scheduled matches within a tournament
CREATE TABLE IF NOT EXISTS tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_home_id uuid NOT NULL REFERENCES tournament_teams(id),
  team_away_id uuid NOT NULL REFERENCES tournament_teams(id),
  match_order integer NOT NULL DEFAULT 1,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_curso', 'finalizado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Per-match configuration (refs, table official)
CREATE TABLE IF NOT EXISTS match_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_match_id uuid NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE UNIQUE,
  arbitro_principal text NOT NULL DEFAULT '',
  arbitro_auxiliar text NOT NULL DEFAULT '',
  planillero text NOT NULL DEFAULT '',
  anotador text NOT NULL DEFAULT '',
  notas text NOT NULL DEFAULT '',
  possession_home boolean NOT NULL DEFAULT true,  -- true = home has first possession
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Players registered per match (not globally — per encounter)
CREATE TABLE IF NOT EXISTS match_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_match_id uuid NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES tournament_teams(id),
  nombre text NOT NULL,
  numero integer NOT NULL,
  is_starter boolean NOT NULL DEFAULT false,
  is_captain boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_match_id, team_id, numero)
);

-- Events for tournament matches (replaces old match_events for new flow)
CREATE TABLE IF NOT EXISTS tournament_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_match_id uuid NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES match_players(id),
  event_type text NOT NULL CHECK (event_type IN (
    'canasta_2', 'canasta_3', 'tiro_libre', 'falta_personal', 'falta_tecnica',
    'tiempo_fuera', 'robo', 'bloqueo', 'rebote_of', 'rebote_def', 'perdida'
  )),
  cuarto integer NOT NULL DEFAULT 1,
  clock_at_event text,                  -- "MM:SS" snapshot when event occurred
  coord_x numeric,
  coord_y numeric,
  calculated_points integer NOT NULL DEFAULT 0,
  is_deleted boolean NOT NULL DEFAULT false,  -- soft delete for corrections
  timestamp timestamptz NOT NULL DEFAULT now()
);

-- Digital signatures at end of match
CREATE TABLE IF NOT EXISTS match_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_match_id uuid NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  rol text NOT NULL CHECK (rol IN ('arbitro_principal', 'arbitro_auxiliar', 'coach_home', 'coach_away')),
  signer_name text NOT NULL DEFAULT '',
  signature_svg text NOT NULL,          -- SVG path data of finger signature
  signed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_match_id, rol)
);

-- RLS
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_signatures ENABLE ROW LEVEL SECURITY;

-- Dev: open policies (tighten for production with proper auth checks)
CREATE POLICY "open_tournaments" ON tournaments FOR ALL USING (true);
CREATE POLICY "open_tournament_teams" ON tournament_teams FOR ALL USING (true);
CREATE POLICY "open_tournament_matches" ON tournament_matches FOR ALL USING (true);
CREATE POLICY "open_match_configs" ON match_configs FOR ALL USING (true);
CREATE POLICY "open_match_players" ON match_players FOR ALL USING (true);
CREATE POLICY "open_tournament_events" ON tournament_events FOR ALL USING (true);
CREATE POLICY "open_match_signatures" ON match_signatures FOR ALL USING (true);
