'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSessionStore } from '@/store/tournamentStore'
import type { TournamentTeam, TournamentMatch } from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

export default function SetupPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const router = useRouter()
  const session = useSessionStore((s) => s.session)

  const [teams, setTeams] = useState<TournamentTeam[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [teamDialog, setTeamDialog] = useState(false)
  const [versusDialog, setVersusDialog] = useState(false)

  const [teamForm, setTeamForm] = useState({ nombre: '', ciudad: '', categoria: '', genero: '' })
  const [versusForm, setVersusForm] = useState({ homeId: '', awayId: '', scheduled_at: '' })

  useEffect(() => {
    if (!session || session.tournament_id !== tournamentId) { router.push('/login'); return }
    loadData()
  }, [tournamentId])

  async function loadData() {
    if (!USE_MOCK) return
    const { mockGetTournamentTeams, mockGetTournamentMatches } = await import('@/lib/supabase/mock-db')
    const [t, m] = await Promise.all([
      mockGetTournamentTeams(tournamentId),
      mockGetTournamentMatches(tournamentId),
    ])
    setTeams(t)
    setMatches(m)
  }

  async function handleAddTeam() {
    if (!teamForm.nombre.trim()) return
    if (USE_MOCK) {
      const { mockCreateTournamentTeam } = await import('@/lib/supabase/mock-db')
      await mockCreateTournamentTeam({ tournament_id: tournamentId, ...teamForm })
    }
    setTeamDialog(false)
    setTeamForm({ nombre: '', ciudad: '', categoria: '', genero: '' })
    await loadData()
  }

  async function handleDeleteTeam(id: string) {
    if (USE_MOCK) {
      const { mockDeleteTournamentTeam } = await import('@/lib/supabase/mock-db')
      await mockDeleteTournamentTeam(id)
    }
    await loadData()
  }

  async function handleAddVersus() {
    if (!versusForm.homeId || !versusForm.awayId || versusForm.homeId === versusForm.awayId) return
    if (USE_MOCK) {
      const { mockCreateTournamentMatch } = await import('@/lib/supabase/mock-db')
      await mockCreateTournamentMatch({
        tournament_id: tournamentId,
        team_home_id: versusForm.homeId,
        team_away_id: versusForm.awayId,
        match_order: matches.length + 1,
        scheduled_at: versusForm.scheduled_at || undefined,
        status: 'pendiente',
      })
    }
    setVersusDialog(false)
    setVersusForm({ homeId: '', awayId: '', scheduled_at: '' })
    await loadData()
  }

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto">
      <header className="pt-4 mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/t/${tournamentId}`)}>←</Button>
        <h1 className="text-xl font-bold">Equipos y Versus</h1>
      </header>

      {/* Teams */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Equipos ({teams.length})
          </h2>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTeamDialog(true)}>
            + Agregar
          </Button>
        </div>
        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin equipos</p>
        ) : (
          <div className="space-y-2">
            {teams.map((t) => (
              <Card key={t.id}>
                <CardContent className="py-2 px-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{t.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {[t.ciudad, t.categoria, t.genero].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive text-xs h-7"
                    onClick={() => handleDeleteTeam(t.id)}
                  >
                    Quitar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Versus */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Partidos ({matches.length})
          </h2>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setVersusDialog(true)}
            disabled={teams.length < 2}
          >
            + Versus
          </Button>
        </div>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {teams.length < 2 ? 'Necesitas al menos 2 equipos' : 'Sin partidos asignados'}
          </p>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <Card key={m.id}>
                <CardContent className="py-2 px-4">
                  <p className="font-medium text-sm">
                    #{m.match_order} · {m.team_home?.nombre} vs {m.team_away?.nombre}
                  </p>
                  {m.scheduled_at && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.scheduled_at).toLocaleString('es-ES', {
                        weekday: 'short', day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground capitalize">{m.status}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Team dialog */}
      <Dialog open={teamDialog} onOpenChange={setTeamDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo Equipo</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nombre *</label>
              <Input value={teamForm.nombre} onChange={(e) => setTeamForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Los Tigres" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Ciudad</label>
              <Input value={teamForm.ciudad} onChange={(e) => setTeamForm((f) => ({ ...f, ciudad: e.target.value }))} placeholder="Buenos Aires" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Categoria</label>
              <Input value={teamForm.categoria} onChange={(e) => setTeamForm((f) => ({ ...f, categoria: e.target.value }))} placeholder="Sub-15, Mayores..." />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Genero</label>
              <Input value={teamForm.genero} onChange={(e) => setTeamForm((f) => ({ ...f, genero: e.target.value }))} placeholder="Masculino, Femenino..." />
            </div>
            <Button className="w-full" onClick={handleAddTeam} disabled={!teamForm.nombre.trim()}>Agregar Equipo</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Versus dialog */}
      <Dialog open={versusDialog} onOpenChange={setVersusDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Asignar Versus</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Equipo Local</label>
              <Select value={versusForm.homeId} onValueChange={(v) => setVersusForm((f) => ({ ...f, homeId: v ?? '' }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Equipo Visitante</label>
              <Select value={versusForm.awayId} onValueChange={(v) => setVersusForm((f) => ({ ...f, awayId: v ?? '' }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {teams.filter((t) => t.id !== versusForm.homeId).map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Fecha y hora (opcional)</label>
              <Input type="datetime-local" value={versusForm.scheduled_at} onChange={(e) => setVersusForm((f) => ({ ...f, scheduled_at: e.target.value }))} />
            </div>
            <Button
              className="w-full"
              onClick={handleAddVersus}
              disabled={!versusForm.homeId || !versusForm.awayId || versusForm.homeId === versusForm.awayId}
            >
              Crear Partido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}