'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useSessionStore, useLiveMatchStore } from '@/store/tournamentStore'
import {
  getTournamentMatches, saveMatchConfig, saveMatchPlayer, updateTournamentMatchStatus,
  getCoachRosterSubmission,
} from '@/lib/supabase/queries'
import type { MatchPlayer, TournamentTeam } from '@/types'

type PlayerForm = {
  nombre: string
  numero: string
  is_starter: boolean
  is_captain: boolean
}

function emptyPlayer(): PlayerForm {
  return { nombre: '', numero: '', is_starter: false, is_captain: false }
}

const TEAM_COLORS = ['#3B82F6','#EF4444','#22C55E','#F97316','#A855F7','#EAB308','#FFFFFF','#6B7280']

function PlayerRow({
  player, onChange, onRemove, onToggleStarter, onToggleCaptain, startersCount, hasCaptain, isDuplicate,
}: {
  player: PlayerForm
  onChange: (p: Partial<PlayerForm>) => void
  onRemove: () => void
  onToggleStarter: () => void
  onToggleCaptain: () => void
  startersCount: number
  hasCaptain: boolean
  isDuplicate: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        className={`w-14 text-center font-mono ${isDuplicate ? 'border-destructive ring-1 ring-destructive' : ''}`}
        placeholder="#"
        value={player.numero}
        onChange={(e) => onChange({ numero: e.target.value.replace(/\D/g, '').slice(0, 2) })}
        type="text"
        inputMode="numeric"
      />
      <Input
        className="flex-1 uppercase"
        placeholder="Nombre del jugador"
        value={player.nombre}
        onChange={(e) => onChange({ nombre: e.target.value })}
      />
      <button
        onClick={onToggleStarter}
        disabled={!player.is_starter && startersCount >= 5}
        className={`w-8 h-8 rounded text-xs font-bold flex-shrink-0 transition-colors ${
          player.is_starter
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        } disabled:opacity-40`}
        title="Titular"
      >
        T
      </button>
      <button
        onClick={onToggleCaptain}
        disabled={!player.is_captain && hasCaptain}
        className={`w-8 h-8 rounded text-xs font-bold flex-shrink-0 transition-colors ${
          player.is_captain
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        } disabled:opacity-40`}
        title="Capitán"
      >
        C
      </button>
      <button
        onClick={onRemove}
        className="w-8 h-8 rounded text-xs text-destructive hover:bg-destructive/10 flex-shrink-0"
      >
        ✕
      </button>
    </div>
  )
}

type Tab = 'mesa' | 'home' | 'away'

export default function MatchConfigPage() {
  const { tournamentId, matchId } = useParams<{ tournamentId: string; matchId: string }>()
  const router = useRouter()
  const session = useSessionStore((s) => s.session)
  const _hasHydrated = useSessionStore((s) => s._hasHydrated)
  const initLiveMatch = useLiveMatchStore((s) => s.initLiveMatch)

  const [matchData, setMatchData] = useState<{ teamHome: TournamentTeam; teamAway: TournamentTeam } | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('mesa')
  const [officials, setOfficials] = useState({
    arbitro_principal: '',
    arbitro_auxiliar: '',
    planillero: '',
    anotador: '',
    notas: '',
  })
  const [playersHome, setPlayersHome] = useState<PlayerForm[]>([emptyPlayer()])
  const [playersAway, setPlayersAway] = useState<PlayerForm[]>([emptyPlayer()])
  const [colorHome, setColorHome] = useState('#3B82F6')
  const [colorAway, setColorAway] = useState('#EF4444')
  const [starting, setStarting] = useState(false)
  const [copiedSide, setCopiedSide] = useState<'home' | 'away' | null>(null)
  const [loadingRoster, setLoadingRoster] = useState<'home' | 'away' | null>(null)
  const [rosterMsg, setRosterMsg] = useState<{ side: 'home' | 'away'; text: string } | null>(null)

  useEffect(() => {
    if (!_hasHydrated) return
    if (!session || session.tournament_id !== tournamentId) { router.push('/login'); return }
    loadMatch()
  }, [_hasHydrated, matchId])

  async function loadMatch() {
    try {
      const matches = await getTournamentMatches(tournamentId)
      const m = matches.find((x) => x.id === matchId)
      if (!m || !m.team_home || !m.team_away) { router.push(`/t/${tournamentId}`); return }
      setMatchData({ teamHome: m.team_home, teamAway: m.team_away })
    } catch (e) {
      console.error(e)
    }
  }

  function updatePlayer(side: 'home' | 'away', index: number, patch: Partial<PlayerForm>) {
    const setter = side === 'home' ? setPlayersHome : setPlayersAway
    setter((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  function toggleStarter(side: 'home' | 'away', index: number) {
    const players = side === 'home' ? playersHome : playersAway
    const p = players[index]
    updatePlayer(side, index, { is_starter: !p.is_starter, is_captain: !p.is_starter ? p.is_captain : false })
  }

  function toggleCaptain(side: 'home' | 'away', index: number) {
    const setter = side === 'home' ? setPlayersHome : setPlayersAway
    setter((prev) => prev.map((p, i) => ({ ...p, is_captain: i === index ? !p.is_captain : false })))
  }

  function addPlayer(side: 'home' | 'away') {
    const setter = side === 'home' ? setPlayersHome : setPlayersAway
    setter((prev) => [...prev, emptyPlayer()])
  }

  function removePlayer(side: 'home' | 'away', index: number) {
    const setter = side === 'home' ? setPlayersHome : setPlayersAway
    setter((prev) => prev.filter((_, i) => i !== index))
  }

  const startersHome = playersHome.filter((p) => p.is_starter).length
  const startersAway = playersAway.filter((p) => p.is_starter).length
  const captainHome = playersHome.some((p) => p.is_captain)
  const captainAway = playersAway.some((p) => p.is_captain)

  function duplicateNums(players: PlayerForm[]): Set<string> {
    const nums = players.map((p) => p.numero).filter(Boolean)
    const seen = new Set<string>()
    const dups = new Set<string>()
    for (const n of nums) { if (seen.has(n)) dups.add(n); else seen.add(n) }
    return dups
  }
  const homeDups = duplicateNums(playersHome)
  const awayDups = duplicateNums(playersAway)

  const mesaOk = !!officials.arbitro_principal.trim()
  const homeOk = startersHome === 5 && captainHome && homeDups.size === 0 && playersHome.every((p) => p.nombre.trim() && p.numero)
  const awayOk = startersAway === 5 && captainAway && awayDups.size === 0 && playersAway.every((p) => p.nombre.trim() && p.numero)
  const canStart = mesaOk && homeOk && awayOk

  async function handleStart() {
    if (!canStart || !matchData) return
    setStarting(true)
    try {
      const config = await saveMatchConfig({
        tournament_match_id: matchId,
        ...officials,
        possession_home: true,
      })

      const savedHome: MatchPlayer[] = []
      const savedAway: MatchPlayer[] = []

      for (const p of playersHome) {
        if (!p.nombre.trim() || !p.numero) continue
        const saved = await saveMatchPlayer({
          tournament_match_id: matchId,
          team_id: matchData.teamHome.id,
          nombre: p.nombre.trim(),
          numero: parseInt(p.numero),
          is_starter: p.is_starter,
          is_captain: p.is_captain,
        })
        savedHome.push(saved)
      }
      for (const p of playersAway) {
        if (!p.nombre.trim() || !p.numero) continue
        const saved = await saveMatchPlayer({
          tournament_match_id: matchId,
          team_id: matchData.teamAway.id,
          nombre: p.nombre.trim(),
          numero: parseInt(p.numero),
          is_starter: p.is_starter,
          is_captain: p.is_captain,
        })
        savedAway.push(saved)
      }

      await updateTournamentMatchStatus(matchId, 'en_curso')
      initLiveMatch(matchId, config, matchData.teamHome, matchData.teamAway, savedHome, savedAway, [], colorHome, colorAway)
      router.push(`/t/${tournamentId}/match/${matchId}/play`)
    } catch (e) {
      console.error(e)
    } finally {
      setStarting(false)
    }
  }

  async function handleCopyLink(side: 'home' | 'away') {
    if (!matchData) return
    const teamId = side === 'home' ? matchData.teamHome.id : matchData.teamAway.id
    const url = `${window.location.origin}/roster/${matchId}/${teamId}`
    await navigator.clipboard.writeText(url)
    setCopiedSide(side)
    setTimeout(() => setCopiedSide(null), 2000)
  }

  async function handleLoadRoster(side: 'home' | 'away') {
    if (!matchData) return
    const teamId = side === 'home' ? matchData.teamHome.id : matchData.teamAway.id
    setLoadingRoster(side)
    setRosterMsg(null)
    try {
      const data = await getCoachRosterSubmission(matchId, teamId)
      if (!data || data.length === 0) {
        setRosterMsg({ side, text: 'El coach aún no envió el plantel' })
        return
      }
      const forms: PlayerForm[] = data.map((p) => ({
        nombre: p.nombre,
        numero: String(p.numero),
        is_starter: p.is_starter,
        is_captain: p.is_captain,
      }))
      if (side === 'home') setPlayersHome(forms)
      else setPlayersAway(forms)
      setRosterMsg({ side, text: `Plantel cargado — ${forms.length} jugadores` })
      setTimeout(() => setRosterMsg(null), 3000)
    } catch (e) {
      console.error(e)
      setRosterMsg({ side, text: 'Error al cargar el plantel' })
    } finally {
      setLoadingRoster(null)
    }
  }

  if (!matchData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm uppercase tracking-widest">Cargando...</p>
      </div>
    )
  }

  const tabs: { key: Tab; label: string; ok: boolean }[] = [
    { key: 'mesa', label: 'Mesa', ok: mesaOk },
    { key: 'home', label: matchData.teamHome.nombre, ok: homeOk },
    { key: 'away', label: matchData.teamAway.nombre, ok: awayOk },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background border-b border-border/60">
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-0 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/t/${tournamentId}`)}>←</Button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Configurar Encuentro</p>
            <p className="text-sm font-bold truncate">
              {matchData.teamHome.nombre} <span className="text-muted-foreground font-normal">vs</span> {matchData.teamAway.nombre}
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-3xl mx-auto px-4 flex gap-1 mt-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`relative flex-1 pb-3 pt-1 text-xs font-semibold uppercase tracking-wider truncate transition-colors ${
                activeTab === t.key
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              {t.label}
              {t.ok && (
                <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-primary align-middle" />
              )}
              {activeTab === t.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Tab content */}
      <main className="flex-1 overflow-y-auto max-w-3xl w-full mx-auto px-4 py-6 pb-36">

        {/* MESA */}
        {activeTab === 'mesa' && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Árbitros y Mesa de Control</p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Árbitro Principal *</label>
                <Input
                  placeholder="Nombre completo"
                  value={officials.arbitro_principal}
                  onChange={(e) => setOfficials((o) => ({ ...o, arbitro_principal: e.target.value }))}
                  className="uppercase"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Árbitro Auxiliar</label>
                <Input
                  placeholder="Nombre completo"
                  value={officials.arbitro_auxiliar}
                  onChange={(e) => setOfficials((o) => ({ ...o, arbitro_auxiliar: e.target.value }))}
                  className="uppercase"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Planillero</label>
                <Input
                  placeholder="Nombre completo"
                  value={officials.planillero}
                  onChange={(e) => setOfficials((o) => ({ ...o, planillero: e.target.value }))}
                  className="uppercase"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Anotador</label>
                <Input
                  placeholder="Nombre completo"
                  value={officials.anotador}
                  onChange={(e) => setOfficials((o) => ({ ...o, anotador: e.target.value }))}
                  className="uppercase"
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 uppercase tracking-wider text-xs font-semibold"
              onClick={() => setActiveTab('home')}
            >
              Siguiente → {matchData.teamHome.nombre}
            </Button>
          </div>
        )}

        {/* HOME / AWAY TEAMS */}
        {(activeTab === 'home' || activeTab === 'away') && (() => {
          const side = activeTab === 'home' ? 'home' as const : 'away' as const
          const players = side === 'home' ? playersHome : playersAway
          const starters = side === 'home' ? startersHome : startersAway
          const hasCaptain = side === 'home' ? captainHome : captainAway
          const teamName = side === 'home' ? matchData.teamHome.nombre : matchData.teamAway.nombre
          const nextTab: Tab | null = side === 'home' ? 'away' : null

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                  {teamName}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${starters === 5 ? 'text-primary' : 'text-muted-foreground'}`}>
                    {starters}/5 Titulares
                  </span>
                  {hasCaptain && (
                    <Badge variant="secondary" className="text-xs uppercase tracking-wide">Capitán ✓</Badge>
                  )}
                </div>
              </div>

              {/* Coach link row */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs uppercase tracking-wider font-semibold h-8"
                  onClick={() => handleCopyLink(side)}
                >
                  {copiedSide === side ? '¡Link copiado!' : 'Copiar link coach'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs uppercase tracking-wider font-semibold h-8"
                  onClick={() => handleLoadRoster(side)}
                  disabled={loadingRoster === side}
                >
                  {loadingRoster === side ? 'Cargando...' : 'Cargar plantel ↓'}
                </Button>
              </div>
              {rosterMsg?.side === side && (
                <p className="text-xs text-muted-foreground text-center">{rosterMsg.text}</p>
              )}

              <div className="flex gap-4 text-xs text-muted-foreground uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <span className="w-6 h-6 rounded bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">T</span>
                  Titular
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-6 h-6 rounded bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center">C</span>
                  Capitán
                </span>
              </div>

              <div className="space-y-2">
                {players.map((p, i) => (
                  <PlayerRow
                    key={i}
                    player={p}
                    onChange={(patch) => updatePlayer(side, i, patch)}
                    onRemove={() => removePlayer(side, i)}
                    onToggleStarter={() => toggleStarter(side, i)}
                    onToggleCaptain={() => toggleCaptain(side, i)}
                    startersCount={starters}
                    hasCaptain={hasCaptain && !p.is_captain}
                    isDuplicate={!!p.numero && (side === 'home' ? homeDups : awayDups).has(p.numero)}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs uppercase tracking-wider font-semibold"
                onClick={() => addPlayer(side)}
              >
                + Agregar Jugador
              </Button>

              <div className="space-y-2 pt-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Color del equipo</label>
                <div className="flex gap-2 flex-wrap">
                  {TEAM_COLORS.map((c) => {
                    const selected = side === 'home' ? colorHome === c : colorAway === c
                    return (
                      <button
                        key={c}
                        onClick={() => side === 'home' ? setColorHome(c) : setColorAway(c)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${selected ? 'border-foreground scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    )
                  })}
                </div>
              </div>

              {nextTab && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-1 uppercase tracking-wider text-xs font-semibold"
                  onClick={() => setActiveTab(nextTab)}
                >
                  Siguiente → {matchData.teamAway.nombre}
                </Button>
              )}
            </div>
          )
        })()}
      </main>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t border-border/60">
        <div className="max-w-3xl mx-auto p-4">
          {!canStart && (
            <p className="text-xs text-muted-foreground text-center mb-2 uppercase tracking-wide">
              {!mesaOk
                ? 'Falta el árbitro principal'
                : !homeOk
                ? `Local: ${startersHome}/5 titulares${!captainHome ? ' · falta capitán' : ''}`
                : `Visitante: ${startersAway}/5 titulares${!captainAway ? ' · falta capitán' : ''}`}
            </p>
          )}
          <Button
            className="w-full h-11 font-bold uppercase tracking-wider"
            disabled={!canStart || starting}
            onClick={handleStart}
          >
            {starting ? 'Iniciando...' : 'Iniciar Encuentro'}
          </Button>
        </div>
      </div>
    </div>
  )
}
