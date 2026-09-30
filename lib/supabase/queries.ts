import type {
  Team, Player, Match, MatchEvent,
  Tournament, TournamentTeam, TournamentMatch, TournamentMatchStatus,
  MatchConfig, MatchPlayer, TournamentEvent, MatchSignature,
} from '@/types'

async function db() {
  const { supabase } = await import('./client')
  return supabase
}

// ── Teams ────────────────────────────────────────────────────────────────────

export async function getTeams(): Promise<Team[]> {
  const supabase = await db()
  const { data, error } = await supabase.from('teams').select('*').order('nombre')
  if (error) throw error
  return data
}

export async function createTeam(team: Omit<Team, 'id'>): Promise<Team> {
  const supabase = await db()
  const { data, error } = await supabase.from('teams').insert(team).select().single()
  if (error) throw error
  return data
}

export async function updateTeam(id: string, team: Partial<Omit<Team, 'id'>>): Promise<Team> {
  const supabase = await db()
  const { data, error } = await supabase.from('teams').update(team).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteTeam(id: string): Promise<void> {
  const supabase = await db()
  const { error } = await supabase.from('teams').delete().eq('id', id)
  if (error) throw error
}

// ── Players ──────────────────────────────────────────────────────────────────

export async function getPlayers(teamId?: string): Promise<Player[]> {
  const supabase = await db()
  let query = supabase.from('players').select('*').order('numero_camiseta')
  if (teamId) query = query.eq('team_id', teamId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createPlayer(player: Omit<Player, 'id'>): Promise<Player> {
  const supabase = await db()
  const { data, error } = await supabase.from('players').insert(player).select().single()
  if (error) throw error
  return data
}

export async function updatePlayer(id: string, player: Partial<Omit<Player, 'id'>>): Promise<Player> {
  const supabase = await db()
  const { data, error } = await supabase.from('players').update(player).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deletePlayer(id: string): Promise<void> {
  const supabase = await db()
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) throw error
}

// ── Matches ──────────────────────────────────────────────────────────────────

export async function getMatches(): Promise<Match[]> {
  const supabase = await db()
  const { data, error } = await supabase
    .from('matches')
    .select('*, team_home:teams!team_home_id(*), team_away:teams!team_away_id(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createMatch(match: { team_home_id: string; team_away_id: string }): Promise<Match> {
  const supabase = await db()
  const { data, error } = await supabase
    .from('matches')
    .insert({ ...match, status: 'en_curso' })
    .select('*, team_home:teams!team_home_id(*), team_away:teams!team_away_id(*)')
    .single()
  if (error) throw error
  return data
}

export async function finalizeMatch(id: string): Promise<void> {
  const supabase = await db()
  const { error } = await supabase.from('matches').update({ status: 'finalizado' }).eq('id', id)
  if (error) throw error
}

// ── Events ───────────────────────────────────────────────────────────────────

export async function getMatchEvents(matchId: string): Promise<MatchEvent[]> {
  const supabase = await db()
  const { data, error } = await supabase
    .from('match_events')
    .select('*')
    .eq('match_id', matchId)
    .order('timestamp')
  if (error) throw error
  return data
}

export async function saveEvent(event: Omit<MatchEvent, 'id'>): Promise<MatchEvent> {
  const supabase = await db()
  const { data, error } = await supabase.from('match_events').insert(event).select().single()
  if (error) throw error
  return data
}

// ── Tournaments ───────────────────────────────────────────────────────────────

export async function getTournaments(): Promise<Tournament[]> {
  const supabase = await db()
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createTournament(t: Omit<Tournament, 'id' | 'created_at'>): Promise<Tournament> {
  const supabase = await db()
  const { data, error } = await supabase.from('tournaments').insert(t).select().single()
  if (error) throw error
  return data
}

export async function updateTournament(id: string, patch: Partial<Pick<Tournament, 'nombre' | 'max_partidos' | 'status'>>): Promise<void> {
  const supabase = await db()
  const { error } = await supabase.from('tournaments').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteTournamentCascade(id: string): Promise<void> {
  const supabase = await db()
  // Get all match ids for this tournament
  const { data: matches } = await supabase.from('tournament_matches').select('id').eq('tournament_id', id)
  const matchIds = (matches ?? []).map((m: { id: string }) => m.id)

  if (matchIds.length > 0) {
    // Delete all child records per match in dependency order
    await supabase.from('tournament_events').delete().in('tournament_match_id', matchIds)
    await supabase.from('match_players').delete().in('tournament_match_id', matchIds)
    await supabase.from('match_signatures').delete().in('tournament_match_id', matchIds)
    await supabase.from('match_configs').delete().in('tournament_match_id', matchIds)
    await supabase.from('tournament_matches').delete().in('id', matchIds)
  }

  await supabase.from('tournament_teams').delete().eq('tournament_id', id)
  const { error } = await supabase.from('tournaments').delete().eq('id', id)
  if (error) throw error
}

export async function authOperator(username: string, password: string): Promise<Tournament | null> {
  const supabase = await db()
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('op_username', username)
    .single()
  if (error || !data) return null
  const bcrypt = await import('bcryptjs')
  const ok = await bcrypt.compare(password, data.op_password_hash)
  return ok ? data : null
}

// ── Tournament teams ──────────────────────────────────────────────────────────

export async function getTournamentTeams(tournamentId: string): Promise<TournamentTeam[]> {
  const supabase = await db()
  const { data, error } = await supabase
    .from('tournament_teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at')
  if (error) throw error
  return data
}

export async function createTournamentTeam(team: Omit<TournamentTeam, 'id' | 'created_at'>): Promise<TournamentTeam> {
  const supabase = await db()
  const { data, error } = await supabase.from('tournament_teams').insert(team).select().single()
  if (error) throw error
  return data
}

export async function deleteTournamentTeam(id: string): Promise<void> {
  const supabase = await db()
  const { error } = await supabase.from('tournament_teams').delete().eq('id', id)
  if (error) throw error
}

// ── Tournament matches ────────────────────────────────────────────────────────

export async function getTournamentMatches(tournamentId: string): Promise<TournamentMatch[]> {
  const supabase = await db()
  const { data, error } = await supabase
    .from('tournament_matches')
    .select('*, team_home:tournament_teams!team_home_id(*), team_away:tournament_teams!team_away_id(*)')
    .eq('tournament_id', tournamentId)
    .order('match_order')
  if (error) throw error
  return data
}

export async function createTournamentMatch(
  match: Omit<TournamentMatch, 'id' | 'created_at' | 'team_home' | 'team_away'>
): Promise<TournamentMatch> {
  const supabase = await db()
  const { data, error } = await supabase
    .from('tournament_matches')
    .insert(match)
    .select('*, team_home:tournament_teams!team_home_id(*), team_away:tournament_teams!team_away_id(*)')
    .single()
  if (error) throw error
  return data
}

export async function updateTournamentMatchStatus(id: string, status: TournamentMatchStatus): Promise<void> {
  const supabase = await db()
  const { error } = await supabase.from('tournament_matches').update({ status }).eq('id', id)
  if (error) throw error
}

// ── Match config + players ────────────────────────────────────────────────────

export async function saveMatchConfig(config: Omit<MatchConfig, 'id' | 'created_at'>): Promise<MatchConfig> {
  const supabase = await db()
  const { data, error } = await supabase
    .from('match_configs')
    .upsert(config, { onConflict: 'tournament_match_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getMatchConfig(tournamentMatchId: string): Promise<MatchConfig | null> {
  const supabase = await db()
  const { data } = await supabase
    .from('match_configs')
    .select('*')
    .eq('tournament_match_id', tournamentMatchId)
    .single()
  return data ?? null
}

export async function getMatchPlayers(tournamentMatchId: string): Promise<MatchPlayer[]> {
  const supabase = await db()
  const { data, error } = await supabase
    .from('match_players')
    .select('*')
    .eq('tournament_match_id', tournamentMatchId)
  if (error) throw error
  return data
}

export async function saveMatchPlayer(player: Omit<MatchPlayer, 'id'>): Promise<MatchPlayer> {
  const supabase = await db()
  const { data, error } = await supabase.from('match_players').insert(player).select().single()
  if (error) throw error
  return data
}

export async function deleteMatchPlayer(id: string): Promise<void> {
  const supabase = await db()
  const { error } = await supabase.from('match_players').delete().eq('id', id)
  if (error) throw error
}

// ── Tournament events ─────────────────────────────────────────────────────────

export async function saveTournamentEvent(
  event: Omit<TournamentEvent, 'id' | 'is_deleted'>
): Promise<TournamentEvent> {
  const supabase = await db()
  const { data, error } = await supabase
    .from('tournament_events')
    .insert({ ...event, is_deleted: false })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function softDeleteTournamentEvent(id: string): Promise<void> {
  const supabase = await db()
  const { error } = await supabase
    .from('tournament_events')
    .update({ is_deleted: true })
    .eq('id', id)
  if (error) throw error
}

export async function getTournamentEvents(tournamentMatchId: string): Promise<TournamentEvent[]> {
  const supabase = await db()
  const { data, error } = await supabase
    .from('tournament_events')
    .select('*')
    .eq('tournament_match_id', tournamentMatchId)
    .order('timestamp')
  if (error) throw error
  return data
}

// ── Signatures ────────────────────────────────────────────────────────────────

export async function saveSignature(sig: Omit<MatchSignature, 'id' | 'signed_at'>): Promise<MatchSignature> {
  const supabase = await db()
  const { data, error } = await supabase
    .from('match_signatures')
    .upsert(sig, { onConflict: 'tournament_match_id,rol' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getSignatures(tournamentMatchId: string): Promise<MatchSignature[]> {
  const supabase = await db()
  const { data, error } = await supabase
    .from('match_signatures')
    .select('*')
    .eq('tournament_match_id', tournamentMatchId)
  if (error) throw error
  return data
}
