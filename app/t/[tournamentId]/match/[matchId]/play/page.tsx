'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLiveMatchStore, useSessionStore } from '@/store/tournamentStore'
import { FIBA_RULES } from '@/types'
import type { TournamentEventType, MatchPlayer, TournamentEvent } from '@/types'

// ── Court SVG ─────────────────────────────────────────────────────────────────

const CW = 320
const CH = 200

function CourtShotChart({ events, playersHome, colorHome, colorAway }: {
  events: TournamentEvent[]
  playersHome: MatchPlayer[]
  colorHome: string
  colorAway: string
}) {
  const homeIds = new Set(playersHome.map((p) => p.id))
  const shotEvents = events.filter(
    (e) => !e.is_deleted && e.coord_x != null &&
      (e.event_type === 'canasta_2' || e.event_type === 'canasta_3' || e.event_type === 'tiro_libre')
  )
  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full h-full" style={{ touchAction: 'none' }}>
      <rect width={CW} height={CH} fill="#7C4A1A" rx="6" />
      <rect x="3" y="3" width={CW - 6} height={CH - 6} fill="none" stroke="#C8A060" strokeWidth="1.5" rx="4" />
      <line x1={CW / 2} y1="3" x2={CW / 2} y2={CH - 3} stroke="#C8A060" strokeWidth="1" />
      <circle cx={CW / 2} cy={CH / 2} r="26" fill="none" stroke="#C8A060" strokeWidth="1" />
      {/* Left key */}
      <rect x="3" y={CH / 2 - 38} width="80" height="76" fill="rgba(200,160,96,0.1)" stroke="#C8A060" strokeWidth="1" />
      <circle cx="83" cy={CH / 2} r="24" fill="none" stroke="#C8A060" strokeWidth="1" />
      <circle cx="18" cy={CH / 2} r="5" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
      <path d={`M 3 ${CH / 2 - 62} L 60 ${CH / 2 - 62} A 88 88 0 0 1 60 ${CH / 2 + 62} L 3 ${CH / 2 + 62}`} fill="none" stroke="#C8A060" strokeWidth="1" />
      {/* Right key */}
      <rect x={CW - 83} y={CH / 2 - 38} width="80" height="76" fill="rgba(200,160,96,0.1)" stroke="#C8A060" strokeWidth="1" />
      <circle cx={CW - 83} cy={CH / 2} r="24" fill="none" stroke="#C8A060" strokeWidth="1" />
      <circle cx={CW - 18} cy={CH / 2} r="5" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
      <path d={`M ${CW - 3} ${CH / 2 - 62} L ${CW - 60} ${CH / 2 - 62} A 88 88 0 0 0 ${CW - 60} ${CH / 2 + 62} L ${CW - 3} ${CH / 2 + 62}`} fill="none" stroke="#C8A060" strokeWidth="1" />
      {/* Shot dots */}
      {shotEvents.map((e) => {
        const isHome = homeIds.has(e.player_id)
        const color = e.event_type === 'tiro_libre' ? '#F59E0B'
          : isHome ? colorHome : colorAway
        return (
          <circle key={e.id} cx={(e.coord_x! / 470) * CW} cy={(e.coord_y! / 280) * CH}
            r="4" fill={color} opacity="0.85" stroke="white" strokeWidth="0.8" />
        )
      })}
    </svg>
  )
}

// ── Player circle button ───────────────────────────────────────────────────────

function PlayerBtn({ player, fouls, isDisqualified, isSelected, color, onTap }: {
  player: MatchPlayer
  fouls: number
  isDisqualified: boolean
  isSelected: boolean
  color: string
  onTap: () => void
}) {
  return (
    <button
      onClick={onTap}
      disabled={isDisqualified}
      className="relative flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-full border-2 transition-all active:scale-95"
      style={{
        borderColor: isDisqualified ? 'rgba(239,68,68,0.4)' : isSelected ? color : 'rgba(255,255,255,0.15)',
        backgroundColor: isDisqualified ? 'rgba(239,68,68,0.08)' : isSelected ? color + '30' : 'rgba(255,255,255,0.05)',
        opacity: isDisqualified ? 0.45 : 1,
      }}
    >
      <span className="text-sm font-black tabular-nums leading-none" style={{ color: isSelected ? color : undefined }}>
        {player.numero}
      </span>
      {fouls > 0 && (
        <span className="text-[9px] font-bold leading-none mt-0.5" style={{ color: fouls >= 4 ? '#EF4444' : 'rgba(255,255,255,0.5)' }}>
          {fouls}F
        </span>
      )}
      {isDisqualified && (
        <span className="absolute inset-0 flex items-center justify-center text-red-500 text-lg pointer-events-none font-bold">✕</span>
      )}
      {player.is_captain && (
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black text-black"
          style={{ backgroundColor: color }}>C</span>
      )}
    </button>
  )
}

// ── Action panel ──────────────────────────────────────────────────────────────

type ActionOption = { label: string; short: string; type: TournamentEventType; pts: number }

const SCORE_ACTIONS: ActionOption[] = [
  { label: 'Canasta 2 pts', short: '+2', type: 'canasta_2', pts: 2 },
  { label: 'Canasta 3 pts', short: '+3', type: 'canasta_3', pts: 3 },
  { label: 'Tiro Libre',    short: '+1', type: 'tiro_libre',  pts: 1 },
]

const STAT_ACTIONS: ActionOption[] = [
  { label: 'Robo',        short: 'Rob', type: 'robo',       pts: 0 },
  { label: 'Reb. Ofens.', short: 'R.O', type: 'rebote_of',  pts: 0 },
  { label: 'Reb. Def.',   short: 'R.D', type: 'rebote_def', pts: 0 },
  { label: 'Pérdida',     short: 'Pérd', type: 'perdida',   pts: 0 },
]

const FOUL_ACTIONS: ActionOption[] = [
  { label: 'Falta Personal', short: 'Per.',  type: 'falta_personal', pts: 0 },
  { label: 'Falta Técnica',  short: 'Téc.',  type: 'falta_tecnica',  pts: 0 },
]

function ActionPanel({ player, fouls, color, onSelect, onClose }: {
  player: MatchPlayer | null
  fouls: number
  color: string
  onSelect: (action: ActionOption) => void
  onClose: () => void
}) {
  const [showFouls, setShowFouls] = useState(false)

  useEffect(() => { setShowFouls(false) }, [player])

  if (!player) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div className="bg-card rounded-t-3xl border-t border-border/60 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Color stripe */}
        <div className="h-1 rounded-t-3xl" style={{ backgroundColor: color }} />

        {/* Player header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 font-black text-base"
              style={{ borderColor: color, color, backgroundColor: color + '20' }}>
              {player.numero}
            </div>
            <div>
              <p className="font-bold text-sm uppercase tracking-wide">{player.nombre}</p>
              <p className="text-xs text-muted-foreground">
                {fouls} falta{fouls !== 1 ? 's' : ''}
                {player.is_starter ? ' · Titular' : ' · Suplente'}
                {player.is_captain ? ' · Cap.' : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground text-sm">✕</button>
        </div>

        <div className="px-4 pb-6 space-y-3">
          {!showFouls ? (
            <>
              {/* Scoring - big round buttons */}
              <div className="flex justify-center gap-4">
                {SCORE_ACTIONS.map((a) => (
                  <button key={a.type} onClick={() => onSelect(a)}
                    className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center font-black text-xl border-2 transition-colors"
                      style={{ borderColor: color, color, backgroundColor: color + '15' }}>
                      {a.short}
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{a.label}</span>
                  </button>
                ))}
              </div>

              {/* Stats + Foul row */}
              <div className="flex justify-center gap-3 flex-wrap">
                {/* Foul button */}
                <button onClick={() => setShowFouls(true)}
                  className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-base border-2 border-destructive/60 bg-destructive/10 text-destructive">
                    F
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Falta</span>
                </button>
                {STAT_ACTIONS.map((a) => (
                  <button key={a.type} onClick={() => onSelect(a)}
                    className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xs border-2 border-border bg-muted/30 text-foreground">
                      {a.short}
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{a.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Foul submenu */
            <div className="space-y-2">
              <p className="text-xs text-center text-muted-foreground uppercase tracking-widest font-semibold">Tipo de falta</p>
              <div className="flex justify-center gap-4">
                {FOUL_ACTIONS.map((a) => (
                  <button key={a.type} onClick={() => onSelect(a)}
                    className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center font-black text-sm border-2 border-destructive/70 bg-destructive/10 text-destructive">
                      {a.short}
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{a.label}</span>
                  </button>
                ))}
                <button onClick={() => setShowFouls(false)}
                  className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-sm border-2 border-border bg-muted/30 text-muted-foreground">
                    ←
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Atrás</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── FIBA notification ─────────────────────────────────────────────────────────

function Notification({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/70" onClick={onClose}>
      <div className="bg-card border border-destructive/60 rounded-2xl p-6 text-center max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-4xl mb-3">⚠️</p>
        <p className="font-bold text-base mb-4">{message}</p>
        <button className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-semibold uppercase tracking-wide text-sm" onClick={onClose}>
          Entendido
        </button>
      </div>
    </div>
  )
}

// ── Event labels ──────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  canasta_2: '+2 Canasta', canasta_3: '+3 Canasta', tiro_libre: '+1 TL',
  falta_personal: 'Falta Personal', falta_tecnica: 'Falta Técnica',
  tiempo_fuera: 'Tiempo Fuera', robo: 'Robo', bloqueo: 'Bloqueo',
  rebote_of: 'Reb. Ofensivo', rebote_def: 'Reb. Defensivo', perdida: 'Pérdida',
}

// ── Events tab ────────────────────────────────────────────────────────────────

function EventsTab({ events, playersHome, playersAway, onDelete }: {
  events: TournamentEvent[]
  playersHome: MatchPlayer[]
  playersAway: MatchPlayer[]
  onDelete: (id: string) => void
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const allPlayers = [...playersHome, ...playersAway]
  const visible = [...events].reverse().filter((e) => !e.is_deleted)

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
      {visible.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-12 uppercase tracking-widest">Sin eventos</p>
      ) : (
        visible.map((e) => {
          const player = allPlayers.find((p) => p.id === e.player_id)
          const isConfirming = confirmId === e.id
          return (
            <div key={e.id} className={`rounded-xl border px-3 py-2 transition-colors ${isConfirming ? 'border-destructive/60 bg-destructive/5' : 'border-border/50 bg-card/50'}`}>
              {!isConfirming ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {EVENT_LABELS[e.event_type] ?? e.event_type}
                      {e.calculated_points > 0 && <span className="text-primary"> +{e.calculated_points}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      #{player?.numero} {player?.nombre} · Q{e.cuarto}{e.clock_at_event ? ` · ${e.clock_at_event}` : ''}
                    </p>
                  </div>
                  <button onClick={() => setConfirmId(e.id)}
                    className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded flex-shrink-0">
                    ↩
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-sm text-destructive font-medium">¿Deshacer este evento?</p>
                  <button onClick={() => { onDelete(e.id); setConfirmId(null) }}
                    className="px-3 py-1 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold">
                    Sí
                  </button>
                  <button onClick={() => setConfirmId(null)}
                    className="px-3 py-1 rounded-lg bg-muted text-muted-foreground text-xs font-semibold">
                    No
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Planilla tab ──────────────────────────────────────────────────────────────

function PlanillaTab({ players, events, label, color }: {
  players: MatchPlayer[]
  events: TournamentEvent[]
  label: string
  color: string
}) {
  const active = events.filter((e) => !e.is_deleted)
  return (
    <div className="px-3 py-3">
      <p className="text-xs font-bold uppercase tracking-widest mb-2 px-1" style={{ color }}>{label}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border/50">
            <th className="text-left py-1.5 px-1 w-8">#</th>
            <th className="text-left py-1.5 px-1">Jugador</th>
            <th className="text-center py-1.5 px-1">Pts</th>
            <th className="text-center py-1.5 px-1">2P</th>
            <th className="text-center py-1.5 px-1">3P</th>
            <th className="text-center py-1.5 px-1">TL</th>
            <th className="text-center py-1.5 px-1">F</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const pe = active.filter((e) => e.player_id === p.id)
            const pts = pe.reduce((s, e) => s + e.calculated_points, 0)
            const c2 = pe.filter((e) => e.event_type === 'canasta_2').length
            const c3 = pe.filter((e) => e.event_type === 'canasta_3').length
            const tl = pe.filter((e) => e.event_type === 'tiro_libre').length
            const f = pe.filter((e) => e.event_type === 'falta_personal' || e.event_type === 'falta_tecnica').length
            return (
              <tr key={p.id} className="border-b border-border/20">
                <td className="py-1.5 px-1 font-mono font-bold">{p.numero}</td>
                <td className="py-1.5 px-1 truncate max-w-[80px]">
                  {p.nombre.split(' ')[0]}
                  {p.is_captain && <span className="ml-1 text-[9px] font-bold" style={{ color }}>C</span>}
                  {!p.is_starter && <span className="text-muted-foreground ml-1 text-[9px]">S</span>}
                </td>
                <td className="py-1.5 px-1 text-center font-bold" style={{ color: pts > 0 ? color : undefined }}>{pts || '-'}</td>
                <td className="py-1.5 px-1 text-center">{c2 || '-'}</td>
                <td className="py-1.5 px-1 text-center">{c3 || '-'}</td>
                <td className="py-1.5 px-1 text-center">{tl || '-'}</td>
                <td className="py-1.5 px-1 text-center" style={{ color: f >= 4 ? '#EF4444' : undefined, fontWeight: f >= 4 ? 700 : undefined }}>{f || '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Scoreboard ────────────────────────────────────────────────────────────────

function TimeoutDots({ used, total, color }: { used: number; total: number; color: string }) {
  const left = Math.max(0, total - used)
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className="text-[8px]" style={{ color: i < left ? color : 'rgba(255,255,255,0.2)' }}>●</span>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlayPage() {
  const { tournamentId, matchId } = useParams<{ tournamentId: string; matchId: string }>()
  const router = useRouter()
  const session = useSessionStore((s) => s.session)

  const store = useLiveMatchStore()
  const {
    tournamentMatchId, teamHome, teamAway, playersHome, playersAway, events,
    cuarto, clockSeconds, isClockRunning, possessionHome,
    teamHomeFoulsThisQuarter, teamAwayFoulsThisQuarter,
    colorHome, colorAway,
    toggleClock, tickClock, nextQuarter, softDeleteEvent, addTournamentEvent,
    getHomeScore, getAwayScore, getPlayerFouls, isPlayerDisqualified,
    getTimeoutsLeft, isInBonus, useTimeout, togglePossession,
  } = store

  const [activeTab, setActiveTab] = useState<'general' | 'eventos' | 'planilla'>('general')
  const [selectedPlayer, setSelectedPlayer] = useState<MatchPlayer | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const [bonusShownHome, setBonusShownHome] = useState(false)
  const [bonusShownAway, setBonusShownAway] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!session || session.tournament_id !== tournamentId) { router.push('/login'); return }
    if (tournamentMatchId && tournamentMatchId !== matchId) router.push(`/t/${tournamentId}`)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isClockRunning) {
      intervalRef.current = setInterval(tickClock, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isClockRunning, tickClock])

  useEffect(() => { setBonusShownHome(false); setBonusShownAway(false) }, [cuarto])

  useEffect(() => {
    if (teamAwayFoulsThisQuarter >= FIBA_RULES.TEAM_FOULS_BONUS_THRESHOLD && !bonusShownHome && teamHome) {
      setBonusShownHome(true)
      setNotification(`${teamHome.nombre} está en BONUS — próximas faltas generan tiros libres`)
    }
  }, [teamAwayFoulsThisQuarter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (teamHomeFoulsThisQuarter >= FIBA_RULES.TEAM_FOULS_BONUS_THRESHOLD && !bonusShownAway && teamAway) {
      setBonusShownAway(true)
      setNotification(`${teamAway.nombre} está en BONUS — próximas faltas generan tiros libres`)
    }
  }, [teamHomeFoulsThisQuarter]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (action.type === 'falta_personal' || action.type === 'falta_tecnica') {
      const newFouls = getPlayerFouls(selectedPlayer.id) + 1
      if (newFouls >= FIBA_RULES.PERSONAL_FOULS_LIMIT) {
        setNotification(`⛔ #${selectedPlayer.numero} ${selectedPlayer.nombre} llegó a ${FIBA_RULES.PERSONAL_FOULS_LIMIT} faltas — ELIMINADO`)
      }
    }
    setSelectedPlayer(null)
  }

  function handleNextQuarter() {
    if (cuarto >= 4) { router.push(`/t/${tournamentId}/match/${matchId}/summary`); return }
    nextQuarter()
  }

  const homeScore = getHomeScore()
  const awayScore = getAwayScore()
  const quarterLabel = cuarto <= 4 ? `Q${cuarto}` : `OT${cuarto - 4}`
  const timeoutsHomeLeft = getTimeoutsLeft(true)
  const timeoutsAwayLeft = getTimeoutsLeft(false)
  const homeBonus = isInBonus(true)
  const awayBonus = isInBonus(false)

  // FIBA: teams switch ends at halftime (after Q2)
  // Q1, Q2: home on left; Q3, Q4: home on right; OT: reset to Q1
  const homeOnLeft = cuarto <= 2 || cuarto > 4

  const leftPlayers = homeOnLeft ? playersHome : playersAway
  const rightPlayers = homeOnLeft ? playersAway : playersHome
  const leftColor = homeOnLeft ? colorHome : colorAway
  const rightColor = homeOnLeft ? colorAway : colorHome
  const leftTeam = homeOnLeft ? teamHome : teamAway
  const rightTeam = homeOnLeft ? teamAway : teamHome

  const timeoutsForCurrentHalf = cuarto <= 2
    ? FIBA_RULES.TIMEOUTS_FIRST_HALF
    : FIBA_RULES.TIMEOUTS_SECOND_HALF

  if (!teamHome || !teamAway) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Sin partido activo. <a href={`/t/${tournamentId}`} className="underline">Volver</a></p>
      </div>
    )
  }

  // Determine selected player's team color
  const selectedColor = selectedPlayer
    ? (playersHome.some((p) => p.id === selectedPlayer.id) ? colorHome : colorAway)
    : colorHome

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">

      {/* ── Scoreboard ── */}
      <div className="flex-shrink-0 bg-card border-b border-border/60 px-3 pt-2 pb-2">
        {/* Quarter bar */}
        <div className="flex justify-center gap-1 mb-1">
          {[1, 2, 3, 4].map((q) => (
            <span key={q} className={`text-[10px] px-2 py-0.5 rounded font-bold transition-colors ${
              cuarto === q ? 'bg-primary text-primary-foreground' : 'text-muted-foreground/60'
            }`}>Q{q}</span>
          ))}
          {cuarto > 4 && (
            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-primary text-primary-foreground">OT{cuarto - 4}</span>
          )}
        </div>

        {/* Main row: score | clock | score */}
        <div className="flex items-center">
          {/* Home */}
          <div className="flex-1 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wider truncate" style={{ color: colorHome }}>{teamHome.nombre}</p>
            <p className="text-4xl font-black tabular-nums leading-none" style={{ color: colorHome }}>{homeScore}</p>
          </div>

          {/* Clock */}
          <div className="flex flex-col items-center px-4">
            <button onClick={toggleClock} className={`text-2xl font-mono font-black tabular-nums transition-colors rounded-lg px-2 ${isClockRunning ? 'text-destructive' : 'text-foreground'}`}>
              {formatClock(clockSeconds)}
            </button>
            {/* Possession */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[10px] font-bold transition-all ${possessionHome ? 'opacity-100' : 'opacity-20'}`} style={{ color: colorHome }}>▶</span>
              <button onClick={togglePossession} className="text-[9px] text-muted-foreground uppercase tracking-widest">pos</button>
              <span className={`text-[10px] font-bold transition-all ${!possessionHome ? 'opacity-100' : 'opacity-20'}`} style={{ color: colorAway }}>◀</span>
            </div>
          </div>

          {/* Away */}
          <div className="flex-1 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider truncate" style={{ color: colorAway }}>{teamAway.nombre}</p>
            <p className="text-4xl font-black tabular-nums leading-none" style={{ color: colorAway }}>{awayScore}</p>
          </div>
        </div>

        {/* Info row: fouls + timeout dots */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-semibold ${awayBonus ? 'text-destructive' : 'text-muted-foreground'}`}>
              {teamHomeFoulsThisQuarter}F{awayBonus ? ' ●BONUS' : ''}
            </span>
            <TimeoutDots used={store.timeoutsHomeUsed} total={timeoutsForCurrentHalf} color={colorHome} />
          </div>
          <div className="flex items-center gap-2">
            <TimeoutDots used={store.timeoutsAwayUsed} total={timeoutsForCurrentHalf} color={colorAway} />
            <span className={`text-[9px] font-semibold ${homeBonus ? 'text-destructive' : 'text-muted-foreground'}`}>
              {teamAwayFoulsThisQuarter}F{homeBonus ? ' BONUS●' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex-shrink-0 flex border-b border-border/50 bg-card">
        {(['general', 'eventos', 'planilla'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${
              activeTab === tab ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
            }`}>
            {tab === 'general' ? 'General' : tab === 'eventos' ? 'Eventos' : 'Planilla'}
          </button>
        ))}
      </div>

      {/* ── General tab ── */}
      {activeTab === 'general' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* 3-column: players | court | players */}
          <div className="flex flex-1 overflow-hidden">

            {/* Left player column */}
            <div className="w-16 flex flex-col border-r border-border/30 bg-card/20">
              <div className="flex-shrink-0 py-1.5 px-1 text-center">
                <p className="text-[8px] font-black uppercase tracking-widest truncate" style={{ color: leftColor }}>
                  {leftTeam?.nombre.slice(0, 5)}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col items-center gap-2 py-1 px-1">
                {leftPlayers.map((p) => (
                  <PlayerBtn key={p.id} player={p}
                    fouls={getPlayerFouls(p.id)}
                    isDisqualified={isPlayerDisqualified(p.id)}
                    isSelected={selectedPlayer?.id === p.id}
                    color={leftColor}
                    onTap={() => setSelectedPlayer(p)}
                  />
                ))}
              </div>
            </div>

            {/* Court */}
            <div className="flex-1 p-2 flex items-center justify-center min-w-0">
              <div className="w-full h-full max-h-full">
                <CourtShotChart events={events} playersHome={playersHome} colorHome={colorHome} colorAway={colorAway} />
              </div>
            </div>

            {/* Right player column */}
            <div className="w-16 flex flex-col border-l border-border/30 bg-card/20">
              <div className="flex-shrink-0 py-1.5 px-1 text-center">
                <p className="text-[8px] font-black uppercase tracking-widest truncate" style={{ color: rightColor }}>
                  {rightTeam?.nombre.slice(0, 5)}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col items-center gap-2 py-1 px-1">
                {rightPlayers.map((p) => (
                  <PlayerBtn key={p.id} player={p}
                    fouls={getPlayerFouls(p.id)}
                    isDisqualified={isPlayerDisqualified(p.id)}
                    isSelected={selectedPlayer?.id === p.id}
                    color={rightColor}
                    onTap={() => setSelectedPlayer(p)}
                  />
                ))}
              </div>
            </div>

          </div>

          {/* Bottom controls */}
          <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5 border-t border-border/50 bg-card">
            <button
              onClick={() => useTimeout(true)}
              disabled={timeoutsHomeLeft <= 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold uppercase tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              style={{ borderColor: colorHome + '60', color: colorHome, backgroundColor: colorHome + '10' }}
            >
              T/O <span className="font-black">{timeoutsHomeLeft}</span>
            </button>

            <button
              onClick={handleNextQuarter}
              className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95 ${
                cuarto >= 4
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-primary text-primary-foreground'
              }`}
            >
              {cuarto >= 4 ? 'Fin Partido →' : `Fin ${quarterLabel} →`}
            </button>

            <button
              onClick={() => useTimeout(false)}
              disabled={timeoutsAwayLeft <= 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold uppercase tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              style={{ borderColor: colorAway + '60', color: colorAway, backgroundColor: colorAway + '10' }}
            >
              <span className="font-black">{timeoutsAwayLeft}</span> T/O
            </button>
          </div>
        </div>
      )}

      {/* ── Events tab ── */}
      {activeTab === 'eventos' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <EventsTab events={events} playersHome={playersHome} playersAway={playersAway} onDelete={softDeleteEvent} />
        </div>
      )}

      {/* ── Planilla tab ── */}
      {activeTab === 'planilla' && (
        <div className="flex-1 overflow-y-auto">
          <PlanillaTab players={playersHome} events={events} label={teamHome.nombre} color={colorHome} />
          <div className="border-t border-border/40 mt-1" />
          <PlanillaTab players={playersAway} events={events} label={teamAway.nombre} color={colorAway} />
        </div>
      )}

      {/* Action panel */}
      {selectedPlayer && (
        <ActionPanel
          player={selectedPlayer}
          fouls={getPlayerFouls(selectedPlayer.id)}
          color={selectedColor}
          onSelect={handleAction}
          onClose={() => setSelectedPlayer(null)}
        />
      )}

      {/* FIBA notification */}
      {notification && <Notification message={notification} onClose={() => setNotification(null)} />}

    </div>
  )
}
