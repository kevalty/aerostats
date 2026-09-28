'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import {
  getTeams, createTeam, updateTeam, deleteTeam,
  getPlayers, createPlayer, updatePlayer, deletePlayer
} from '@/lib/supabase/queries'
import type { Team, Player } from '@/types'

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [teamForm, setTeamForm] = useState({ nombre: '', color: '' })
  const [playerForm, setPlayerForm] = useState({ nombre: '', numero_camiseta: '' })
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [teamDialogOpen, setTeamDialogOpen] = useState(false)
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false)

  useEffect(() => {
    loadTeams()
  }, [])

  useEffect(() => {
    if (selectedTeam) loadPlayers(selectedTeam.id)
  }, [selectedTeam])

  async function loadTeams() {
    try {
      const data = await getTeams()
      setTeams(data)
    } catch (e) { console.error(e) }
  }

  async function loadPlayers(teamId: string) {
    try {
      const data = await getPlayers(teamId)
      setPlayers(data)
    } catch (e) { console.error(e) }
  }

  function openNewTeamDialog() {
    setEditingTeam(null)
    setTeamForm({ nombre: '', color: '' })
    setTeamDialogOpen(true)
  }

  function openEditTeamDialog(team: Team) {
    setEditingTeam(team)
    setTeamForm({ nombre: team.nombre, color: team.color ?? '' })
    setTeamDialogOpen(true)
  }

  async function handleSaveTeam() {
    if (!teamForm.nombre.trim()) return
    try {
      if (editingTeam) {
        await updateTeam(editingTeam.id, { nombre: teamForm.nombre, color: teamForm.color || undefined })
      } else {
        await createTeam({ nombre: teamForm.nombre, color: teamForm.color || undefined })
      }
      setTeamDialogOpen(false)
      await loadTeams()
    } catch (e) { console.error(e) }
  }

  async function handleDeleteTeam(id: string) {
    try {
      await deleteTeam(id)
      if (selectedTeam?.id === id) setSelectedTeam(null)
      await loadTeams()
    } catch (e) { console.error(e) }
  }

  function openNewPlayerDialog() {
    setEditingPlayer(null)
    setPlayerForm({ nombre: '', numero_camiseta: '' })
    setPlayerDialogOpen(true)
  }

  function openEditPlayerDialog(player: Player) {
    setEditingPlayer(player)
    setPlayerForm({ nombre: player.nombre, numero_camiseta: String(player.numero_camiseta) })
    setPlayerDialogOpen(true)
  }

  async function handleSavePlayer() {
    if (!playerForm.nombre.trim() || !playerForm.numero_camiseta || !selectedTeam) return
    const num = parseInt(playerForm.numero_camiseta)
    if (isNaN(num)) return
    try {
      if (editingPlayer) {
        await updatePlayer(editingPlayer.id, { nombre: playerForm.nombre, numero_camiseta: num })
      } else {
        await createPlayer({ team_id: selectedTeam.id, nombre: playerForm.nombre, numero_camiseta: num })
      }
      setPlayerDialogOpen(false)
      await loadPlayers(selectedTeam.id)
    } catch (e) { console.error(e) }
  }

  async function handleDeletePlayer(id: string) {
    if (!selectedTeam) return
    try {
      await deletePlayer(id)
      await loadPlayers(selectedTeam.id)
    } catch (e) { console.error(e) }
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto">
      <header className="mb-6 pt-4 flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">← Volver</Button>
        </Link>
        <h1 className="text-xl font-bold">Equipos</h1>
      </header>

      {/* Teams list */}
      <div className="space-y-2 mb-4">
        {teams.map((team) => (
          <Card
            key={team.id}
            className={`cursor-pointer transition-colors ${selectedTeam?.id === team.id ? 'border-primary' : 'hover:border-primary/50'}`}
            onClick={() => setSelectedTeam(team)}
          >
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {team.color && (
                  <div className="w-4 h-4 rounded-full border border-white/20" style={{ background: team.color }} />
                )}
                <span className="font-medium">{team.nombre}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditTeamDialog(team) }}>
                  Editar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()} />}
                  >
                    Eliminar
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar equipo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se eliminarán también todos los jugadores del equipo. Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteTeam(team.id)}>
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={openNewTeamDialog} className="w-full mb-8">+ Nuevo Equipo</Button>

      {/* Players section */}
      {selectedTeam && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Jugadores — {selectedTeam.nombre}
          </h2>
          <div className="space-y-2 mb-4">
            {players.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Sin jugadores aún</p>
            ) : (
              players.map((player) => (
                <Card key={player.id}>
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="w-8 text-center font-mono">
                        {player.numero_camiseta}
                      </Badge>
                      <span className="font-medium">{player.nombre}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditPlayerDialog(player)}>
                        Editar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" />}
                        >
                          Eliminar
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar jugador?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeletePlayer(player.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <Button onClick={openNewPlayerDialog} variant="outline" className="w-full">
            + Agregar Jugador
          </Button>
        </section>
      )}

      {/* Team dialog */}
      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTeam ? 'Editar Equipo' : 'Nuevo Equipo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={teamForm.nombre}
                onChange={(e) => setTeamForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre del equipo"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color (hex, opcional)</label>
              <Input
                value={teamForm.color}
                onChange={(e) => setTeamForm((f) => ({ ...f, color: e.target.value }))}
                placeholder="#F59E0B"
              />
            </div>
            <Button className="w-full" onClick={handleSaveTeam} disabled={!teamForm.nombre.trim()}>
              {editingTeam ? 'Guardar Cambios' : 'Crear Equipo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Player dialog */}
      <Dialog open={playerDialogOpen} onOpenChange={setPlayerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlayer ? 'Editar Jugador' : 'Nuevo Jugador'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={playerForm.nombre}
                onChange={(e) => setPlayerForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre del jugador"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Número de camiseta</label>
              <Input
                type="number"
                value={playerForm.numero_camiseta}
                onChange={(e) => setPlayerForm((f) => ({ ...f, numero_camiseta: e.target.value }))}
                placeholder="23"
                min={0}
                max={99}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleSavePlayer}
              disabled={!playerForm.nombre.trim() || !playerForm.numero_camiseta}
            >
              {editingPlayer ? 'Guardar Cambios' : 'Agregar Jugador'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
