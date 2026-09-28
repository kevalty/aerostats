import type { Team, Player, Match, MatchEvent } from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

// ── Teams ────────────────────────────────────────────────────────────────────

export async function getTeams(): Promise<Team[]> {
  if (USE_MOCK) {
    const { mockGetTeams } = await import('./mock-db')
    return mockGetTeams()
  }
  const { supabase } = await import('./client')
  const { data, error } = await supabase.from('teams').select('*').order('nombre')
  if (error) throw error
  return data
}

export async function createTeam(team: Omit<Team, 'id'>): Promise<Team> {
  if (USE_MOCK) {
    const { mockCreateTeam } = await import('./mock-db')
    return mockCreateTeam(team)
  }
  const { supabase } = await import('./client')
  const { data, error } = await supabase.from('teams').insert(team).select().single()
  if (error) throw error
  return data
}

export async function updateTeam(id: string, team: Partial<Omit<Team, 'id'>>): Promise<Team> {
  if (USE_MOCK) {
    const { mockUpdateTeam } = await import('./mock-db')
    return mockUpdateTeam(id, team)
  }
  const { supabase } = await import('./client')
  const { data, error } = await supabase.from('teams').update(team).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteTeam(id: string): Promise<void> {
  if (USE_MOCK) {
    const { mockDeleteTeam } = await import('./mock-db')
    return mockDeleteTeam(id)
  }
  const { supabase } = await import('./client')
  const { error } = await supabase.from('teams').delete().eq('id', id)
  if (error) throw error
}

// ── Players ──────────────────────────────────────────────────────────────────

export async function getPlayers(teamId?: string): Promise<Player[]> {
  if (USE_MOCK) {
    const { mockGetPlayers } = await import('./mock-db')
    return mockGetPlayers(teamId)
  }
  const { supabase } = await import('./client')
  let query = supabase.from('players').select('*').order('numero_camiseta')
  if (teamId) query = query.eq('team_id', teamId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createPlayer(player: Omit<Player, 'id'>): Promise<Player> {
  if (USE_MOCK) {
    const { mockCreatePlayer } = await import('./mock-db')
    return mockCreatePlayer(player)
  }
  const { supabase } = await import('./client')
  const { data, error } = await supabase.from('players').insert(player).select().single()
  if (error) throw error
  return data
}

export async function updatePlayer(id: string, player: Partial<Omit<Player, 'id'>>): Promise<Player> {
  if (USE_MOCK) {
    const { mockUpdatePlayer } = await import('./mock-db')
    return mockUpdatePlayer(id, player)
  }
  const { supabase } = await import('./client')
  const { data, error } = await supabase.from('players').update(player).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deletePlayer(id: string): Promise<void> {
  if (USE_MOCK) {
    const { mockDeletePlayer } = await import('./mock-db')
    return mockDeletePlayer(id)
  }
  const { supabase } = await import('./client')
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) throw error
}

// ── Matches ──────────────────────────────────────────────────────────────────

export async function getMatches(): Promise<Match[]> {
  if (USE_MOCK) {
    const { mockGetMatches } = await import('./mock-db')
    return mockGetMatches()
  }
  const { supabase } = await import('./client')
  const { data, error } = await supabase
    .from('matches')
    .select('*, team_home:teams!team_home_id(*), team_away:teams!team_away_id(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createMatch(match: { team_home_id: string; team_away_id: string }): Promise<Match> {
  if (USE_MOCK) {
    const { mockCreateMatch } = await import('./mock-db')
    return mockCreateMatch(match)
  }
  const { supabase } = await import('./client')
  const { data, error } = await supabase
    .from('matches')
    .insert({ ...match, status: 'en_curso' })
    .select('*, team_home:teams!team_home_id(*), team_away:teams!team_away_id(*)')
    .single()
  if (error) throw error
  return data
}

export async function finalizeMatch(id: string): Promise<void> {
  if (USE_MOCK) {
    const { mockFinalizeMatch } = await import('./mock-db')
    return mockFinalizeMatch(id)
  }
  const { supabase } = await import('./client')
  const { error } = await supabase.from('matches').update({ status: 'finalizado' }).eq('id', id)
  if (error) throw error
}

// ── Events ───────────────────────────────────────────────────────────────────

export async function getMatchEvents(matchId: string): Promise<MatchEvent[]> {
  if (USE_MOCK) {
    const { mockGetMatchEvents } = await import('./mock-db')
    return mockGetMatchEvents(matchId)
  }
  const { supabase } = await import('./client')
  const { data, error } = await supabase
    .from('match_events')
    .select('*')
    .eq('match_id', matchId)
    .order('timestamp')
  if (error) throw error
  return data
}

export async function saveEvent(event: Omit<MatchEvent, 'id'>): Promise<MatchEvent> {
  if (USE_MOCK) {
    const { mockSaveEvent } = await import('./mock-db')
    return mockSaveEvent(event)
  }
  const { supabase } = await import('./client')
  const { data, error } = await supabase.from('match_events').insert(event).select().single()
  if (error) throw error
  return data
}
