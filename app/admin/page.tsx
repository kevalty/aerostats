'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getTournaments, createTournament } from '@/lib/supabase/queries'
import type { Tournament } from '@/types'

function generateCredentials(nombre: string) {
  const slug = nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 20)
  const suffix = Math.random().toString(36).slice(2, 6)
  const username = `${slug}-${suffix}`
  const password = Math.random().toString(36).slice(2, 10).toUpperCase()
  return { username, password }
}

export default function AdminPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ nombre: '', max_partidos: '5' })
  const [newCreds, setNewCreds] = useState<{ username: string; password: string; nombre: string } | null>(null)
  const [credsDialogOpen, setCredsDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  async function load() {
    try {
      const data = await getTournaments()
      setTournaments(data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreate() {
    if (!form.nombre.trim()) return
    setCreating(true)
    try {
      const { username, password } = generateCredentials(form.nombre)
      const bcrypt = await import('bcryptjs')
      const hash = await bcrypt.hash(password, 10)
      await createTournament({
        nombre: form.nombre.trim(),
        max_partidos: parseInt(form.max_partidos) || 5,
        op_username: username,
        op_password_hash: hash,
        status: 'activo',
      })
      setNewCreds({ username, password, nombre: form.nombre.trim() })
      setDialogOpen(false)
      setCredsDialogOpen(true)
      setForm({ nombre: '', max_partidos: '5' })
      await load()
    } finally {
      setCreating(false)
    }
  }

  const statusColor: Record<string, string> = {
    activo: 'default',
    finalizado: 'secondary',
    expirado: 'destructive',
  }

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto">
      <header className="pt-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Panel Admin</h1>
          <p className="text-xs text-muted-foreground">AroStats · Gestión de torneos</p>
        </div>
        <a href="/login" className="text-xs text-muted-foreground hover:text-foreground underline">
          ← Login operador
        </a>
      </header>

      <Button className="w-full mb-6" onClick={() => setDialogOpen(true)}>
        + Crear Torneo
      </Button>

      <div className="space-y-3">
        {tournaments.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Sin torneos aún</p>
        ) : (
          tournaments.map((t) => (
            <Card key={t.id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{t.nombre}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {t.op_username}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.max_partidos} partido{t.max_partidos !== 1 ? 's' : ''} ·{' '}
                      {new Date(t.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  <Badge variant={statusColor[t.status] as any}>{t.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create tournament dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Torneo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre del torneo</label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Copa Ciudad 2026"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cantidad de partidos</label>
              <Input
                type="number"
                min="1"
                max="100"
                value={form.max_partidos}
                onChange={(e) => setForm((f) => ({ ...f, max_partidos: e.target.value }))}
              />
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={creating || !form.nombre.trim()}>
              {creating ? 'Creando...' : 'Crear y generar credenciales'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credentials reveal dialog */}
      <Dialog open={credsDialogOpen} onOpenChange={setCredsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Torneo creado — Guardar credenciales</DialogTitle>
          </DialogHeader>
          {newCreds && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Compartí estas credenciales con el operador de <strong>{newCreds.nombre}</strong>.
                No se volverán a mostrar.
              </p>
              <div className="rounded-lg bg-muted p-4 space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usuario:</span>
                  <span className="font-bold select-all">{newCreds.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contraseña:</span>
                  <span className="font-bold select-all">{newCreds.password}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                URL de acceso: <strong>/login</strong>
              </p>
              <Button className="w-full" onClick={() => setCredsDialogOpen(false)}>
                Entendido, ya guardé las credenciales
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}
