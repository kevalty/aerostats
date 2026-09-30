import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { OperatorSession, MatchConfig, TournamentTeam, MatchPlayer, TournamentEvent, TournamentEventType } from '@/types'
import { FIBA_RULES } from '@/types'

// ── Session store ─────────────────────────────────────────────────────────────

type SessionState = {
  session: OperatorSession | null
}

type SessionActions = {
  setSession: (session: OperatorSession) => void
  logout: () => void
}

export const useSessionStore = create<SessionState & SessionActions>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      logout: () => set({ session: null }),
    }),
    {
      name: 'arostats-session',
      storage: createJSONStorage(() => localStorage),
    }
  )
)

// ── Live Match Store ──────────────────────────────────────────────────────────

type LiveMatchState = {
  /** The tournament_match_id this live session belongs to */
  tournamentMatchId: string | null
  config: MatchConfig | null
  teamHome: TournamentTeam | null
  teamAway: TournamentTeam | null
  playersHome: MatchPlayer[]
  playersAway: MatchPlayer[]
  events: TournamentEvent[]

  // Clock / quarter
  cuarto: number
  clockSeconds: number
  isClockRunning: boolean

  // Possession (true = home has it)
  possessionHome: boolean

  // Team foul counters (reset each quarter)
  teamHomeFoulsThisQuarter: number
  teamAwayFoulsThisQuarter: number

  // Timeout counters (consumed across the half)
  timeoutsHomeUsed: number
  timeoutsAwayUsed: number
  colorHome: string
  colorAway: string
}

type LiveMatchActions = {
  initLiveMatch: (
    matchId: string,
    config: MatchConfig,
    teamHome: TournamentTeam,
    teamAway: TournamentTeam,
    playersHome: MatchPlayer[],
    playersAway: MatchPlayer[],
    events: TournamentEvent[],
    colorHome?: string,
    colorAway?: string
  ) => void
  resetLiveMatch: () => void

  // Clock
  toggleClock: () => void
  tickClock: () => void

  // Quarter
  nextQuarter: () => void

  // Possession
  togglePossession: () => void

  // Events
  addTournamentEvent: (
    event: Omit<TournamentEvent, 'id' | 'is_deleted'>
  ) => void
  softDeleteEvent: (id: string) => void

  // Derived / computed helpers (as functions so they always read fresh state)
  getHomeScore: () => number
  getAwayScore: () => number
  getPlayerFouls: (playerId: string) => number
  isPlayerDisqualified: (playerId: string) => boolean
  getTimeoutsLeft: (home: boolean) => number
  isInBonus: (home: boolean) => boolean

  // Timeout consumption
  useTimeout: (home: boolean) => void
}

const initialLiveMatchState: LiveMatchState = {
  tournamentMatchId: null,
  config: null,
  teamHome: null,
  teamAway: null,
  playersHome: [],
  playersAway: [],
  events: [],
  cuarto: 1,
  clockSeconds: FIBA_RULES.QUARTER_DURATION_SECONDS,
  isClockRunning: false,
  possessionHome: true,
  teamHomeFoulsThisQuarter: 0,
  teamAwayFoulsThisQuarter: 0,
  timeoutsHomeUsed: 0,
  timeoutsAwayUsed: 0,
  colorHome: '#3B82F6',
  colorAway: '#EF4444',
}

/** How many timeouts are allowed up to and including the given quarter (cumulative). */
function cumulativeTimeoutLimit(cuarto: number): number {
  if (cuarto <= 2) return FIBA_RULES.TIMEOUTS_FIRST_HALF         // 2
  if (cuarto <= 4) return FIBA_RULES.TIMEOUTS_FIRST_HALF + FIBA_RULES.TIMEOUTS_SECOND_HALF  // 5
  // Each OT adds 1
  return FIBA_RULES.TIMEOUTS_FIRST_HALF + FIBA_RULES.TIMEOUTS_SECOND_HALF + (cuarto - 4) * FIBA_RULES.TIMEOUTS_OVERTIME
}

export const useLiveMatchStore = create<LiveMatchState & LiveMatchActions>()(
  persist(
    (set, get) => ({
      ...initialLiveMatchState,

      // ── Init / reset ──────────────────────────────────────────────────────

      initLiveMatch: (matchId, config, teamHome, teamAway, playersHome, playersAway, events, colorHome, colorAway) =>
        set({
          ...initialLiveMatchState,
          tournamentMatchId: matchId,
          config,
          teamHome,
          teamAway,
          playersHome,
          playersAway,
          events,
          possessionHome: config.possession_home ?? true,
          colorHome: colorHome ?? '#3B82F6',
          colorAway: colorAway ?? '#EF4444',
        }),

      resetLiveMatch: () => set(initialLiveMatchState),

      // ── Clock ─────────────────────────────────────────────────────────────

      toggleClock: () => set((s) => ({ isClockRunning: !s.isClockRunning })),

      tickClock: () =>
        set((s) => {
          if (!s.isClockRunning) return {}
          const next = s.clockSeconds - 1
          if (next <= 0) return { clockSeconds: 0, isClockRunning: false }
          return { clockSeconds: next }
        }),

      // ── Quarter ───────────────────────────────────────────────────────────

      nextQuarter: () =>
        set((s) => {
          const nextQ = s.cuarto + 1
          const isOT = nextQ > 4
          return {
            cuarto: nextQ,
            clockSeconds: isOT
              ? FIBA_RULES.OVERTIME_DURATION_SECONDS
              : FIBA_RULES.QUARTER_DURATION_SECONDS,
            isClockRunning: false,
            teamHomeFoulsThisQuarter: 0,
            teamAwayFoulsThisQuarter: 0,
          }
        }),

      // ── Possession ────────────────────────────────────────────────────────

      togglePossession: () => set((s) => ({ possessionHome: !s.possessionHome })),

      // ── Events ───────────────────────────────────────────────────────────

      addTournamentEvent: (eventData) => {
        const id = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`
        const event: TournamentEvent = { ...eventData, id, is_deleted: false }

        set((s) => {
          const events = [...s.events, event]

          // Update team foul counters
          const isFoul =
            eventData.event_type === 'falta_personal' ||
            eventData.event_type === 'falta_tecnica'

          if (!isFoul) return { events }

          // Determine if the player belongs to home or away
          const isHomePlayer = s.playersHome.some((p) => p.id === eventData.player_id)
          if (isHomePlayer) {
            return { events, teamHomeFoulsThisQuarter: s.teamHomeFoulsThisQuarter + 1 }
          } else {
            return { events, teamAwayFoulsThisQuarter: s.teamAwayFoulsThisQuarter + 1 }
          }
        })
      },

      softDeleteEvent: (id) =>
        set((s) => {
          const target = s.events.find((e) => e.id === id)
          if (!target || target.is_deleted) return {}

          const events = s.events.map((e) => (e.id === id ? { ...e, is_deleted: true } : e))

          // Reverse team foul counter adjustment if needed
          const isFoul =
            target.event_type === 'falta_personal' ||
            target.event_type === 'falta_tecnica'

          if (!isFoul) return { events }

          const isHomePlayer = s.playersHome.some((p) => p.id === target.player_id)
          if (isHomePlayer) {
            return {
              events,
              teamHomeFoulsThisQuarter: Math.max(0, s.teamHomeFoulsThisQuarter - 1),
            }
          } else {
            return {
              events,
              teamAwayFoulsThisQuarter: Math.max(0, s.teamAwayFoulsThisQuarter - 1),
            }
          }
        }),

      // ── Computed helpers ──────────────────────────────────────────────────

      getHomeScore: () => {
        const s = get()
        const homeIds = new Set(s.playersHome.map((p) => p.id))
        return s.events
          .filter((e) => !e.is_deleted && homeIds.has(e.player_id))
          .reduce((sum, e) => sum + e.calculated_points, 0)
      },

      getAwayScore: () => {
        const s = get()
        const awayIds = new Set(s.playersAway.map((p) => p.id))
        return s.events
          .filter((e) => !e.is_deleted && awayIds.has(e.player_id))
          .reduce((sum, e) => sum + e.calculated_points, 0)
      },

      getPlayerFouls: (playerId) => {
        const s = get()
        return s.events.filter(
          (e) =>
            !e.is_deleted &&
            e.player_id === playerId &&
            (e.event_type === 'falta_personal' || e.event_type === 'falta_tecnica')
        ).length
      },

      isPlayerDisqualified: (playerId) => {
        const s = get()
        const fouls = s.events.filter(
          (e) =>
            !e.is_deleted &&
            e.player_id === playerId &&
            (e.event_type === 'falta_personal' || e.event_type === 'falta_tecnica')
        ).length
        return fouls >= FIBA_RULES.PERSONAL_FOULS_LIMIT
      },

      getTimeoutsLeft: (home) => {
        const s = get()
        const used = home ? s.timeoutsHomeUsed : s.timeoutsAwayUsed
        const limit = cumulativeTimeoutLimit(s.cuarto)
        return Math.max(0, limit - used)
      },

      isInBonus: (home) => {
        // home=true → check if HOME team's opponents (away) are in bonus
        // i.e., home team has accumulated enough fouls against the away team
        // Convention: isInBonus(true) = home team's opponents benefit from bonus
        //   meaning: away team shot free throws because HOME committed >= threshold fouls
        // We track teamHomeFoulsThisQuarter = fouls committed BY home players
        // So isInBonus(false) [away attackers benefit] when home commits >= threshold
        const s = get()
        if (home) {
          // Home team benefits from bonus = away committed >= threshold fouls
          return s.teamAwayFoulsThisQuarter >= FIBA_RULES.TEAM_FOULS_BONUS_THRESHOLD
        } else {
          // Away team benefits from bonus = home committed >= threshold fouls
          return s.teamHomeFoulsThisQuarter >= FIBA_RULES.TEAM_FOULS_BONUS_THRESHOLD
        }
      },

      useTimeout: (home) =>
        set((s) => {
          const used = home ? s.timeoutsHomeUsed : s.timeoutsAwayUsed
          const limit = cumulativeTimeoutLimit(s.cuarto)
          if (used >= limit) return {}
          return home
            ? { timeoutsHomeUsed: used + 1, isClockRunning: false }
            : { timeoutsAwayUsed: used + 1, isClockRunning: false }
        }),
    }),
    {
      name: 'arostats-live-match',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
