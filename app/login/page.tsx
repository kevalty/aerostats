'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSessionStore } from '@/store/tournamentStore'
import { authOperator } from '@/lib/supabase/queries'

export default function LoginPage() {
  const router = useRouter()
  const setSession = useSessionStore((s) => s.setSession)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const tournament = await authOperator(username.trim(), password)
      if (!tournament) {
        setError('Usuario o contraseña incorrectos')
        return
      }
      setSession({
        tournament_id: tournament.id,
        tournament_nombre: tournament.nombre,
        op_username: tournament.op_username,
        logged_in_at: new Date().toISOString(),
      })
      router.push(`/t/${tournament.id}`)
    } catch {
      setError('Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <h1 className="text-2xl font-bold text-primary">AroStats</h1>
          <p className="text-sm text-muted-foreground">Acceso de operador</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Usuario del torneo</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="torneo-2026"
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contraseña</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading || !username || !password}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <a href="/admin" className="text-xs text-muted-foreground hover:text-foreground underline">
              Panel de administrador
            </a>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
