'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getTournaments, createTournament, updateTournament, deleteTournamentCascade } from '@/lib/supabase/queries'
import type { Tournament } from '@/types'

function generateCredentials(nombre: string) {
  const slug = nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 20)
  const suffix = Math.random().toString(36).slice(2, 6)
  return {
    username: `${slug}-${suffix}`,
    password: Math.random().toString(36).slice(2, 10).toUpperCase(),
  }
}

export default function AdminPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ nombre: '', max_partidos: '5' })
  const [newCreds, setNewCreds] = useState<{ username: string; password: string; nombre: string } | null>(null)
  const [credsDialogOpen, setCredsDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)

  // Edit state
  const [editTarget, setEditTarget] = useState<Tournament | null>(null)
  const [editForm, setEditForm] = useState({ nombre: '', max_partidos: '', status: '' })
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Tournament | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  function openEdit(t: Tournament) {
    setEditTarget(t)
    setEditForm({ nombre: t.nombre, max_partidos: String(t.max_partidos), status: t.status })
  }

  async function handleSaveEdit() {
    if (!editTarget || !editForm.nombre.trim()) return
    setSaving(true)
    try {
      await updateTournament(editTarget.id, {
        nombre: editForm.nombre.trim(),
        max_partidos: parseInt(editForm.max_partidos) || editTarget.max_partidos,
        status: editForm.status as Tournament['status'],
      })
      setEditTarget(null)
      await load()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteTournamentCascade(deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch (e) {
      console.error(e)
    } finally {
      setDeleting(false)
    }
  }

  async function handleShare() {
    if (!newCreds) return
    const text = `Torneo: ${newCreds.nombre}\nUsuario: ${newCreds.username}\nContraseña: ${newCreds.password}\nIngresá en: /login`
    if (navigator.share) {
      try { await navigator.share({ title: 'AroStats - Credenciales', text }) } catch (_) {}
    } else {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const statusColor: Record<string, string> = {
    activo: 'default',
    finalizado: 'secondary',
    expirado: 'destructive',
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <header className="pt-6 mb-8 flex items-end justify-between border-b border-border/40 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">AroStats</p>
          <h1 className="text-3xl font-black tracking-tight">Panel Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestión de torneos</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Operador</a>
          <Button onClick={() => setDialogOpen(true)} className="font-semibold">+ Nuevo Torneo</Button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: 'Total', value: tournaments.length },
          { label: 'Activos', value: tournaments.filter(t => t.status === 'activo').length },
          { label: 'Finalizados', value: tournaments.filter(t => t.status === 'finalizado').length },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-card p-4 text-center">
            <div className="text-2xl font-black text-foreground">{s.value}</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tournament grid */}
      {tournaments.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <div className="text-5xl mb-4 opacity-20">🏆</div>
          <p className="text-sm">Sin torneos aún. Creá el primero.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {tournaments.map((t) => (
            <div key={t.id} className="rounded-xl border border-border/60 bg-card overflow-hidden hover:border-primary/30 transition-colors">
              <div className="h-0.5 w-full" style={{
                background: t.status === 'activo'
                  ? 'linear-gradient(90deg, oklch(0.57 0.22 262), oklch(0.65 0.18 205))'
                  : t.status === 'finalizado' ? 'oklch(0.52 0.025 250)' : 'oklch(0.62 0.22 27)'
              }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base truncate">{t.nombre}</h3>
                    <p className="font-mono text-xs text-muted-foreground mt-0.5">{t.op_username}</p>
                  </div>
                  <Badge variant={statusColor[t.status] as any} className="flex-shrink-0 text-xs">{t.status}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t.max_partidos} partido{t.max_partidos !== 1 ? 's' : ''}</span>
                  <span>{new Date(t.created_at).toLocaleDateString('es-ES')}</span>
                </div>
                <div className="flex gap-2 mt-4 pt-3 border-t border-border/30">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs h-8"
                    onClick={() => openEdit(t)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(t)}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create tournament dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo Torneo</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre del torneo</label>
              <Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Copa Ciudad 2026" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cantidad de partidos</label>
              <Input type="number" min="1" max="100" value={form.max_partidos} onChange={(e) => setForm((f) => ({ ...f, max_partidos: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={creating || !form.nombre.trim()}>
              {creating ? 'Creando...' : 'Crear y generar credenciales'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit tournament dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Torneo</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input value={editForm.nombre} onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cantidad de partidos</label>
              <Input type="number" min="1" max="100" value={editForm.max_partidos} onChange={(e) => setEditForm((f) => ({ ...f, max_partidos: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v ?? f.status }))}>
                <SelectTrigger className="w-full">
                  <SelectValue>{editForm.status || null}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                  <SelectItem value="expirado">Expirado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSaveEdit} disabled={saving || !editForm.nombre.trim()}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o && !deleting) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar Torneo</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Vas a eliminar <strong className="text-foreground">{deleteTarget?.nombre}</strong> junto con todos sus equipos, partidos y estadísticas. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancelar
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Eliminando...' : 'Eliminar todo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credentials reveal dialog */}
      <Dialog open={credsDialogOpen} onOpenChange={setCredsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Torneo creado — Guardar credenciales</DialogTitle></DialogHeader>
          {newCreds && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Compartí estas credenciales con el operador de <strong>{newCreds.nombre}</strong>. No se volverán a mostrar.
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
              <p className="text-xs text-muted-foreground text-center">URL de acceso: <strong>/login</strong></p>
              <Button variant="outline" className="w-full" onClick={handleShare}>
                {copied ? '¡Copiado!' : 'Compartir'}
              </Button>
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
