'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  DndContext,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useMatchStore } from '@/store/matchStore'
import { getMatches, getPlayers, finalizeMatch } from '@/lib/supabase/queries'
import { CanchaSVG } from '@/components/match/CanchaSVG'
import { PanelJugadores } from '@/components/match/PanelJugadores'
import { Reloj } from '@/components/match/Reloj'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import type { EventType } from '@/types'

export default function MatchPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const matchId = params.id

  const {
    initMatch,
    teamHome,
    teamAway,
    players,
    interactionMode,
    setInteractionMode,
    selectedPlayerId,
    selectPlayer,
    addEvent,
    undoLastEvent,
    getHomeScore,
    getAwayScore,
    teamHomeFouls,
    teamAwayFouls,
    teamHomeTimeouts,
    teamAwayTimeouts,
    quarter,
    matchId: storedMatchId,
  } = useMatchStore()

  const [loading, setLoading] = useState(true)
  const [tvMode, setTvMode] = useState(false)
  const [lastToast, setLastToast] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  )

  useEffect(() => {
    async function load() {
      try {
        if (storedMatchId === matchId) { setLoading(false); return }
        const matches = await getMatches()
        const match = matches.find((m) => m.id === matchId)
        if (!match) { router.push('/dashboard'); return }
        const allPlayers = await getPlayers()
        const matchPlayers = allPlayers.filter(
          (p) => p.team_id === match.team_home_id || p.team_id === match.team_away_id
        )
        initMatch(matchId, match.team_home!, match.team_away!, matchPlayers)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [matchId])

  function showToast(msg: string) {
    setLastToast(msg)
    setTimeout(() => setLastToast(null), 2000)
  }

  async function handleNonShotEvent(eventType: EventType) {
    if (!selectedPlayerId) { showToast('Selecciona un jugador primero'); return }
    await addEvent({
      match_id: matchId,
      player_id: selectedPlayerId,
      event_type: eventType,
      calculated_points: 0,
      timestamp: new Date().toISOString(),
    })
    selectPlayer(null)
    showToast(eventType.replace('_', ' '))
  }

  async function handleFreeThrow() {
    if (!selectedPlayerId) { showToast('Selecciona un jugador primero'); return }
    await addEvent({
      match_id: matchId,
      player_id: selectedPlayerId,
      event_type: 'tiro_libre',
      calculated_points: 1,
      timestamp: new Date().toISOString(),
    })
    showToast('+1 Tiro Libre')
  }

  function handleDragEnd(event: DragEndEvent) {
    if (event.over?.id === 'court' && event.active.id) {
      const playerId = String(event.active.id)
      selectPlayer(playerId)
      showToast('Jugador seleccionado — toca la cancha')
    }
  }

  async function handleFinalize() {
    await finalizeMatch(matchId)
    router.push('/dashboard')
  }

  const homeScore = getHomeScore()
  const awayScore = getAwayScore()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando partido...</p>
      </div>
    )
  }

  // TV mode — fullscreen scoreboard
  if (tvMode) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center bg-background p-8 cursor-pointer"
        onClick={() => setTvMode(false)}
      >
        <p className="text-muted-foreground text-sm mb-8 uppercase tracking-widest">
          Q{quarter} — Toca para salir del modo TV
        </p>
        <div className="flex items-center gap-12 w-full max-w-2xl justify-center">
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-muted-foreground uppercase tracking-wide mb-4">
              {teamHome?.nombre}
            </p>
            <p className="text-[120px] font-black text-primary leading-none tabular-nums">
              {homeScore}
            </p>
            <p className="text-muted-foreground mt-4">Faltas: {teamHomeFouls} · T/O: {teamHomeTimeouts}</p>
          </div>
          <div className="text-4xl font-bold text-muted-foreground">-</div>
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-muted-foreground uppercase tracking-wide mb-4">
              {teamAway?.nombre}
            </p>
            <p className="text-[120px] font-black text-secondary leading-none tabular-nums">
              {awayScore}
            </p>
            <p className="text-muted-foreground mt-4">Faltas: {teamAwayFouls} · T/O: {teamAwayTimeouts}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <main className="min-h-screen flex flex-col max-w-lg mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-border">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>←</Button>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
              {interactionMode === 'taptap' ? 'Tap-Tap' : 'Drag & Drop'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setInteractionMode(interactionMode === 'taptap' ? 'dnd' : 'taptap')}
            >
              ⇄
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setTvMode(true)}>📺</Button>
          </div>
        </header>

        {/* Scoreboard */}
        <div className="grid grid-cols-3 gap-2 px-4 py-3 bg-card">
          <div className="text-center">
            <p className="text-xs text-muted-foreground truncate">{teamHome?.nombre}</p>
            <p className="text-4xl font-black text-primary tabular-nums">{homeScore}</p>
            <p className="text-xs text-muted-foreground">F:{teamHomeFouls} T:{teamHomeTimeouts}</p>
          </div>
          <div className="flex flex-col items-center justify-center">
            <Reloj />
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground truncate">{teamAway?.nombre}</p>
            <p className="text-4xl font-black text-secondary tabular-nums">{awayScore}</p>
            <p className="text-xs text-muted-foreground">F:{teamAwayFouls} T:{teamAwayTimeouts}</p>
          </div>
        </div>

        {/* Players panel */}
        <div className="flex gap-3 px-4 py-2 border-b border-border">
          {teamHome && (
            <PanelJugadores
              teamId={teamHome.id}
              teamName={teamHome.nombre}
              teamColor={teamHome.color}
            />
          )}
          <div className="w-px bg-border" />
          {teamAway && (
            <PanelJugadores
              teamId={teamAway.id}
              teamName={teamAway.nombre}
              teamColor={teamAway.color}
            />
          )}
        </div>

        {/* Court */}
        <div className="px-2 py-2 flex-1">
          <CanchaSVG />
        </div>

        {/* Action buttons */}
        <div className="px-4 py-3 border-t border-border space-y-2">
          {lastToast && (
            <p className="text-center text-sm text-primary animate-pulse">{lastToast}</p>
          )}
          <div className="grid grid-cols-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => handleNonShotEvent('falta')}
            >
              Falta
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => handleNonShotEvent('tiempo_fuera')}
            >
              T/Out
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={handleFreeThrow}
            >
              +1 TL
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => handleNonShotEvent('robo')}
            >
              Robo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => handleNonShotEvent('rebote')}
            >
              Rebote
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => handleNonShotEvent('bloqueo')}
            >
              Bloqueo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs col-span-2"
              onClick={undoLastEvent}
            >
              ↩ Deshacer
            </Button>
          </div>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" className="w-full" size="sm" />}>
              Finalizar Partido
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Finalizar partido?</AlertDialogTitle>
                <AlertDialogDescription>
                  El marcador final quedará registrado. Podrás exportar el resumen desde el dashboard.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleFinalize}>Finalizar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
    </DndContext>
  )
}
