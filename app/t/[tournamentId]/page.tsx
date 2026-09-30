'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSessionStore } from '@/store/tournamentStore'
import { getTournamentMatches } from '@/lib/supabase/queries'
import type { TournamentMatch } from '@/types'

const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
}

export default function TournamentPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const router = useRouter()
  const { session, logout, _hasHydrated } = useSessionStore()
  const [matches, setMatches] = useState<TournamentMatch[]>([])

  useEffect(() => {
    if (!_hasHydrated) return
    if (!session || session.tournament_id !== tournamentId) {
      router.push('/login')
      return
    }
    load()
  }, [_hasHydrated, tournamentId, session])

  async function load() {
    try {
      const data = await getTournamentMatches(tournamentId)
      setMatches(data)
    } catch (e) {
      console.error(e)
    }
  }

  function handleLogout() {
    logout()
    router.push('/login')
  }

  const statusVariant: Record<string, string> = {
    pendiente: 'secondary',
    en_curso: 'default',
    finalizado: 'secondary',
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-10 max-w-4xl mx-auto">
      <header className="pt-6 mb-8 flex items-end justify-between border-b border-border/40 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">Torneo</p>
          <h1 className="text-2xl font-black tracking-tight">{session?.tournament_nombre}</h1>
          <p className="text-xs text-muted-foreground mt-1">op: {session?.op_username}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground text-xs">
          Salir →
        </Button>
      </header>

      <Button
        className="w-full mb-8 h-11 font-semibold"
        variant="outline"
        onClick={() => router.push(`/t/${tournamentId}/setup`)}
      >
        Gestionar Equipos y Versus
      </Button>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Partidos ({matches.length})
        </h2>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="text-4xl mb-4 opacity-20">🏀</div>
          <p className="text-sm">Sin partidos. Crea los versus en "Gestionar Equipos y Versus".</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl border bg-card overflow-hidden transition-colors ${
                m.status === 'en_curso' ? 'border-primary/50' : 'border-border/60 hover:border-border'
              }`}
            >
              {m.status === 'en_curso' && (
                <div className="h-0.5" style={{ background: 'linear-gradient(90deg, oklch(0.57 0.22 262), oklch(0.65 0.18 205))' }} />
              )}
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-muted-foreground font-mono">#{m.match_order}</span>
                    {m.status === 'en_curso' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        En curso
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-sm truncate">
                    {m.team_home?.nombre ?? '?'} <span className="text-muted-foreground font-normal">vs</span> {m.team_away?.nombre ?? '?'}
                  </p>
                  {m.scheduled_at && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(m.scheduled_at).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.status === 'pendiente' && (
                    <Button size="sm" variant="outline" className="text-xs h-8"
                      onClick={() => router.push(`/t/${tournamentId}/match/${m.id}/config`)}>
                      Configurar
                    </Button>
                  )}
                  {m.status === 'en_curso' && (
                    <Button size="sm" className="text-xs h-8 font-semibold"
                      onClick={() => router.push(`/t/${tournamentId}/match/${m.id}/play`)}>
                      Retomar →
                    </Button>
                  )}
                  {m.status === 'finalizado' && (
                    <Button size="sm" variant="ghost" className="text-xs h-8 text-muted-foreground"
                      onClick={() => router.push(`/t/${tournamentId}/match/${m.id}/summary`)}>
                      Ver resumen
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
