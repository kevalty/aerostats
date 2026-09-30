'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useSessionStore, useLiveMatchStore } from '@/store/tournamentStore'
import {
  getTournamentMatches, saveMatchConfig, saveMatchPlayer, updateTournamentMatchStatus,
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

function PlayerRow({
  player,
  onChange,
  onRemove,
  onToggleStarter,
  onToggleCaptain,
  startersCount,
  hasCaptain,
}: {
  player: PlayerForm
  onChange: (p: Partial<PlayerForm>) => void
  onRemove: () => void
  onToggleStarter: () => void
  onToggleCaptain: () => void
  startersCount: number
  hasCaptain: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        className="w-14 text-center font-mono"
        placeholder="#"
        value={player.numero}
        onChange={(e) => onChange({ numero: e.target.value.replace(/\D/g, '').slice(0, 2) })}
        type="text"
        inputMode="numeric"
      />
      <Input
        className="flex-1"
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
            ? 'bg-amber-500 text-black'
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

export default function MatchConfigPage() {
  const { tournamentId, matchId } = useParams<{ tournamentId: string; matchId: string }>()
  const router = useRouter()
  const session = useSessionStore((s) => s.session)
  const initLiveMatch = useLiveMatchStore((s) => s.initLiveMatch)

  const [matchData, setMatchData] = useState<{ teamHome: TournamentTeam; teamAway: TournamentTeam } | null>(null)
  const [officials, setOfficials] = useState({
    arbitro_principal: '',
    arbitro_auxiliar: '',
    planillero: '',
    anotador: '',
    notas: '',
  })
  const [playersHome, setPlayersHome] = useState<PlayerForm[]>([emptyPlayer()])
  const [playersAway, setPlayersAway] = useState<PlayerForm[]>([emptyPlayer()])
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!session || session.tournament_id !== tournamentId) { router.push('/login'); return }
    loadMatch()
  }, [matchId])

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

  function updatePlayer(
    side: 'home' | 'away',
    index: number,
    patch: Partial<PlayerForm>
  ) {
    const setter = side === 'home' ? setPlayersHome : setPlayersAway
    setter((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  function toggleStarter(side: 'home' | 'away', index: number) {
    const players = side === 'home' ? playersHome : playersAway
    const p = players[index]
    // If captain and unstarter, also uncaptain
    updatePlayer(side, index, {
      is_starter: !p.is_starter,
      is_captain: !p.is_starter ? p.is_captain : false,
    })
  }

  function toggleCaptain(side: 'home' | 'away', index: number) {
    const setter = side === 'home' ? setPlayersHome : setPlayersAway
    setter((prev) =>
      prev.map((p, i) => ({
        ...p,
        is_captain: i === index ? !p.is_captain : false,
      }))
    )
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

  const canStart =
    startersHome === 5 &&
    startersAway === 5 &&
    captainHome &&
    captainAway &&
    playersHome.every((p) => p.nombre.trim() && p.numero) &&
    playersAway.every((p) => p.nombre.trim() && p.numero) &&
    !!officials.arbitro_principal.trim()

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

      initLiveMatch(
        matchId,
        config,
        matchData.teamHome,
        matchData.teamAway,
        savedHome,
        savedAway,
        []
      )

      router.push(`/t/${tournamentId}/match/${matchId}/play`)
    } catch (e) {
      console.error(e)
    } finally {
      setStarting(false)
    }
  }

  if (!matchData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto pb-44">
      <header className="pt-4 mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/t/${tournamentId}`)}>←</Button>
        <div>
          <h1 className="text-lg font-bold">Configurar Encuentro</h1>
          <p className="text-xs text-muted-foreground">
            {matchData.teamHome.nombre} vs {matchData.teamAway.nombre}
          </p>
        </div>
      </header>

      {/* Officials */}
      <Card className="mb-6">
        <CardContent className="pt-4 space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Mesa y Árbitros
          </h2>
          <Input
            placeholder="Árbitro Principal *"
            value={officials.arbitro_principal}
            onChange={(e) => setOfficials((o) => ({ ...o, arbitro_principal: e.target.value }))}
          />
          <Input
            placeholder="Árbitro Auxiliar"
            value={officials.arbitro_auxiliar}
            onChange={(e) => setOfficials((o) => ({ ...o, arbitro_auxiliar: e.target.value }))}
          />
          <Input
            placeholder="Planillero"
            value={officials.planillero}
            onChange={(e) => setOfficials((o) => ({ ...o, planillero: e.target.value }))}
          />
          <Input
            placeholder="Anotador"
            value={officials.anotador}
            onChange={(e) => setOfficials((o) => ({ ...o, anotador: e.target.value }))}
          />
        </CardContent>
      </Card>

      {/* Players per team */}
      {(
        [
          { label: matchData.teamHome.nombre, side: 'home' as const, players: playersHome, starters: startersHome, hasCaptain: captainHome },
          { label: matchData.teamAway.nombre, side: 'away' as const, players: playersAway, starters: startersAway, hasCaptain: captainAway },
        ] as const
      ).map(({ label, side, players, starters, hasCaptain }) => (
        <Card key={side} className="mb-6">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {label}
              </h2>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span className={starters === 5 ? 'text-primary font-bold' : ''}>
                  {starters}/5 titulares
                </span>
                {hasCaptain && <Badge variant="secondary" className="text-xs">Capitán ✓</Badge>}
              </div>
            </div>
            <div className="text-xs text-muted-foreground flex gap-4 pl-16">
              <span>T = Titular</span>
              <span>C = Capitán</span>
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
                />
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => addPlayer(side)}
            >
              + Agregar Jugador
            </Button>
          </CardContent>
        </Card>
      ))}

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <div className="max-w-3xl mx-auto">
          {!canStart && (
            <p className="text-xs text-muted-foreground text-center mb-2">
              {!officials.arbitro_principal.trim()
                ? 'Falta el árbitro principal'
                : startersHome < 5 || startersAway < 5
                ? `Faltan titulares — Local: ${startersHome}/5, Visitante: ${startersAway}/5`
                : !captainHome || !captainAway
                ? 'Falta designar capitán en algún equipo'
                : 'Completá los datos de los jugadores'}
            </p>
          )}
          <Button
            className="w-full"
            size="lg"
            disabled={!canStart || starting}
            onClick={handleStart}
          >
            {starting ? 'Iniciando...' : '🏀 Iniciar Encuentro'}
          </Button>
        </div>
      </div>
    </main>
  )
}
