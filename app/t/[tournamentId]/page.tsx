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
  const { session, logout } = useSessionStore()
  const [matches, setMatches] = useState<TournamentMatch[]>([])

  useEffect(() => {
    if (!session || session.tournament_id !== tournamentId) {
      router.push('/login')
      return
    }
    load()
  }, [tournamentId, session])

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
    <main className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto">
      <header className="pt-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{session?.tournament_nombre}</h1>
          <p className="text-xs text-muted-foreground">Operador: {session?.op_username}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
          Salir
        </Button>
      </header>

      <Button
        className="w-full mb-6"
        variant="outline"
        onClick={() => router.push(`/t/${tournamentId}/setup`)}
      >
        Gestionar Equipos y Versus
      </Button>

      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Partidos del Torneo
        </h2>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sin partidos aun. Crea los versus en "Gestionar Equipos y Versus".
          </p>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <Card key={m.id} className={m.status === 'en_curso' ? 'border-primary' : ''}>
                <CardContent className="py-3 px-4 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      #{m.match_order} · {m.team_home?.nombre ?? '?'} vs {m.team_away?.nombre ?? '?'}
                    </p>
                    {m.scheduled_at && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.scheduled_at).toLocaleString('es-ES', {
                          weekday: 'short', day: 'numeric', month: 'short',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={statusVariant[m.status] as any}>
                      {STATUS_LABEL[m.status]}
                    </Badge>
                    {m.status === 'pendiente' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => router.push(`/t/${tournamentId}/match/${m.id}/config`)}
                      >
                        Configurar
                      </Button>
                    )}
                    {m.status === 'en_curso' && (
                      <Button
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => router.push(`/t/${tournamentId}/match/${m.id}/play`)}
                      >
                        Retomar
                      </Button>
                    )}
                    {m.status === 'finalizado' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7"
                        onClick={() => router.push(`/t/${tournamentId}/match/${m.id}/summary`)}
                      >
                        Ver resumen
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
