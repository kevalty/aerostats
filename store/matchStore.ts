import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { get, set, del } from 'idb-keyval'
import type { MatchEvent, Player, Team, InteractionMode, Quarter } from '@/types'
import { saveEvent } from '@/lib/supabase/queries'

// Custom IndexedDB storage for Zustand
const idbStorage = {
  getItem: async (name: string) => {
    const val = await get(name)
    return val ?? null
  },
  setItem: async (name: string, value: string) => {
    await set(name, value)
  },
  removeItem: async (name: string) => {
    await del(name)
  },
}

type MatchState = {
  matchId: string | null
  teamHome: Team | null
  teamAway: Team | null
  players: Player[]
  events: MatchEvent[]
  interactionMode: InteractionMode
  selectedPlayerId: string | null
  quarter: Quarter
  clockSeconds: number
  isClockRunning: boolean
  teamHomeFouls: number
  teamAwayFouls: number
  teamHomeTimeouts: number
  teamAwayTimeouts: number
}

type MatchActions = {
  initMatch: (matchId: string, teamHome: Team, teamAway: Team, players: Player[]) => void
  addEvent: (event: Omit<MatchEvent, 'id'>) => Promise<void>
  undoLastEvent: () => void
  setInteractionMode: (mode: InteractionMode) => void
  selectPlayer: (playerId: string | null) => void
  setQuarter: (quarter: Quarter) => void
  setClockSeconds: (seconds: number) => void
  toggleClock: () => void
  stopClock: () => void
  resetMatch: () => void
  getHomeScore: () => number
  getAwayScore: () => number
}

const initialState: MatchState = {
  matchId: null,
  teamHome: null,
  teamAway: null,
  players: [],
  events: [],
  interactionMode: 'taptap',
  selectedPlayerId: null,
  quarter: 1,
  clockSeconds: 600,
  isClockRunning: false,
  teamHomeFouls: 0,
  teamAwayFouls: 0,
  teamHomeTimeouts: 3,
  teamAwayTimeouts: 3,
}

export const useMatchStore = create<MatchState & MatchActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      initMatch: (matchId, teamHome, teamAway, players) =>
        set({ ...initialState, matchId, teamHome, teamAway, players }),

      addEvent: async (eventData) => {
        const tempId = crypto.randomUUID()
        const event: MatchEvent = { ...eventData, id: tempId }
        set((s) => ({ events: [...s.events, event] }))

        // Pause clock on faults and timeouts
        if (event.event_type === 'falta' || event.event_type === 'tiempo_fuera') {
          set({ isClockRunning: false })
          if (event.event_type === 'falta') {
            const state = get()
            const player = state.players.find((p) => p.id === event.player_id)
            if (player) {
              if (state.teamHome?.id && state.teamHome.id === player.team_id) {
                set((s) => ({ teamHomeFouls: s.teamHomeFouls + 1 }))
              } else {
                set((s) => ({ teamAwayFouls: s.teamAwayFouls + 1 }))
              }
            }
          }
          if (event.event_type === 'tiempo_fuera') {
            const state = get()
            const player = state.players.find((p) => p.id === event.player_id)
            if (player) {
              if (state.teamHome?.id && state.teamHome.id === player.team_id) {
                set((s) => ({ teamHomeTimeouts: Math.max(0, s.teamHomeTimeouts - 1) }))
              } else {
                set((s) => ({ teamAwayTimeouts: Math.max(0, s.teamAwayTimeouts - 1) }))
              }
            }
          }
        }

        // Sync with Supabase in background
        try {
          const saved = await saveEvent(eventData)
          set((s) => ({
            events: s.events.map((e) => (e.id === tempId ? saved : e)),
          }))
        } catch {
          // Keep local event even if sync fails
        }
      },

      undoLastEvent: () =>
        set((s) => ({ events: s.events.slice(0, -1) })),

      setInteractionMode: (mode) => set({ interactionMode: mode }),

      selectPlayer: (playerId) => set({ selectedPlayerId: playerId }),

      setQuarter: (quarter) => set({ quarter }),

      setClockSeconds: (seconds) => set({ clockSeconds: seconds }),

      toggleClock: () => set((s) => ({ isClockRunning: !s.isClockRunning })),

      stopClock: () => set({ isClockRunning: false }),

      resetMatch: () => set(initialState),

      getHomeScore: () => {
        const state = get()
        return state.events
          .filter((e) => {
            const player = state.players.find((p) => p.id === e.player_id)
            return player?.team_id === state.teamHome?.id
          })
          .reduce((sum, e) => sum + e.calculated_points, 0)
      },

      getAwayScore: () => {
        const state = get()
        return state.events
          .filter((e) => {
            const player = state.players.find((p) => p.id === e.player_id)
            return player?.team_id === state.teamAway?.id
          })
          .reduce((sum, e) => sum + e.calculated_points, 0)
      },
    }),
    {
      name: 'arostats-match',
      storage: createJSONStorage(() => idbStorage as any),
      partialize: (state) => ({
        matchId: state.matchId,
        teamHome: state.teamHome,
        teamAway: state.teamAway,
        players: state.players,
        events: state.events,
        interactionMode: state.interactionMode,
        quarter: state.quarter,
        clockSeconds: state.clockSeconds,
        teamHomeFouls: state.teamHomeFouls,
        teamAwayFouls: state.teamAwayFouls,
        teamHomeTimeouts: state.teamHomeTimeouts,
        teamAwayTimeouts: state.teamAwayTimeouts,
      }),
    }
  )
)
