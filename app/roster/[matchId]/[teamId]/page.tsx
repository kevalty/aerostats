'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getCoachRosterSubmission, upsertCoachRoster } from '@/lib/supabase/queries'
import type { CoachRosterPlayer } from '@/types'

function emptyPlayer(): CoachRosterPlayer {
  return { nombre: '', numero: 0, is_starter: false, is_captain: false }
}

export default function CoachRosterPage() {
  const { matchId, teamId } = useParams<{ matchId: string; teamId: string }>()
  const [teamName, setTeamName] = useState<string>('')
  const [players, setPlayers] = useState<CoachRosterPlayer[]>([emptyPlayer()])
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { supabase } = await import('@/lib/supabase/client')
        const { data: team } = await supabase
          .from('tournament_teams')
          .select('nombre')
          .eq('id', teamId)
          .single()
        if (team) setTeamName(team.nombre)

        const existing = await getCoachRosterSubmission(matchId, teamId)
        if (existing && existing.length > 0) setPlayers(existing)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [matchId, teamId])

  function updatePlayer(index: number, patch: Partial<CoachRosterPlayer>) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  function addPlayer() {
    setPlayers((prev) => [...prev, emptyPlayer()])
  }

  function removePlayer(index: number) {
    setPlayers((prev) => prev.filter((_, i) => i !== index))
  }

  function toggleCaptain(index: number) {
    setPlayers((prev) =>
      prev.map((p, i) => ({ ...p, is_captain: i === index ? !p.is_captain : false }))
    )
  }

  async function handleSubmit() {
    const valid = players.filter((p) => p.nombre.trim() && p.numero > 0)
    if (valid.length === 0) return
    setSubmitting(true)
    try {
      await upsertCoachRoster(matchId, teamId, valid)
      setSubmitted(true)
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const startersCount = players.filter((p) => p.is_starter).length

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm uppercase tracking-widest">Cargando...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto">
      <header className="pt-6 mb-6 border-b border-border/40 pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">AroStats</p>
        <h1 className="text-2xl font-black tracking-tight">{teamName || 'Equipo'}</h1>
        <p className="text-sm text-muted-foreground mt-1">Ingresá los jugadores para este partido</p>
      </header>

      {submitted && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 mb-6 text-center">
          <p className="text-sm font-semibold text-primary">Plantel enviado ✓</p>
          <p className="text-xs text-muted-foreground mt-1">Podés actualizar y re-enviar en cualquier momento</p>
        </div>
      )}

      <div className="space-y-2 mb-4">
        {players.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              className="w-14 text-center font-mono"
              placeholder="#"
              value={p.numero === 0 ? '' : String(p.numero)}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, '').slice(0, 2))
                updatePlayer(i, { numero: isNaN(n) ? 0 : n })
              }}
              type="text"
              inputMode="numeric"
            />
            <Input
              className="flex-1 uppercase"
              placeholder="Nombre del jugador"
              value={p.nombre}
              onChange={(e) => updatePlayer(i, { nombre: e.target.value })}
            />
            <button
              onClick={() => updatePlayer(i, { is_starter: !p.is_starter })}
              disabled={!p.is_starter && startersCount >= 5}
              className={`w-8 h-8 rounded text-xs font-bold flex-shrink-0 transition-colors ${
                p.is_starter
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              } disabled:opacity-40`}
              title="Titular"
            >
              T
            </button>
            <button
              onClick={() => toggleCaptain(i)}
              disabled={!p.is_captain && players.some((x) => x.is_captain)}
              className={`w-8 h-8 rounded text-xs font-bold flex-shrink-0 transition-colors ${
                p.is_captain
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              } disabled:opacity-40`}
              title="Capitán"
            >
              C
            </button>
            <button
              onClick={() => removePlayer(i)}
              className="w-8 h-8 rounded text-xs text-destructive hover:bg-destructive/10 flex-shrink-0"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full mb-6 text-xs uppercase tracking-wider font-semibold"
        onClick={addPlayer}
      >
        + Agregar Jugador
      </Button>

      <Button
        className="w-full h-11 font-bold uppercase tracking-wider"
        onClick={handleSubmit}
        disabled={submitting || players.filter((p) => p.nombre.trim() && p.numero > 0).length === 0}
      >
        {submitting ? 'Enviando...' : 'Enviar plantel'}
      </Button>
    </main>
  )
}
