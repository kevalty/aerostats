'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { getTeams, getMatches, createMatch } from '@/lib/supabase/queries'
import type { Team, Match } from '@/types'

export default function DashboardPage() {
  const router = useRouter()
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [homeTeamId, setHomeTeamId] = useState('')
  const [awayTeamId, setAwayTeamId] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  async function reload() {
    getTeams().then(setTeams).catch(console.error)
    getMatches().then(setMatches).catch(console.error)
  }

  useEffect(() => { reload() }, [])

  async function handleCreateMatch() {
    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) return
    setCreating(true)
    try {
      const match = await createMatch({ team_home_id: homeTeamId, team_away_id: awayTeamId })
      setDialogOpen(false)
      router.push(`/match/${match.id}`)
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto">
      <header className="mb-6 pt-4">
        <h1 className="text-3xl font-bold text-primary">AroStats</h1>
        <p className="text-muted-foreground text-sm mt-1">Planillaje deportivo interactivo</p>
      </header>

      <div className="grid grid-cols-2 gap-3 mb-8">
        <Link href="/teams">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardContent className="pt-6 pb-4 text-center">
              <div className="text-2xl mb-2">👥</div>
              <p className="text-sm font-medium">Equipos</p>
            </CardContent>
          </Card>
        </Link>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setDialogOpen(true)}
          >
            <CardContent className="pt-6 pb-4 text-center">
              <div className="text-2xl mb-2">🏀</div>
              <p className="text-sm font-medium">Nuevo Partido</p>
            </CardContent>
          </Card>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Partido</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Equipo Local</label>
                <Select value={homeTeamId} onValueChange={(v) => setHomeTeamId(v ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar equipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Equipo Visitante</label>
                <Select value={awayTeamId} onValueChange={(v) => setAwayTeamId(v ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar equipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={handleCreateMatch}
                disabled={creating || !homeTeamId || !awayTeamId || homeTeamId === awayTeamId}
              >
                {creating ? 'Creando...' : 'Iniciar Partido'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Partidos Recientes
        </h2>
        {matches.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            No hay partidos aún.
          </p>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <Link key={m.id} href={`/match/${m.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {m.team_home?.nombre ?? '—'} vs {m.team_away?.nombre ?? '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    <Badge variant={m.status === 'finalizado' ? 'secondary' : 'default'}>
                      {m.status === 'finalizado' ? 'Finalizado' : 'En curso'}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
