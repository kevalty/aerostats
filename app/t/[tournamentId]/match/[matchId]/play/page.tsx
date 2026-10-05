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
      <rect x="3" y={CH / 2 - 38} width="80" height="76" fill="rgba(200,160,96,0.1)" stroke="#C8A060" strokeWidth="1" />
      <circle cx="83" cy={CH / 2} r="24" fill="none" stroke="#C8A060" strokeWidth="1" />
      <circle cx="18" cy={CH / 2} r="5" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
      <path d={`M 3 ${CH / 2 - 62} L 60 ${CH / 2 - 62} A 88 88 0 0 1 60 ${CH / 2 + 62} L 3 ${CH / 2 + 62}`} fill="none" stroke="#C8A060" strokeWidth="1" />
      <rect x={CW - 83} y={CH / 2 - 38} width="80" height="76" fill="rgba(200,160,96,0.1)" stroke="#C8A060" strokeWidth="1" />
      <circle cx={CW - 83} cy={CH / 2} r="24" fill="none" stroke="#C8A060" strokeWidth="1" />
      <circle cx={CW - 18} cy={CH / 2} r="5" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
      <path d={`M ${CW - 3} ${CH / 2 - 62} L ${CW - 60} ${CH / 2 - 62} A 88 88 0 0 0 ${CW - 60} ${CH / 2 + 62} L ${CW - 3} ${CH / 2 + 62}`} fill="none" stroke="#C8A060" strokeWidth="1" />
      {shotEvents.map((e) => {
        const isHome = homeIds.has(e.player_id)
        const color = e.event_type === 'tiro_libre' ? '#F59E0B' : isHome ? colorHome : colorAway
        return (
          <circle key={e.id} cx={(e.coord_x! / 470) * CW} cy={(e.coord_y! / 280) * CH}
            r="4" fill={color} opacity="0.85" stroke="white" strokeWidth="0.8" />
        )
      })}
    </svg>
  )
}

// ── Player circle button ──────────────────────────────────────────────────────

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
      className="relative flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all active:scale-90"
      style={{
        backgroundColor: isSelected ? color : color + '30',
        border: `2.5px solid ${color}${isSelected ? '' : '90'}`,
        boxShadow: isSelected
          ? `0 0 14px ${color}70, inset 0 1px 0 rgba(255,255,255,0.2)`
          : `0 3px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)`,
        opacity: isDisqualified ? 0.3 : 1,
      }}
    >
      <span className="text-sm font-black tabular-nums leading-none"
        style={{ color: isSelected ? '#fff' : color }}>
        {player.numero}
      </span>
      {fouls > 0 && (
        <span className="text-[9px] font-bold leading-none mt-0.5"
          style={{ color: fouls >= 4 ? '#EF4444' : isSelected ? 'rgba(255,255,255,0.75)' : color + 'bb' }}>
          {fouls}F
        </span>
      )}
      {isDisqualified && (
        <span className="absolute inset-0 flex items-center justify-center text-red-500 text-base font-black pointer-events-none">✕</span>
      )}
      {player.is_captain && (
        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-black shadow-sm"
          style={{ backgroundColor: color, color: '#000', boxShadow: `0 0 4px ${color}80` }}>C</span>
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
        <div className="h-1 rounded-t-3xl" style={{ backgroundColor: color }} />
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 font-black text-base"
              style={{ borderColor: color, color, backgroundColor: color + '20' }}>
              {player.numero}
            </div>
            <div>
              <p className="font-bold text-sm uppercase tracking-wide">{player.nombre}</p>
              <p className="text-xs text-muted-foreground">
                {fouls} falta{fouls !== 1 ? 's' : ''}{player.is_starter ? ' · Titular' : ' · Suplente'}{player.is_captain ? ' · Cap.' : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground text-sm">✕</button>
        </div>
        <div className="px-4 pb-5 space-y-3">
          {!showFouls ? (
            <>
              <div className="flex justify-center gap-4">
                {SCORE_ACTIONS.map((a) => (
                  <button key={a.type} onClick={() => onSelect(a)} className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center font-black text-xl border-2 transition-colors"
                      style={{ borderColor: color, color, backgroundColor: color + '15', boxShadow: `0 4px 12px ${color}30` }}>
                      {a.short}
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{a.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex justify-center gap-3 flex-wrap">
                <button onClick={() => setShowFouls(true)} className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-base border-2 border-destructive/60 bg-destructive/10 text-destructive" style={{ boxShadow: '0 3px 8px rgba(239,68,68,0.2)' }}>F</div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Falta</span>
                </button>
                {STAT_ACTIONS.map((a) => (
                  <button key={a.type} onClick={() => onSelect(a)} className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xs border-2 border-border bg-muted/30 text-foreground" style={{ boxShadow: '0 3px 6px rgba(0,0,0,0.3)' }}>{a.short}</div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{a.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-center text-muted-foreground uppercase tracking-widest font-semibold">Tipo de falta</p>
              <div className="flex justify-center gap-4">
                {FOUL_ACTIONS.map((a) => (
                  <button key={a.type} onClick={() => onSelect(a)} className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center font-black text-sm border-2 border-destructive/70 bg-destructive/10 text-destructive" style={{ boxShadow: '0 4px 12px rgba(239,68,68,0.25)' }}>{a.short}</div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{a.label}</span>
                  </button>
                ))}
                <button onClick={() => setShowFouls(false)} className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-sm border-2 border-border bg-muted/30 text-muted-foreground" style={{ boxShadow: '0 3px 6px rgba(0,0,0,0.3)' }}>←</div>
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
        <button className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-semibold uppercase tracking-wide text-sm" onClick={onClose}>Entendido</button>
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
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
      {visible.length === 0 ? (
        <p className="text-muted-foreground text-xs text-center py-8 uppercase tracking-widest">Sin eventos</p>
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
                    <p className="text-xs text-muted-foreground truncate">#{player?.numero} {player?.nombre} · Q{e.cuarto}{e.clock_at_event ? ` · ${e.clock_at_event}` : ''}</p>
                  </div>
                  <button onClick={() => setConfirmId(e.id)} className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded flex-shrink-0">↩</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-sm text-destructive font-medium">¿Deshacer este evento?</p>
                  <button onClick={() => { onDelete(e.id); setConfirmId(null) }} className="px-3 py-1 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold">Sí</button>
                  <button onClick={() => setConfirmId(null)} className="px-3 py-1 rounded-lg bg-muted text-muted-foreground text-xs font-semibold">No</button>
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
    <div className="px-3 py-2">
      <p className="text-xs font-bold uppercase tracking-widest mb-2 px-1" style={{ color }}>{label}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border/50">
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
            const pe = active.filter((e) => e.player_id === p.id)
            const pts = pe.reduce((s, e) => s + e.calculated_points, 0)
            const c2 = pe.filter((e) => e.event_type === 'canasta_2').length
            const c3 = pe.filter((e) => e.event_type === 'canasta_3').length
            const tl = pe.filter((e) => e.event_type === 'tiro_libre').length
            const f = pe.filter((e) => e.event_type === 'falta_personal' || e.event_type === 'falta_tecnica').length
            return (
              <tr key={p.id} className="border-b border-border/20">
                <td className="py-1 px-1 font-mono font-bold">{p.numero}</td>
                <td className="py-1 px-1 truncate max-w-[80px]">
                  {p.nombre.split(' ')[0]}
                  {p.is_captain && <span className="ml-1 text-[9px] font-bold" style={{ color }}>C</span>}
                  {!p.is_starter && <span className="text-muted-foreground ml-1 text-[9px]">S</span>}
                </td>
                <td className="py-1 px-1 text-center font-bold" style={{ color: pts > 0 ? color : undefined }}>{pts || '-'}</td>
                <td className="py-1 px-1 text-center">{c2 || '-'}</td>
                <td className="py-1 px-1 text-center">{c3 || '-'}</td>
                <td className="py-1 px-1 text-center">{tl || '-'}</td>
                <td className="py-1 px-1 text-center" style={{ color: f >= 4 ? '#EF4444' : undefined, fontWeight: f >= 4 ? 700 : undefined }}>{f || '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Timeout audio + overlay ───────────────────────────────────────────────────

function playBeep(frequency = 880, duration = 0.18, volume = 0.35) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'; osc.frequency.value = frequency
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration)
  } catch (_) {}
}

const FIBA_TIMEOUT_SECONDS = 60

function TimeoutOverlay({ seconds, teamName, color, onClose }: {
  seconds: number; teamName: string; color: string; onClose: () => void
}) {
  const radius = 54
  const circ = 2 * Math.PI * radius
  const dash = circ * (seconds / FIBA_TIMEOUT_SECONDS)
  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color }}>{teamName} — Tiempo Fuera</p>
        <div className="relative w-36 h-36 flex items-center justify-center">
          <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            <circle cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="6"
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 1s linear' }} />
          </svg>
          <div className="flex flex-col items-center">
            <span className="text-5xl font-black tabular-nums leading-none text-foreground">{seconds}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-widest mt-1">seg</span>
          </div>
        </div>
        {seconds <= FIBA_TIMEOUT_SECONDS / 2 && seconds > 0 && (
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/60 bg-card/60">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
            <p className="text-xs font-semibold uppercase tracking-widest">Mitad del tiempo</p>
          </div>
        )}
        {seconds === 0 && (
          <p className="text-sm font-black uppercase tracking-widest text-destructive animate-pulse">¡Fin del tiempo fuera!</p>
        )}
        <button onClick={onClose} className="mt-1 px-6 py-2 rounded-xl border border-border/60 bg-card/60 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Cerrar
        </button>
      </div>
    </div>
  )
}

// ── Timeout dots ──────────────────────────────────────────────────────────────

function TimeoutDots({ left, total, color }: { left: number; total: number; color: string }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className="text-[10px] leading-none" style={{ color: i < left ? color : 'rgba(255,255,255,0.15)' }}>●</span>
      ))}
    </div>
  )
}

// ── Portrait warning overlay ──────────────────────────────────────────────────

function PortraitWarning() {
  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-background/95">
      <div className="text-6xl mb-6 animate-bounce">↻</div>
      <p className="text-lg font-black uppercase tracking-widest text-foreground mb-2">Girar dispositivo</p>
      <p className="text-sm text-muted-foreground text-center px-8">Esta pantalla requiere orientación horizontal</p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlayPage() {
  const { tournamentId, matchId } = useParams<{ tournamentId: string; matchId: string }>()
  const router = useRouter()
  const session = useSessionStore((s) => s.session)
  const sessionHydrated = useSessionStore((s) => s._hasHydrated)

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
  const [timeoutActive, setTimeoutActive] = useState<{ seconds: number; team: 'home' | 'away' } | null>(null)
  const [isPortrait, setIsPortrait] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.().catch(() => {})
      setIsFullscreen(false)
    }
  }

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Screen orientation lock + portrait detection + wake lock
  useEffect(() => {
    // Try to lock landscape
    if (typeof screen !== 'undefined' && screen.orientation && 'lock' in screen.orientation) {
      (screen.orientation as any).lock('landscape').catch(() => {})
    }

    // Portrait detection fallback (needed for iOS)
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth)
    }
    checkOrientation()
    window.addEventListener('resize', checkOrientation)

    // Wake lock - prevent screen sleep
    let wakeLock: any = null
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen')
        } catch (_) {}
      }
    }
    requestWakeLock()

    // Re-acquire wake lock when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestWakeLock()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('resize', checkOrientation)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (wakeLock) wakeLock.release().catch(() => {})
      if (timeoutIntervalRef.current) clearInterval(timeoutIntervalRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auth guard
  useEffect(() => {
    if (!sessionHydrated) return
    if (!session || session.tournament_id !== tournamentId) { router.push('/login'); return }
    if (tournamentMatchId && tournamentMatchId !== matchId) router.push(`/t/${tournamentId}`)
  }, [sessionHydrated]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clock ticker
  useEffect(() => {
    if (isClockRunning) {
      intervalRef.current = setInterval(tickClock, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isClockRunning, tickClock])

  // Reset bonus flags per quarter
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

  function handleTimeout(home: boolean) {
    if (getTimeoutsLeft(home) <= 0) return
    useTimeout(home)
    if (timeoutIntervalRef.current) clearInterval(timeoutIntervalRef.current)
    playBeep(880, 0.2)
    setTimeoutActive({ seconds: FIBA_TIMEOUT_SECONDS, team: home ? 'home' : 'away' })
    let remaining = FIBA_TIMEOUT_SECONDS
    timeoutIntervalRef.current = setInterval(() => {
      remaining -= 1
      if (remaining === FIBA_TIMEOUT_SECONDS / 2) { playBeep(660, 0.15); setTimeout(() => playBeep(880, 0.15), 200) }
      if (remaining <= 0) {
        clearInterval(timeoutIntervalRef.current!)
        playBeep(440, 0.3); setTimeout(() => playBeep(440, 0.3), 380)
        setTimeoutActive((p) => p ? { ...p, seconds: 0 } : null)
        setTimeout(() => setTimeoutActive(null), 1500)
        return
      }
      setTimeoutActive((p) => p ? { ...p, seconds: remaining } : null)
    }, 1000)
  }

  function dismissTimeout() {
    if (timeoutIntervalRef.current) clearInterval(timeoutIntervalRef.current)
    setTimeoutActive(null)
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
        setNotification(`⛔ #${selectedPlayer.numero} ${selectedPlayer.nombre} — ELIMINADO (${FIBA_RULES.PERSONAL_FOULS_LIMIT} faltas)`)
      }
    }
    setSelectedPlayer(null)
  }

  function handleNextQuarter() {
    if (cuarto >= 4) { router.push(`/t/${tournamentId}/match/${matchId}/summary`); return }
    nextQuarter()
  }

  // Derived values
  const homeScore = getHomeScore()
  const awayScore = getAwayScore()
  const quarterLabel = cuarto <= 4 ? `Q${cuarto}` : `OT${cuarto - 4}`
  const timeoutsHomeLeft = getTimeoutsLeft(true)
  const timeoutsAwayLeft = getTimeoutsLeft(false)
  const homeBonus = isInBonus(true)
  const awayBonus = isInBonus(false)
  const homeOnLeft = cuarto <= 2 || cuarto > 4
  const leftPlayers = homeOnLeft ? playersHome : playersAway
  const rightPlayers = homeOnLeft ? playersAway : playersHome
  const leftColor = homeOnLeft ? colorHome : colorAway
  const rightColor = homeOnLeft ? colorAway : colorHome
  const leftTeam = homeOnLeft ? teamHome : teamAway
  const rightTeam = homeOnLeft ? teamAway : teamHome
  const timeoutsForHalf = cuarto <= 2 ? FIBA_RULES.TIMEOUTS_FIRST_HALF : FIBA_RULES.TIMEOUTS_SECOND_HALF
  const selectedColor = selectedPlayer
    ? (playersHome.some((p) => p.id === selectedPlayer.id) ? colorHome : colorAway)
    : colorHome

  if (!teamHome || !teamAway) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Sin partido activo. <a href={`/t/${tournamentId}`} className="underline">Volver</a></p>
      </div>
    )
  }

  return (
    <div className="flex flex-col overflow-hidden bg-background select-none" style={{ width: '100dvw', height: '100dvh', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* Portrait warning */}
      {isPortrait && <PortraitWarning />}

      {/* ── SCOREBOARD ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-2 pt-1.5 pb-1"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        }}
      >
        {/* Row 1: teams + scores + center controls */}
        <div className="flex items-center gap-2">
          {/* Home side */}
          <div className="flex items-center gap-2 flex-1 justify-start">
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-wider leading-none mb-0.5 truncate max-w-[60px]" style={{ color: colorHome }}>{teamHome.nombre}</p>
              <p className="font-black tabular-nums leading-none" style={{ color: colorHome, fontSize: 'clamp(28px, 5vw, 42px)' }}>{homeScore}</p>
            </div>
            <div className="flex flex-col items-start gap-0.5">
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-semibold" style={{ color: awayBonus ? '#EF4444' : 'rgba(255,255,255,0.4)' }}>{teamHomeFoulsThisQuarter}F</span>
                <TimeoutDots left={timeoutsHomeLeft} total={timeoutsForHalf} color={colorHome} />
              </div>
              {awayBonus && <span className="text-[8px] font-black text-destructive uppercase tracking-wider">BONUS</span>}
            </div>
          </div>

          {/* Center: quarters + T/O + clock + possession */}
          <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
            {/* Quarter dots + T/O buttons row */}
            <div className="flex items-center gap-1">
              {/* T/O Home */}
              <button
                onClick={() => handleTimeout(true)}
                disabled={timeoutsHomeLeft <= 0}
                className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-90 disabled:opacity-30"
                style={{
                  background: colorHome + '20',
                  border: `1px solid ${colorHome}50`,
                  color: colorHome,
                  boxShadow: `0 2px 6px ${colorHome}20`,
                }}
              >
                T/O
              </button>

              {/* Quarter indicators */}
              <div className="flex gap-0.5">
                {[1, 2, 3, 4].map((q) => (
                  <div key={q}
                    className="flex items-center justify-center text-[9px] font-black rounded px-1.5 py-0.5 transition-all"
                    style={{
                      background: cuarto === q ? 'oklch(0.57 0.22 262)' : 'rgba(255,255,255,0.06)',
                      color: cuarto === q ? '#fff' : 'rgba(255,255,255,0.3)',
                      boxShadow: cuarto === q ? '0 2px 8px oklch(0.57 0.22 262 / 0.5), inset 0 1px 0 rgba(255,255,255,0.2)' : 'inset 0 1px 0 rgba(255,255,255,0.05)',
                    }}>
                    Q{q}
                  </div>
                ))}
                {cuarto > 4 && (
                  <div className="flex items-center justify-center text-[9px] font-black rounded px-1.5 py-0.5"
                    style={{ background: 'oklch(0.57 0.22 262)', color: '#fff', boxShadow: '0 2px 8px oklch(0.57 0.22 262 / 0.5)' }}>
                    OT{cuarto - 4}
                  </div>
                )}
              </div>

              {/* T/O Away */}
              <button
                onClick={() => handleTimeout(false)}
                disabled={timeoutsAwayLeft <= 0}
                className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-90 disabled:opacity-30"
                style={{
                  background: colorAway + '20',
                  border: `1px solid ${colorAway}50`,
                  color: colorAway,
                  boxShadow: `0 2px 6px ${colorAway}20`,
                }}
              >
                T/O
              </button>
            </div>

            {/* Clock + possession */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleClock}
                className="font-mono font-black tabular-nums transition-colors rounded-lg px-2 py-0.5"
                style={{
                  fontSize: 'clamp(20px, 3.5vw, 30px)',
                  color: isClockRunning ? '#EF4444' : '#fff',
                  background: 'rgba(255,255,255,0.05)',
                  boxShadow: isClockRunning ? '0 0 12px rgba(239,68,68,0.3), inset 0 1px 0 rgba(255,255,255,0.1)' : 'inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.3)',
                }}
              >
                {formatClock(clockSeconds)}
              </button>
              <button
                onClick={togglePossession}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
              >
                <span style={{ color: possessionHome ? colorHome : 'rgba(255,255,255,0.2)', fontSize: 8 }}>▶</span>
                <span className="text-muted-foreground uppercase tracking-widest" style={{ fontSize: 8 }}>pos</span>
                <span style={{ color: !possessionHome ? colorAway : 'rgba(255,255,255,0.2)', fontSize: 8 }}>◀</span>
              </button>
            </div>
          </div>

          {/* Away side */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="flex flex-col items-end gap-0.5">
              <div className="flex items-center gap-1">
                <TimeoutDots left={timeoutsAwayLeft} total={timeoutsForHalf} color={colorAway} />
                <span className="text-[9px] font-semibold" style={{ color: homeBonus ? '#EF4444' : 'rgba(255,255,255,0.4)' }}>{teamAwayFoulsThisQuarter}F</span>
              </div>
              {homeBonus && <span className="text-[8px] font-black text-destructive uppercase tracking-wider">BONUS</span>}
            </div>
            <div className="text-left">
              <p className="text-[9px] font-bold uppercase tracking-wider leading-none mb-0.5 truncate max-w-[60px]" style={{ color: colorAway }}>{teamAway.nombre}</p>
              <p className="font-black tabular-nums leading-none" style={{ color: colorAway, fontSize: 'clamp(28px, 5vw, 42px)' }}>{awayScore}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN AREA: player columns + center box ─────────────────────────── */}
      <div className="flex flex-1 overflow-hidden gap-1 p-1">

        {/* Left player column */}
        <div
          className="flex-shrink-0 w-14 sm:w-16 flex flex-col overflow-hidden rounded-xl"
          style={{
            background: leftColor + '08',
            border: `1px solid ${leftColor}25`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.3)`,
          }}
        >
          <div className="flex-shrink-0 py-1 px-0.5 text-center border-b" style={{ borderColor: leftColor + '20' }}>
            <p className="text-[7px] font-black uppercase tracking-widest truncate" style={{ color: leftColor }}>
              {leftTeam?.nombre.slice(0, 6)}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col items-center gap-2 py-2 px-1">
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

        {/* Center box: tabs + content */}
        <div
          className="flex-1 flex flex-col overflow-hidden rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          {/* Tab bar */}
          <div
            className="flex-shrink-0 flex border-b"
            style={{
              borderColor: 'rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.2)',
              boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.04)',
            }}
          >
            {(['general', 'eventos', 'planilla'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all"
                style={{
                  color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.35)',
                  borderBottom: activeTab === tab ? '2px solid oklch(0.57 0.22 262)' : '2px solid transparent',
                  background: activeTab === tab ? 'rgba(255,255,255,0.04)' : 'transparent',
                  textShadow: activeTab === tab ? '0 0 12px oklch(0.57 0.22 262 / 0.6)' : 'none',
                }}>
                {tab === 'general' ? 'General' : tab === 'eventos' ? 'Eventos' : 'Planilla'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'general' && (
              <div className="flex-1 p-1.5 flex items-center justify-center">
                <CourtShotChart events={events} playersHome={playersHome} colorHome={colorHome} colorAway={colorAway} />
              </div>
            )}
            {activeTab === 'eventos' && (
              <EventsTab events={events} playersHome={playersHome} playersAway={playersAway} onDelete={softDeleteEvent} />
            )}
            {activeTab === 'planilla' && (
              <div className="flex-1 overflow-y-auto">
                <PlanillaTab players={playersHome} events={events} label={teamHome.nombre} color={colorHome} />
                <div className="border-t my-1" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                <PlanillaTab players={playersAway} events={events} label={teamAway.nombre} color={colorAway} />
              </div>
            )}
          </div>
        </div>

        {/* Right player column */}
        <div
          className="flex-shrink-0 w-14 sm:w-16 flex flex-col overflow-hidden rounded-xl"
          style={{
            background: rightColor + '08',
            border: `1px solid ${rightColor}25`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.3)`,
          }}
        >
          <div className="flex-shrink-0 py-1 px-0.5 text-center border-b" style={{ borderColor: rightColor + '20' }}>
            <p className="text-[7px] font-black uppercase tracking-widest truncate" style={{ color: rightColor }}>
              {rightTeam?.nombre.slice(0, 6)}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col items-center gap-2 py-2 px-1">
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

      {/* ── BOTTOM BAR ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-3 py-1.5"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.25)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <button
          onClick={toggleFullscreen}
          className="px-3 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-widest transition-all active:scale-95"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.5)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          {isFullscreen ? 'Salir Mesa' : 'Modo Mesa ⊡'}
        </button>

        <button
          onClick={handleNextQuarter}
          className="px-6 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
          style={{
            background: cuarto >= 4
              ? 'linear-gradient(135deg, #EF4444, #DC2626)'
              : 'linear-gradient(135deg, oklch(0.57 0.22 262), oklch(0.65 0.18 205))',
            color: '#fff',
            boxShadow: cuarto >= 4
              ? '0 3px 12px rgba(239,68,68,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
              : '0 3px 12px oklch(0.57 0.22 262 / 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}
        >
          {cuarto >= 4 ? 'Fin Partido →' : `Fin ${quarterLabel} →`}
        </button>

        <div className="w-[80px]" /> {/* spacer to center the Fin button */}
      </div>

      {/* Action panel */}
      {selectedPlayer && (
        <ActionPanel player={selectedPlayer} fouls={getPlayerFouls(selectedPlayer.id)}
          color={selectedColor} onSelect={handleAction} onClose={() => setSelectedPlayer(null)} />
      )}

      {/* FIBA notification */}
      {notification && <Notification message={notification} onClose={() => setNotification(null)} />}

      {/* Timeout overlay */}
      {timeoutActive && (
        <TimeoutOverlay
          seconds={timeoutActive.seconds}
          teamName={timeoutActive.team === 'home' ? (teamHome?.nombre ?? '') : (teamAway?.nombre ?? '')}
          color={timeoutActive.team === 'home' ? colorHome : colorAway}
          onClose={dismissTimeout}
        />
      )}

    </div>
  )
}
