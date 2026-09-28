/**
 * Mock database using localStorage — drop-in replacement for Supabase queries.
 * Activated when NEXT_PUBLIC_USE_MOCK=true in .env.local
 */

import type { Team, Player, Match, MatchEvent, Tournament, TournamentTeam, TournamentMatch, TournamentMatchStatus, MatchConfig, MatchPlayer, TournamentEvent, MatchSignature } from '@/types'

const DB_KEY = 'arostats-mock-db'

type MockDB = {
  teams: Team[]
  players: Player[]
  matches: Match[]
  match_events: MatchEvent[]
  tournaments: Tournament[]
  tournament_teams: TournamentTeam[]
  tournament_matches: TournamentMatch[]
  match_configs: MatchConfig[]
  match_players: MatchPlayer[]
  tournament_events: TournamentEvent[]
  match_signatures: MatchSignature[]
}

const EMPTY_DB: MockDB = {
  teams: [],
  players: [],
  matches: [],
  match_events: [],
  tournaments: [],
  tournament_teams: [],
  tournament_matches: [],
  match_configs: [],
  match_players: [],
  tournament_events: [],
  match_signatures: [],
}

function loadDB(): MockDB {
  if (typeof window === 'undefined') return { ...EMPTY_DB }
  try {
    const raw = localStorage.getItem(DB_KEY)
    return raw ? { ...EMPTY_DB, ...JSON.parse(raw) } : { ...EMPTY_DB }
  } catch {
    return { ...EMPTY_DB }
  }
}

function saveDB(db: MockDB) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

function uuid() {
  return crypto.randomUUID()
}

// ── Teams ────────────────────────────────────────────────────────────────────

export async function mockGetTeams(): Promise<Team[]> {
  return loadDB().teams.sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export async function mockCreateTeam(team: Omit<Team, 'id'>): Promise<Team> {
  const db = loadDB()
  const newTeam: Team = { id: uuid(), ...team }
  db.teams.push(newTeam)
  saveDB(db)
  return newTeam
}

export async function mockUpdateTeam(id: string, patch: Partial<Omit<Team, 'id'>>): Promise<Team> {
  const db = loadDB()
  const idx = db.teams.findIndex((t) => t.id === id)
  if (idx === -1) throw new Error('Team not found')
  db.teams[idx] = { ...db.teams[idx], ...patch }
  saveDB(db)
  return db.teams[idx]
}

export async function mockDeleteTeam(id: string): Promise<void> {
  const db = loadDB()
  db.teams = db.teams.filter((t) => t.id !== id)
  db.players = db.players.filter((p) => p.team_id !== id)
  saveDB(db)
}

// ── Players ──────────────────────────────────────────────────────────────────

export async function mockGetPlayers(teamId?: string): Promise<Player[]> {
  const db = loadDB()
  const players = teamId ? db.players.filter((p) => p.team_id === teamId) : db.players
  return players.sort((a, b) => a.numero_camiseta - b.numero_camiseta)
}

export async function mockCreatePlayer(player: Omit<Player, 'id'>): Promise<Player> {
  const db = loadDB()
  const newPlayer: Player = { id: uuid(), ...player }
  db.players.push(newPlayer)
  saveDB(db)
  return newPlayer
}

export async function mockUpdatePlayer(id: string, patch: Partial<Omit<Player, 'id'>>): Promise<Player> {
  const db = loadDB()
  const idx = db.players.findIndex((p) => p.id === id)
  if (idx === -1) throw new Error('Player not found')
  db.players[idx] = { ...db.players[idx], ...patch }
  saveDB(db)
  return db.players[idx]
}

export async function mockDeletePlayer(id: string): Promise<void> {
  const db = loadDB()
  db.players = db.players.filter((p) => p.id !== id)
  saveDB(db)
}

// ── Matches ──────────────────────────────────────────────────────────────────

export async function mockGetMatches(): Promise<Match[]> {
  const db = loadDB()
  return db.matches
    .map((m) => ({
      ...m,
      team_home: db.teams.find((t) => t.id === m.team_home_id),
      team_away: db.teams.find((t) => t.id === m.team_away_id),
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function mockCreateMatch(match: { team_home_id: string; team_away_id: string }): Promise<Match> {
  const db = loadDB()
  const newMatch: Match = {
    id: uuid(),
    ...match,
    status: 'en_curso',
    created_at: new Date().toISOString(),
    team_home: db.teams.find((t) => t.id === match.team_home_id),
    team_away: db.teams.find((t) => t.id === match.team_away_id),
  }
  db.matches.push({ ...newMatch, team_home: undefined, team_away: undefined })
  saveDB(db)
  return newMatch
}

export async function mockFinalizeMatch(id: string): Promise<void> {
  const db = loadDB()
  const idx = db.matches.findIndex((m) => m.id === id)
  if (idx !== -1) {
    db.matches[idx].status = 'finalizado'
    saveDB(db)
  }
}

// ── Events ───────────────────────────────────────────────────────────────────

export async function mockGetMatchEvents(matchId: string): Promise<MatchEvent[]> {
  return loadDB().match_events.filter((e) => e.match_id === matchId)
}

export async function mockSaveEvent(event: Omit<MatchEvent, 'id'>): Promise<MatchEvent> {
  const db = loadDB()
  const newEvent: MatchEvent = { id: uuid(), ...event }
  db.match_events.push(newEvent)
  saveDB(db)
  return newEvent
}

// ── Dev helpers ──────────────────────────────────────────────────────────────

export function mockClearAll() {
  localStorage.removeItem(DB_KEY)
}

// ── Tournaments (mock) ────────────────────────────────────────────────────────

export async function mockGetTournaments(): Promise<Tournament[]> {
  return loadDB().tournaments ?? []
}

export async function mockCreateTournament(t: Omit<Tournament, 'id' | 'created_at'>): Promise<Tournament> {
  const db = loadDB()
  if (!db.tournaments) db.tournaments = []
  const newT: Tournament = { id: uuid(), created_at: new Date().toISOString(), ...t }
  db.tournaments.push(newT)
  saveDB(db)
  return newT
}

export async function mockGetTournamentById(id: string): Promise<Tournament | null> {
  const db = loadDB()
  return (db.tournaments ?? []).find((t) => t.id === id) ?? null
}

export async function mockAuthOperator(username: string, password: string): Promise<Tournament | null> {
  const db = loadDB()
  // In mock mode, password is stored as plaintext for simplicity
  return (db.tournaments ?? []).find(
    (t) => t.op_username === username && t.op_password_hash === password
  ) ?? null
}

// ── Tournament teams (mock) ───────────────────────────────────────────────────

export async function mockGetTournamentTeams(tournamentId: string): Promise<TournamentTeam[]> {
  const db = loadDB()
  return (db.tournament_teams ?? []).filter((t) => t.tournament_id === tournamentId)
}

export async function mockCreateTournamentTeam(team: Omit<TournamentTeam, 'id' | 'created_at'>): Promise<TournamentTeam> {
  const db = loadDB()
  if (!db.tournament_teams) db.tournament_teams = []
  const newTeam: TournamentTeam = { id: uuid(), created_at: new Date().toISOString(), ...team }
  db.tournament_teams.push(newTeam)
  saveDB(db)
  return newTeam
}

export async function mockDeleteTournamentTeam(id: string): Promise<void> {
  const db = loadDB()
  db.tournament_teams = (db.tournament_teams ?? []).filter((t) => t.id !== id)
  saveDB(db)
}

// ── Tournament matches (mock) ─────────────────────────────────────────────────

export async function mockGetTournamentMatches(tournamentId: string): Promise<TournamentMatch[]> {
  const db = loadDB()
  const teams = db.tournament_teams ?? []
  return (db.tournament_matches ?? [])
    .filter((m) => m.tournament_id === tournamentId)
    .sort((a, b) => a.match_order - b.match_order)
    .map((m) => ({
      ...m,
      team_home: teams.find((t) => t.id === m.team_home_id),
      team_away: teams.find((t) => t.id === m.team_away_id),
    }))
}

export async function mockCreateTournamentMatch(match: Omit<TournamentMatch, 'id' | 'created_at' | 'team_home' | 'team_away'>): Promise<TournamentMatch> {
  const db = loadDB()
  if (!db.tournament_matches) db.tournament_matches = []
  const newMatch: TournamentMatch = { id: uuid(), created_at: new Date().toISOString(), ...match }
  db.tournament_matches.push(newMatch)
  saveDB(db)
  return {
    ...newMatch,
    team_home: (db.tournament_teams ?? []).find((t) => t.id === match.team_home_id),
    team_away: (db.tournament_teams ?? []).find((t) => t.id === match.team_away_id),
  }
}

export async function mockUpdateTournamentMatchStatus(id: string, status: TournamentMatchStatus): Promise<void> {
  const db = loadDB()
  const idx = (db.tournament_matches ?? []).findIndex((m) => m.id === id)
  if (idx !== -1) {
    db.tournament_matches[idx].status = status
    saveDB(db)
  }
}

// ── Match config + players (mock) ─────────────────────────────────────────────

export async function mockSaveMatchConfig(config: Omit<MatchConfig, 'id' | 'created_at'>): Promise<MatchConfig> {
  const db = loadDB()
  if (!db.match_configs) db.match_configs = []
  const existing = db.match_configs.findIndex((c) => c.tournament_match_id === config.tournament_match_id)
  const record: MatchConfig = { id: existing >= 0 ? db.match_configs[existing].id : uuid(), created_at: new Date().toISOString(), ...config }
  if (existing >= 0) db.match_configs[existing] = record
  else db.match_configs.push(record)
  saveDB(db)
  return record
}

export async function mockGetMatchConfig(tournamentMatchId: string): Promise<MatchConfig | null> {
  return (loadDB().match_configs ?? []).find((c) => c.tournament_match_id === tournamentMatchId) ?? null
}

export async function mockGetMatchPlayers(tournamentMatchId: string): Promise<MatchPlayer[]> {
  return (loadDB().match_players ?? []).filter((p) => p.tournament_match_id === tournamentMatchId)
}

export async function mockSaveMatchPlayer(player: Omit<MatchPlayer, 'id'>): Promise<MatchPlayer> {
  const db = loadDB()
  if (!db.match_players) db.match_players = []
  const newPlayer: MatchPlayer = { id: uuid(), ...player }
  db.match_players.push(newPlayer)
  saveDB(db)
  return newPlayer
}

export async function mockDeleteMatchPlayer(id: string): Promise<void> {
  const db = loadDB()
  db.match_players = (db.match_players ?? []).filter((p) => p.id !== id)
  saveDB(db)
}

// ── Tournament events (mock) ──────────────────────────────────────────────────

export async function mockSaveTournamentEvent(event: Omit<TournamentEvent, 'id' | 'is_deleted'>): Promise<TournamentEvent> {
  const db = loadDB()
  if (!db.tournament_events) db.tournament_events = []
  const newEvent: TournamentEvent = { id: uuid(), is_deleted: false, ...event }
  db.tournament_events.push(newEvent)
  saveDB(db)
  return newEvent
}

export async function mockSoftDeleteTournamentEvent(id: string): Promise<void> {
  const db = loadDB()
  const idx = (db.tournament_events ?? []).findIndex((e) => e.id === id)
  if (idx !== -1) {
    db.tournament_events[idx].is_deleted = true
    saveDB(db)
  }
}

export async function mockGetTournamentEvents(tournamentMatchId: string): Promise<TournamentEvent[]> {
  return (loadDB().tournament_events ?? []).filter((e) => e.tournament_match_id === tournamentMatchId)
}

// ── Signatures (mock) ─────────────────────────────────────────────────────────

export async function mockSaveSignature(sig: Omit<MatchSignature, 'id' | 'signed_at'>): Promise<MatchSignature> {
  const db = loadDB()
  if (!db.match_signatures) db.match_signatures = []
  const existing = db.match_signatures.findIndex(
    (s) => s.tournament_match_id === sig.tournament_match_id && s.rol === sig.rol
  )
  const record: MatchSignature = { id: existing >= 0 ? db.match_signatures[existing].id : uuid(), signed_at: new Date().toISOString(), ...sig }
  if (existing >= 0) db.match_signatures[existing] = record
  else db.match_signatures.push(record)
  saveDB(db)
  return record
}

export async function mockGetSignatures(tournamentMatchId: string): Promise<MatchSignature[]> {
  return (loadDB().match_signatures ?? []).filter((s) => s.tournament_match_id === tournamentMatchId)
}

export function mockSeedData() {
  const db = loadDB()
  if (db.teams.length > 0) return // already seeded

  const teamA: Team = { id: uuid(), nombre: 'Los Tigres', color: '#F59E0B' }
  const teamB: Team = { id: uuid(), nombre: 'Los Leones', color: '#3B82F6' }
  db.teams.push(teamA, teamB)

  const playersA: Player[] = [
    { id: uuid(), team_id: teamA.id, nombre: 'Carlos Pérez', numero_camiseta: 5 },
    { id: uuid(), team_id: teamA.id, nombre: 'Andrés García', numero_camiseta: 8 },
    { id: uuid(), team_id: teamA.id, nombre: 'Miguel Torres', numero_camiseta: 14 },
    { id: uuid(), team_id: teamA.id, nombre: 'Juan Rodríguez', numero_camiseta: 23 },
    { id: uuid(), team_id: teamA.id, nombre: 'Luis Martínez', numero_camiseta: 32 },
  ]
  const playersB: Player[] = [
    { id: uuid(), team_id: teamB.id, nombre: 'Roberto Silva', numero_camiseta: 4 },
    { id: uuid(), team_id: teamB.id, nombre: 'Diego López', numero_camiseta: 7 },
    { id: uuid(), team_id: teamB.id, nombre: 'Fernando Ruiz', numero_camiseta: 11 },
    { id: uuid(), team_id: teamB.id, nombre: 'Pablo Díaz', numero_camiseta: 21 },
    { id: uuid(), team_id: teamB.id, nombre: 'Sergio Castro', numero_camiseta: 33 },
  ]
  db.players.push(...playersA, ...playersB)
  saveDB(db)
}
