'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLiveMatchStore, useSessionStore } from '@/store/tournamentStore'
import { FIBA_RULES } from '@/types'
import type { TournamentEventType, MatchPlayer, TournamentEvent } from '@/types'
import { Button } from '@/components/ui/button'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

// ── Court SVG (shot-chart only, no tap-to-register) ───────────────────────────

const CW = 300
const CH = 200

function CourtShotChart({
  events,
  playersHome,
  playersAway,
}: {
  events: TournamentEvent[]
  playersHome: MatchPlayer[]
  playersAway: MatchPlayer[]
}) {
  const homeIds = new Set(playersHome.map((p) => p.id))
  const shotEvents = events.filter(
    (e) =>
      !e.is_deleted &&
      e.coord_x != null &&
      (e.event_type === 'canasta_2' ||
        e.event_type === 'canasta_3' ||
        e.event_type === 'tiro_libre')
  )

  return (
    <svg
      viewBox={`0 0 ${CW} ${CH}`}
      className="w-full h-full"
      style={{ touchAction: 'none' }}
    >
      {/* Court background */}
      <rect width={CW} height={CH} fill="#7C4A1A" rx="4" />
      <rect
        x="3" y="3"
        width={CW - 6} height={CH - 6}
        fill="none" stroke="#C8A060" strokeWidth="1.5" rx="2"
      />
      {/* Center line + circle */}
      <line x1={CW / 2} y1="3" x2={CW / 2} y2={CH - 3} stroke="#C8A060" strokeWidth="1" />
      <circle cx={CW / 2} cy={CH / 2} r="24" fill="none" stroke="#C8A060" strokeWidth="1" />
      {/* Left key */}
      <rect
        x="3" y={CH / 2 - 38} width="78" height="76"
        fill="rgba(200,160,96,0.12)" stroke="#C8A060" strokeWidth="1"
      />
      <circle cx="81" cy={CH / 2} r="24" fill="none" stroke="#C8A060" strokeWidth="1" />
      <circle cx="20" cy={CH / 2} r="5" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
      <path
        d={`M 3 ${CH / 2 - 60} L 60 ${CH / 2 - 60} A 85 85 0 0 1 60 ${CH / 2 + 60} L 3 ${CH / 2 + 60}`}
        fill="none" stroke="#C8A060" strokeWidth="1"
      />
      {/* Right key */}
      <rect
        x={CW - 81} y={CH / 2 - 38} width="78" height="76"
        fill="rgba(200,160,96,0.12)" stroke="#C8A060" strokeWidth="1"
      />
      <circle cx={CW - 81} cy={CH / 2} r="24" fill="none" stroke="#C8A060" strokeWidth="1" />
      <circle cx={CW - 20} cy={CH / 2} r="5" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
      <path
        d={`M ${CW - 3} ${CH / 2 - 60} L ${CW - 60} ${CH / 2 - 60} A 85 85 0 0 0 ${CW - 60} ${CH / 2 + 60} L ${CW - 3} ${CH / 2 + 60}`}
        fill="none" stroke="#C8A060" strokeWidth="1"
      />
      {/* Shot dots */}
      {shotEvents.map((e) => {
        const color =
          e.event_type === 'tiro_libre'
            ? '#F59E0B'
            : e.event_type === 'canasta_3'
            ? '#3B82F6'
            : '#22C55E'
        return (
          <circle
            key={e.id}
            cx={(e.coord_x! / 470) * CW}
            cy={(e.coord_y! / 280) * CH}
            r="4"
            fill={color}
            opacity="0.85"
            stroke="white"
            strokeWidth="0.8"
          />
        )
      })}
    </svg>
  )
}

// ── Player button ─────────────────────────────────────────────────────────────

function PlayerBtn({
  player,
  fouls,
  isDisqualified,
  isSelected,
  onTap,
}: {
  player: MatchPlayer
  fouls: number
  isDisqualified: boolean
  isSelected: boolean
  onTap: () => void
}) {
  return (
    <button
      onClick={onTap}
      disabled={isDisqualified}
      className={[
        'flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 transition-colors relative',
        isDisqualified
          ? 'border-destructive/50 bg-destructive/10 opacity-50 cursor-not-allowed'
          : isSelected
          ? 'border-primary bg-primary/20 text-primary'
          : 'border-border bg-card hover:border-primary/50',
      ].join(' ')}
    >
      <span className="text-lg font-black leading-none tabular-nums">
        {player.numero}
      </span>
      {fouls > 0 && (
        <span
          className={`text-[10px] font-bold ${
            fouls >= 4 ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          {fouls}F
        </span>
      )}
      {isDisqualified && (
        <span className="absolute inset-0 flex items-center justify-center text-destructive text-xl pointer-events-none">
          ✕
        </span>
      )}
      {player.is_captain && (
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full text-[8px] flex items-center justify-center text-black font-bold">
          C
        </span>
      )}
    </button>
  )
}

// ── Action sheet ──────────────────────────────────────────────────────────────

type ActionOption = {
  label: string
  type: TournamentEventType
  pts: number
  color: string
}

const ACTIONS: ActionOption[] = [
  { label: 'Aro 2 pts',       type: 'canasta_2',     pts: 2, color: 'text-green-400' },
  { label: 'Aro 3 pts',       type: 'canasta_3',     pts: 3, color: 'text-blue-400' },
  { label: 'Tiro Libre +1',   type: 'tiro_libre',    pts: 1, color: 'text-yellow-400' },
  { label: 'Falta Personal',  type: 'falta_personal', pts: 0, color: 'text-destructive' },
  { label: 'Falta Técnica',   type: 'falta_tecnica', pts: 0, color: 'text-destructive' },
  { label: 'Robo',            type: 'robo',          pts: 0, color: 'text-muted-foreground' },
  { label: 'Rebote Of.',      type: 'rebote_of',     pts: 0, color: 'text-muted-foreground' },
  { label: 'Rebote Def.',     type: 'rebote_def',    pts: 0, color: 'text-muted-foreground' },
  { label: 'Pérdida',         type: 'perdida',       pts: 0, color: 'text-muted-foreground' },
]

function ActionSheet({
  player,
  fouls,
  onSelect,
  onClose,
}: {
  player: MatchPlayer | null
  fouls: number
  onSelect: (action: ActionOption) => void
  onClose: () => void
}) {
  if (!player) return null
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-t-2xl border-t border-border p-4 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-bold">
              #{player.numero} {player.nombre}
            </p>
            <p className="text-xs text-muted-foreground">
              {fouls} falta{fouls !== 1 ? 's' : ''}
              {' · '}
              {player.is_starter ? 'Titular' : 'Suplente'}
              {player.is_captain ? ' · Capitán' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl px-2"
          >
            ✕
          </button>
        </div>
        {/* Action grid */}
        <div className="grid grid-cols-3 gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a.type}
              onClick={() => onSelect(a)}
              className={`py-3 px-2 rounded-xl border border-border bg-muted/30 text-sm font-medium hover:bg-muted/60 active:scale-95 transition-all ${a.color}`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" className="w-full mt-1" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

// ── FIBA notification popup ───────────────────────────────────────────────────

function Notification({
  message,
  onClose,
}: {
  message: string
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-card border border-destructive rounded-2xl p-6 text-center max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-4xl mb-3">⚠️</p>
        <p className="font-bold text-lg mb-4">{message}</p>
        <Button className="w-full" onClick={onClose}>
          Entendido
        </Button>
      </div>
    </div>
  )
}

// ── Event labels ──────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  canasta_2:     '+2 Canasta',
  canasta_3:     '+3 Canasta',
  tiro_libre:    '+1 TL',
  falta_personal: 'Falta Personal',
  falta_tecnica:  'Falta Técnica',
  tiempo_fuera:  'Tiempo Fuera',
  robo:          'Robo',
  bloqueo:       'Bloqueo',
  rebote_of:     'Rebote Of.',
  rebote_def:    'Rebote Def.',
  perdida:       'Pérdida',
}

// ── Eventos tab ───────────────────────────────────────────────────────────────

function EventsTab({
  events,
  playersHome,
  playersAway,
  onDelete,
}: {
  events: TournamentEvent[]
  playersHome: MatchPlayer[]
  playersAway: MatchPlayer[]
  onDelete: (id: string) => void
}) {
  const allPlayers = [...playersHome, ...playersAway]
  const visible = [...events].reverse().filter((e) => !e.is_deleted)

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
      {visible.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">
          Sin eventos registrados
        </p>
      ) : (
        visible.map((e) => {
          const player = allPlayers.find((p) => p.id === e.player_id)
          return (
            <div
              key={e.id}
              className="flex items-center gap-2 py-2 border-b border-border/50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {EVENT_LABELS[e.event_type] ?? e.event_type}
                  {e.calculated_points > 0 && (
                    <span className="text-primary"> +{e.calculated_points}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  #{player?.numero} {player?.nombre} · Q{e.cuarto}
                  {e.clock_at_event ? ` · ${e.clock_at_event}` : ''}
                </p>
              </div>
              <button
                onClick={() => onDelete(e.id)}
                className="text-xs text-destructive hover:bg-destructive/10 px-2 py-1 rounded flex-shrink-0"
                title="Deshacer"
              >
                ↩
              </button>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Planilla tab ──────────────────────────────────────────────────────────────

function PlanillaTab({
  players,
  events,
  label,
}: {
  players: MatchPlayer[]
  events: TournamentEvent[]
  label: string
}) {
  const activeEvents = events.filter((e) => !e.is_deleted)
  return (
    <div className="px-2 py-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
        {label}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className="text-left py-1 px-1 w-8">#</th>
            <th className="text-left py-1 px-1">Jugador</th>
            <th className="text-center py-1 px-1">Pts</th>
            <th className="text-center py-1 px-1">2P</th>
            <th className="text-center py-1 px-1">3P</th>
            <th className="text-center py-1 px-1">TL</th>
            <th className="text-center py-1 px-1">F</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const pe = activeEvents.filter((e) => e.player_id === p.id)
            const pts = pe.reduce((s, e) => s + e.calculated_points, 0)
            const c2 = pe.filter((e) => e.event_type === 'canasta_2').length
            const c3 = pe.filter((e) => e.event_type === 'canasta_3').length
            const tl = pe.filter((e) => e.event_type === 'tiro_libre').length
            const f = pe.filter(
              (e) =>
                e.event_type === 'falta_personal' ||
                e.event_type === 'falta_tecnica'
            ).length
            return (
              <tr key={p.id} className="border-b border-border/30">
                <td className="py-1.5 px-1 font-mono font-bold">{p.numero}</td>
                <td className="py-1.5 px-1 truncate max-w-[80px]">
                  {p.nombre.split(' ')[0]}
                  {p.is_captain && (
                    <span className="text-amber-500 ml-1 text-[10px]">C</span>
                  )}
                  {!p.is_starter && (
                    <span className="text-muted-foreground ml-1 text-[10px]">S</span>
                  )}
                </td>
                <td
                  className={`py-1.5 px-1 text-center font-bold ${
                    pts > 0 ? 'text-primary' : ''
                  }`}
                >
                  {pts}
                </td>
                <td className="py-1.5 px-1 text-center">{c2 || '-'}</td>
                <td className="py-1.5 px-1 text-center">{c3 || '-'}</td>
                <td className="py-1.5 px-1 text-center">{tl || '-'}</td>
                <td
                  className={`py-1.5 px-1 text-center ${
                    f >= 4 ? 'text-destructive font-bold' : ''
                  }`}
                >
                  {f || '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page component ───────────────────────────────────────────────────────

export default function PlayPage() {
  const { tournamentId, matchId } = useParams<{
    tournamentId: string
    matchId: string
  }>()
  const router = useRouter()
  const session = useSessionStore((s) => s.session)

  // Subscribe to the whole live match store
  const store = useLiveMatchStore()
  const {
    tournamentMatchId,
    teamHome,
    teamAway,
    playersHome,
    playersAway,
    events,
    cuarto,
    clockSeconds,
    isClockRunning,
    possessionHome,
    teamHomeFoulsThisQuarter,
    teamAwayFoulsThisQuarter,
    toggleClock,
    tickClock,
    nextQuarter,
    softDeleteEvent,
    addTournamentEvent,
    getHomeScore,
    getAwayScore,
    getPlayerFouls,
    isPlayerDisqualified,
    getTimeoutsLeft,
    isInBonus,
    useTimeout,
  } = store

  const [activeTab, setActiveTab] = useState<'general' | 'eventos' | 'planilla'>('general')
  const [selectedPlayer, setSelectedPlayer] = useState<MatchPlayer | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  // Track bonus notifications so they only fire once per quarter
  const [bonusShownHome, setBonusShownHome] = useState(false)
  const [bonusShownAway, setBonusShownAway] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auth guard — redirect if no session or wrong tournament
  useEffect(() => {
    if (!session || session.tournament_id !== tournamentId) {
      router.push('/login')
      return
    }
    if (tournamentMatchId && tournamentMatchId !== matchId) {
      router.push(`/t/${tournamentId}`)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Clock ticker
  useEffect(() => {
    if (isClockRunning) {
      intervalRef.current = setInterval(() => {
        tickClock()
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isClockRunning, tickClock])

  // Reset bonus shown flags when quarter changes
  useEffect(() => {
    setBonusShownHome(false)
    setBonusShownAway(false)
  }, [cuarto])

  // Bonus notifications — only show once per quarter per team
  useEffect(() => {
    if (
      teamHomeFoulsThisQuarter >= FIBA_RULES.TEAM_FOULS_BONUS_THRESHOLD &&
      !bonusShownHome &&
      teamAway
    ) {
      setBonusShownHome(true)
      setNotification(
        `${teamAway.nombre} está en BONUS — próximas faltas van a tiros libres`
      )
    }
  }, [teamHomeFoulsThisQuarter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (
      teamAwayFoulsThisQuarter >= FIBA_RULES.TEAM_FOULS_BONUS_THRESHOLD &&
      !bonusShownAway &&
      teamHome
    ) {
      setBonusShownAway(true)
      setNotification(
        `${teamHome.nombre} está en BONUS — próximas faltas van a tiros libres`
      )
    }
  }, [teamAwayFoulsThisQuarter]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ──────────────────────────────────────────────────────────────

  function formatClock(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  function handleAction(action: ActionOption) {
    if (!selectedPlayer) return

    addTournamentEvent({
      tournament_match_id: matchId,
      player_id: selectedPlayer.id,
      event_type: action.type,
      cuarto,
      clock_at_event: formatClock(clockSeconds),
      calculated_points: action.pts,
      timestamp: new Date().toISOString(),
    })

    // Check player disqualification after foul events
    if (
      action.type === 'falta_personal' ||
      action.type === 'falta_tecnica'
    ) {
      // getPlayerFouls reads from committed state; the new event was just
      // added so we add 1 manually for the check
      const newFouls = getPlayerFouls(selectedPlayer.id) + 1
      if (newFouls >= FIBA_RULES.PERSONAL_FOULS_LIMIT) {
        setNotification(
          `⛔ #${selectedPlayer.numero} ${selectedPlayer.nombre} llegó a ${FIBA_RULES.PERSONAL_FOULS_LIMIT} faltas — ELIMINADO del partido`
        )
      }
    }

    setSelectedPlayer(null)
  }

  function handleNextQuarter() {
    if (cuarto >= 4) {
      router.push(`/t/${tournamentId}/match/${matchId}/summary`)
      return
    }
    nextQuarter()
  }

  // ── Derived values (called per render) ───────────────────────────────────

  const homeScore = getHomeScore()
  const awayScore = getAwayScore()
  const quarterLabel = cuarto <= 4 ? `Q${cuarto}` : `OT${cuarto - 4}`
  const timeoutsHomeLeft = getTimeoutsLeft(true)
  const timeoutsAwayLeft = getTimeoutsLeft(false)
  // isInBonus(true) = home team benefits (away committed enough fouls)
  const homeBonus = isInBonus(true)
  const awayBonus = isInBonus(false)

  // ── No match guard ────────────────────────────────────────────────────────

  if (!teamHome || !teamAway) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">
          Sin partido activo.{' '}
          <a href={`/t/${tournamentId}`} className="underline">
            Volver
          </a>
        </p>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">

      {/* ── Scoreboard bar ── */}
      <div className="flex-shrink-0 bg-card border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">

          {/* Home team */}
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground truncate leading-none mb-0.5">
              {teamHome.nombre}
            </p>
            <p className="text-3xl font-black text-primary tabular-nums leading-none">
              {homeScore}
            </p>
            <div className="flex justify-center gap-1 mt-0.5 flex-wrap">
              <span
                className={`text-[9px] ${
                  awayBonus ? 'text-destructive font-bold' : 'text-muted-foreground'
                }`}
              >
                {teamHomeFoulsThisQuarter}F{awayBonus ? ' ●BONUS' : ''}
              </span>
              <span className="text-[9px] text-muted-foreground">
                T:{timeoutsHomeLeft}
              </span>
            </div>
          </div>

          {/* Center clock */}
          <div className="flex flex-col items-center gap-0.5 min-w-0">
            {/* Quarter tabs */}
            <div className="flex gap-0.5">
              {[1, 2, 3, 4].map((q) => (
                <span
                  key={q}
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    cuarto === q
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  Q{q}
                </span>
              ))}
              {cuarto > 4 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-primary text-primary-foreground">
                  OT{cuarto - 4}
                </span>
              )}
            </div>
            {/* Tap-to-toggle clock */}
            <button
              onClick={toggleClock}
              className={`text-2xl font-mono font-black tabular-nums px-2 rounded transition-colors ${
                isClockRunning ? 'text-destructive' : 'text-foreground'
              }`}
            >
              {formatClock(clockSeconds)}
            </button>
            {/* Possession indicator */}
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={possessionHome ? 'text-primary font-bold' : ''}>▶</span>
              <span>pos</span>
              <span className={!possessionHome ? 'text-blue-400 font-bold' : ''}>◀</span>
            </div>
          </div>

          {/* Away team */}
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground truncate leading-none mb-0.5">
              {teamAway.nombre}
            </p>
            <p className="text-3xl font-black text-blue-400 tabular-nums leading-none">
              {awayScore}
            </p>
            <div className="flex justify-center gap-1 mt-0.5 flex-wrap">
              <span
                className={`text-[9px] ${
                  homeBonus ? 'text-destructive font-bold' : 'text-muted-foreground'
                }`}
              >
                {teamAwayFoulsThisQuarter}F{homeBonus ? ' ●BONUS' : ''}
              </span>
              <span className="text-[9px] text-muted-foreground">
                T:{timeoutsAwayLeft}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex-shrink-0 flex border-b border-border bg-card">
        {(['general', 'eventos', 'planilla'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
              activeTab === tab
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'general'
              ? 'General'
              : tab === 'eventos'
              ? 'Eventos'
              : 'Planilla'}
          </button>
        ))}
      </div>

      {/* ── Content ── */}

      {activeTab === 'general' && (
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Home player strip */}
          <div className="flex-shrink-0 bg-card/50 border-b border-border px-2 py-2">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
              {teamHome.nombre}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {playersHome.map((p) => (
                <PlayerBtn
                  key={p.id}
                  player={p}
                  fouls={getPlayerFouls(p.id)}
                  isDisqualified={isPlayerDisqualified(p.id)}
                  isSelected={selectedPlayer?.id === p.id}
                  onTap={() => setSelectedPlayer(p)}
                />
              ))}
              {playersHome.length === 0 && (
                <p className="text-xs text-muted-foreground py-2 px-1">
                  Sin jugadores
                </p>
              )}
            </div>
          </div>

          {/* Shot-chart court */}
          <div className="flex-1 p-2 min-h-0">
            <CourtShotChart
              events={events}
              playersHome={playersHome}
              playersAway={playersAway}
            />
          </div>

          {/* Away player strip */}
          <div className="flex-shrink-0 bg-card/50 border-t border-border px-2 py-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {playersAway.map((p) => (
                <PlayerBtn
                  key={p.id}
                  player={p}
                  fouls={getPlayerFouls(p.id)}
                  isDisqualified={isPlayerDisqualified(p.id)}
                  isSelected={selectedPlayer?.id === p.id}
                  onTap={() => setSelectedPlayer(p)}
                />
              ))}
              {playersAway.length === 0 && (
                <p className="text-xs text-muted-foreground py-2 px-1">
                  Sin jugadores
                </p>
              )}
            </div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1.5 px-1">
              {teamAway.nombre}
            </p>
          </div>

          {/* Controls bar */}
          <div className="flex-shrink-0 flex gap-2 px-3 py-2 border-t border-border bg-card">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => useTimeout(true)}
              disabled={timeoutsHomeLeft <= 0}
            >
              T/O Local ({timeoutsHomeLeft})
            </Button>
            <Button
              size="sm"
              variant={cuarto >= 4 ? 'destructive' : 'outline'}
              className="text-xs flex-1"
              onClick={handleNextQuarter}
            >
              {cuarto >= 4 ? 'Fin Partido →' : `Fin ${quarterLabel} →`}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => useTimeout(false)}
              disabled={timeoutsAwayLeft <= 0}
            >
              T/O Visita ({timeoutsAwayLeft})
            </Button>
          </div>

        </div>
      )}

      {activeTab === 'eventos' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <EventsTab
            events={events}
            playersHome={playersHome}
            playersAway={playersAway}
            onDelete={softDeleteEvent}
          />
        </div>
      )}

      {activeTab === 'planilla' && (
        <div className="flex-1 overflow-y-auto">
          <PlanillaTab
            players={playersHome}
            events={events}
            label={teamHome.nombre}
          />
          <div className="border-t border-border mt-2" />
          <PlanillaTab
            players={playersAway}
            events={events}
            label={teamAway.nombre}
          />
        </div>
      )}

      {/* Action sheet */}
      {selectedPlayer && (
        <ActionSheet
          player={selectedPlayer}
          fouls={getPlayerFouls(selectedPlayer.id)}
          onSelect={handleAction}
          onClose={() => setSelectedPlayer(null)}
        />
      )}

      {/* FIBA notification */}
      {notification && (
        <Notification
          message={notification}
          onClose={() => setNotification(null)}
        />
      )}

    </div>
  )
}
