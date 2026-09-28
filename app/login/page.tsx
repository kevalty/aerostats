'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
    <div className="min-h-screen bg-background flex">
      {/* ── Hero Panel (desktop only) ── */}
      <div
        className="hidden lg:flex w-[45%] relative overflow-hidden flex-col items-center justify-center"
        style={{
          background: 'linear-gradient(160deg, oklch(0.10 0.04 250) 0%, oklch(0.14 0.06 262) 50%, oklch(0.18 0.10 262) 100%)',
        }}
      >
        {/* Dot grid overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, oklch(0.57 0.22 262 / 20%) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        {/* Glow orb */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, oklch(0.57 0.22 262 / 25%) 0%, transparent 70%)',
          }}
        />
        {/* Content */}
        <div className="relative z-10 text-center px-12">
          <div className="display-heading text-7xl text-white mb-3">
            ARO<span style={{ color: 'oklch(0.70 0.20 262)' }}>STATS</span>
          </div>
          <p className="text-sm tracking-widest uppercase font-medium mb-12" style={{ color: 'oklch(0.70 0.15 250)' }}>
            Planillaje deportivo profesional
          </p>
          <div className="grid grid-cols-3 gap-6 mt-4">
            {[
              { value: 'FIBA', label: 'Reglamento' },
              { value: '4Q', label: 'Cuartos' },
              { value: 'PDF', label: 'Exportar' },
            ].map((stat) => (
              <div key={stat.value} className="text-center">
                <div className="text-2xl font-black text-white tracking-tight">{stat.value}</div>
                <div className="text-xs uppercase tracking-widest mt-1" style={{ color: 'oklch(0.55 0.08 250)' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32"
          style={{ background: 'linear-gradient(to top, oklch(0.08 0.025 250), transparent)' }} />
      </div>

      {/* ── Form Panel ── */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <span className="display-heading text-4xl text-foreground">
              ARO<span className="text-primary">STATS</span>
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">Bienvenido de vuelta</h1>
            <p className="text-muted-foreground text-sm">Ingresá con las credenciales de tu torneo</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Usuario
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="torneo-2026"
                autoComplete="username"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Contraseña
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="h-11"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                <span className="text-xs">⚠</span> {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 font-semibold tracking-wide"
              disabled={loading || !username || !password}
            >
              {loading ? 'Verificando...' : 'Ingresar →'}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-border/40 text-center">
            <a
              href="/admin"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
            >
              Panel de administrador
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
