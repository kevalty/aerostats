'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSessionStore } from '@/store/tournamentStore'
import {
  getTournamentTeams, createTournamentTeam, deleteTournamentTeam,
  getTournamentMatches, createTournamentMatch,
} from '@/lib/supabase/queries'
import type { TournamentTeam, TournamentMatch } from '@/types'

export default function SetupPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const router = useRouter()
  const { session, _hasHydrated } = useSessionStore((s) => ({ session: s.session, _hasHydrated: s._hasHydrated }))

  const [teams, setTeams] = useState<TournamentTeam[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [teamDialog, setTeamDialog] = useState(false)
  const [versusDialog, setVersusDialog] = useState(false)

  const [teamForm, setTeamForm] = useState({ nombre: '', ciudad: '', categoria: '', genero: '' })
  // Split date and time for better UX on all devices
  const [versusForm, setVersusForm] = useState({ homeId: '', awayId: '', date: '', time: '' })

  useEffect(() => {
    if (!_hasHydrated) return
    if (!session || session.tournament_id !== tournamentId) { router.push('/login'); return }
    loadData()
  }, [_hasHydrated, tournamentId])

  async function loadData() {
    try {
      const [t, m] = await Promise.all([
        getTournamentTeams(tournamentId),
        getTournamentMatches(tournamentId),
      ])
      setTeams(t)
      setMatches(m)
    } catch (e) {
      console.error(e)
    }
  }

  async function handleAddTeam() {
    if (!teamForm.nombre.trim()) return
    try {
      await createTournamentTeam({ tournament_id: tournamentId, ...teamForm })
      setTeamDialog(false)
      setTeamForm({ nombre: '', ciudad: '', categoria: '', genero: '' })
      await loadData()
    } catch (e) {
      console.error(e)
    }
  }

  async function handleDeleteTeam(id: string) {
    try {
      await deleteTournamentTeam(id)
      await loadData()
    } catch (e) {
      console.error(e)
    }
  }

  async function handleDeleteMatch(id: string) {
    if (!window.confirm('¿Eliminar este partido?')) return
    try {
      const { supabase } = await import('@/lib/supabase/client')
      const { error } = await supabase.from('tournament_matches').delete().eq('id', id)
      if (error) throw error
      await loadData()
    } catch (e) {
      console.error(e)
    }
  }

  async function handleAddVersus() {
    if (!versusForm.homeId || !versusForm.awayId || versusForm.homeId === versusForm.awayId) return
    try {
      const scheduled_at = versusForm.date
        ? versusForm.time
          ? `${versusForm.date}T${versusForm.time}`
          : `${versusForm.date}T00:00`
        : undefined
      await createTournamentMatch({
        tournament_id: tournamentId,
        team_home_id: versusForm.homeId,
        team_away_id: versusForm.awayId,
        match_order: matches.length + 1,
        scheduled_at,
        status: 'pendiente',
      })
      setVersusDialog(false)
      setVersusForm({ homeId: '', awayId: '', date: '', time: '' })
      await loadData()
    } catch (e) {
      console.error(e)
    }
  }

  const homeTeamName = teams.find(t => t.id === versusForm.homeId)?.nombre
  const awayTeamName = teams.find(t => t.id === versusForm.awayId)?.nombre

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto">
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
                  {m.status === 'pendiente' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive text-xs h-7 mt-1"
                      onClick={() => handleDeleteMatch(m.id)}
                    >
                      Quitar
                    </Button>
                  )}
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
              <label className="text-sm font-medium">Categoría</label>
              <Input value={teamForm.categoria} onChange={(e) => setTeamForm((f) => ({ ...f, categoria: e.target.value }))} placeholder="Sub-15, Mayores..." />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Género</label>
              <Select
                value={teamForm.genero}
                onValueChange={(v) => setTeamForm((f) => ({ ...f, genero: v ?? '' }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar...">
                    {teamForm.genero || null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                  <SelectItem value="Femenino">Femenino</SelectItem>
                  <SelectItem value="Mixto">Mixto</SelectItem>
                </SelectContent>
              </Select>
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
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar...">
                    {homeTeamName ?? null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Equipo Visitante</label>
              <Select value={versusForm.awayId} onValueChange={(v) => setVersusForm((f) => ({ ...f, awayId: v ?? '' }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar...">
                    {awayTeamName ?? null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {teams.filter((t) => t.id !== versusForm.homeId).map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Fecha y hora (opcional)</label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Fecha</label>
                  <Input
                    type="date"
                    value={versusForm.date}
                    onChange={(e) => setVersusForm((f) => ({ ...f, date: e.target.value }))}
                    className="cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Hora</label>
                  <Input
                    type="time"
                    value={versusForm.time}
                    onChange={(e) => setVersusForm((f) => ({ ...f, time: e.target.value }))}
                    className="cursor-pointer"
                  />
                </div>
              </div>
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
