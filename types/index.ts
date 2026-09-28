export type SportConfig = {
  id: string
  name: string
  rules: Record<string, unknown>
}

export type Team = {
  id: string
  nombre: string
  logo_url?: string
  color?: string
}

export type Player = {
  id: string
  team_id: string
  nombre: string
  numero_camiseta: number
}

export type MatchStatus = 'en_curso' | 'finalizado'

export type Match = {
  id: string
  team_home_id: string
  team_away_id: string
  status: MatchStatus
  created_at: string
  team_home?: Team
  team_away?: Team
}

export type EventType =
  | 'canasta_2'
  | 'canasta_3'
  | 'tiro_libre'
  | 'falta'
  | 'tiempo_fuera'
  | 'robo'
  | 'bloqueo'
  | 'rebote'

export type MatchEvent = {
  id: string
  match_id: string
  player_id: string
  event_type: EventType
  coord_x?: number
  coord_y?: number
  calculated_points: number
  timestamp: string
}

export type InteractionMode = 'dnd' | 'taptap'

export type Quarter = 1 | 2 | 3 | 4 | 'OT'

// ── Tournament types ──────────────────────────────────────────────────────────

export type TournamentStatus = 'activo' | 'finalizado' | 'expirado'

export type Tournament = {
  id: string
  nombre: string
  max_partidos: number
  op_username: string
  op_password_hash: string
  expires_at?: string
  status: TournamentStatus
  created_at: string
}

export type TournamentTeam = {
  id: string
  tournament_id: string
  nombre: string
  ciudad: string
  categoria: string
  genero: string
  created_at: string
}

export type TournamentMatchStatus = 'pendiente' | 'en_curso' | 'finalizado'

export type TournamentMatch = {
  id: string
  tournament_id: string
  team_home_id: string
  team_away_id: string
  match_order: number
  scheduled_at?: string
  status: TournamentMatchStatus
  created_at: string
  team_home?: TournamentTeam
  team_away?: TournamentTeam
}

export type MatchConfig = {
  id: string
  tournament_match_id: string
  arbitro_principal: string
  arbitro_auxiliar: string
  planillero: string
  anotador: string
  notas: string
  possession_home: boolean
  created_at: string
}

export type MatchPlayer = {
  id: string
  tournament_match_id: string
  team_id: string
  nombre: string
  numero: number
  is_starter: boolean
  is_captain: boolean
}

export type TournamentEventType =
  | 'canasta_2'
  | 'canasta_3'
  | 'tiro_libre'
  | 'falta_personal'
  | 'falta_tecnica'
  | 'tiempo_fuera'
  | 'robo'
  | 'bloqueo'
  | 'rebote_of'
  | 'rebote_def'
  | 'perdida'

export type TournamentEvent = {
  id: string
  tournament_match_id: string
  player_id: string
  event_type: TournamentEventType
  cuarto: number
  clock_at_event?: string
  coord_x?: number
  coord_y?: number
  calculated_points: number
  is_deleted: boolean
  timestamp: string
}

export type SignatureRole = 'arbitro_principal' | 'arbitro_auxiliar' | 'coach_home' | 'coach_away'

export type MatchSignature = {
  id: string
  tournament_match_id: string
  rol: SignatureRole
  signer_name: string
  signature_svg: string
  signed_at: string
}

// ── FIBA basketball rules constants ──────────────────────────────────────────

export const FIBA_RULES = {
  QUARTER_DURATION_SECONDS: 600,      // 10 minutes
  OVERTIME_DURATION_SECONDS: 300,     // 5 minutes
  PERSONAL_FOULS_LIMIT: 5,            // 5th foul = disqualified
  TEAM_FOULS_BONUS_THRESHOLD: 4,      // 5th team foul in quarter → 2 free throws
  TIMEOUTS_FIRST_HALF: 2,             // Q1+Q2 combined
  TIMEOUTS_SECOND_HALF: 3,            // Q3+Q4 combined
  TIMEOUTS_OVERTIME: 1,
  PLAYERS_ON_COURT: 5,
} as const

// ── Auth ──────────────────────────────────────────────────────────────────────

export type OperatorSession = {
  tournament_id: string
  tournament_nombre: string
  op_username: string
  logged_in_at: string
}
