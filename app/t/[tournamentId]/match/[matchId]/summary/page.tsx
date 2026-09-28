'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLiveMatchStore, useSessionStore } from '@/store/tournamentStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { SignatureRole } from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

// ── Signature canvas ──────────────────────────────────────────────────────────
function SignatureCanvas({
  onSign,
  signed,
}: {
  onSign: (svgPath: string) => void
  signed: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const paths = useRef<string[]>([])
  const currentPath = useRef<{ x: number; y: number }[]>([])

  function getPos(e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function startDraw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    drawing.current = true
    const pos = getPos(e, canvas)
    currentPath.current = [pos]
    const ctx = canvas.getContext('2d')!
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  function draw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const pos = getPos(e, canvas)
    currentPath.current.push(pos)
    const ctx = canvas.getContext('2d')!
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#F3F4F6'
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  function endDraw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault()
    if (!drawing.current) return
    drawing.current = false
    if (currentPath.current.length > 1) {
      const d = currentPath.current
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ')
      paths.current.push(d)
      const svgPaths = paths.current.join(' ')
      onSign(svgPaths)
    }
    currentPath.current = []
  }

  function clear() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    paths.current = []
    onSign('')
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={600}
        height={150}
        className={`w-full rounded-lg border-2 ${signed ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/20'} cursor-crosshair touch-none`}
        style={{ height: '100px' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      {!signed && (
        <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground pointer-events-none">
          Firmar aquí con el dedo
        </p>
      )}
      <button
        onClick={clear}
        className="absolute top-1 right-1 text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 bg-background/80 rounded"
      >
        Limpiar
      </button>
    </div>
  )
}

// ── Signature pad labels ──────────────────────────────────────────────────────
const ROLE_LABELS: Record<SignatureRole, string> = {
  arbitro_principal: 'Árbitro Principal',
  arbitro_auxiliar: 'Árbitro Auxiliar',
  coach_home: 'Coach Local',
  coach_away: 'Coach Visitante',
}
const ROLES: SignatureRole[] = ['arbitro_principal', 'arbitro_auxiliar', 'coach_home', 'coach_away']

type SigState = { name: string; svg: string }

// ── Player stats table ────────────────────────────────────────────────────────
function StatsTable({
  players,
  events,
  label,
  color,
}: {
  players: import('@/types').MatchPlayer[]
  events: ReturnType<typeof useLiveMatchStore.getState>['events']
  label: string
  color: string
}) {
  const active = events.filter((e) => !e.is_deleted)
  return (
    <div className="mb-4">
      <h3 className={`text-sm font-bold mb-2 ${color}`}>{label}</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border text-left">
            <th className="py-1 w-8">#</th>
            <th className="py-1">Jugador</th>
            <th className="py-1 text-center">Pts</th>
            <th className="py-1 text-center">2P</th>
            <th className="py-1 text-center">3P</th>
            <th className="py-1 text-center">TL</th>
            <th className="py-1 text-center">F</th>
          </tr>
        </thead>
        <tbody>
          {players
            .sort((a, b) => {
              const pa = active
                .filter((e) => e.player_id === a.id)
                .reduce((s, e) => s + e.calculated_points, 0)
              const pb = active
                .filter((e) => e.player_id === b.id)
                .reduce((s, e) => s + e.calculated_points, 0)
              return pb - pa
            })
            .map((p) => {
              const pe = active.filter((e) => e.player_id === p.id)
              const pts = pe.reduce((s, e) => s + e.calculated_points, 0)
              const c2 = pe.filter((e) => e.event_type === 'canasta_2').length
              const c3 = pe.filter((e) => e.event_type === 'canasta_3').length
              const tl = pe.filter((e) => e.event_type === 'tiro_libre').length
              const f = pe.filter(
                (e) =>
                  e.event_type === 'falta_personal' || e.event_type === 'falta_tecnica',
              ).length
              return (
                <tr key={p.id} className="border-b border-border/20">
                  <td className="py-1 font-mono font-bold">{p.numero}</td>
                  <td className="py-1 truncate max-w-[90px]">
                    {p.nombre}
                    {p.is_captain && <span className="text-amber-500 ml-1">C</span>}
                  </td>
                  <td
                    className={`py-1 text-center font-bold ${
                      pts > 0 ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {pts}
                  </td>
                  <td className="py-1 text-center">{c2 || '-'}</td>
                  <td className="py-1 text-center">{c3 || '-'}</td>
                  <td className="py-1 text-center">{tl || '-'}</td>
                  <td className={`py-1 text-center ${f >= 5 ? 'text-destructive' : ''}`}>
                    {f || '-'}
                  </td>
                </tr>
              )
            })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SummaryPage() {
  const { tournamentId, matchId } = useParams<{ tournamentId: string; matchId: string }>()
  const router = useRouter()
  const session = useSessionStore((s) => s.session)

  const {
    teamHome,
    teamAway,
    playersHome,
    playersAway,
    events,
    getHomeScore,
    getAwayScore,
    resetLiveMatch,
  } = useLiveMatchStore()

  const [section, setSection] = useState<'result' | 'signatures' | 'finalize'>('result')
  const [sigs, setSigs] = useState<Record<SignatureRole, SigState>>({
    arbitro_principal: { name: '', svg: '' },
    arbitro_auxiliar: { name: '', svg: '' },
    coach_home: { name: teamHome?.nombre ?? '', svg: '' },
    coach_away: { name: teamAway?.nombre ?? '', svg: '' },
  })
  const [finalizing, setFinalizing] = useState(false)

  useEffect(() => {
    if (!session || session.tournament_id !== tournamentId) {
      router.push('/login')
    }
  }, [])

  const homeScore = getHomeScore()
  const awayScore = getAwayScore()

  const allSigned = ROLES.every((r) => sigs[r].svg.length > 0 && sigs[r].name.trim().length > 0)

  async function handleFinalize() {
    setFinalizing(true)
    try {
      if (USE_MOCK) {
        const { mockSaveSignature, mockUpdateTournamentMatchStatus } = await import(
          '@/lib/supabase/mock-db'
        )
        for (const rol of ROLES) {
          await mockSaveSignature({
            tournament_match_id: matchId,
            rol,
            signer_name: sigs[rol].name,
            signature_svg: sigs[rol].svg,
          })
        }
        await mockUpdateTournamentMatchStatus(matchId, 'finalizado')
      }
      resetLiveMatch()
      router.push(`/t/${tournamentId}`)
    } catch (e) {
      console.error(e)
    } finally {
      setFinalizing(false)
    }
  }

  if (!teamHome || !teamAway) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">
          Sin datos de partido.{' '}
          <a href={`/t/${tournamentId}`} className="underline">
            Volver
          </a>
        </p>
      </div>
    )
  }

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto pb-10">
      <header className="pt-4 mb-6">
        <h1 className="text-xl font-bold">Cierre del Partido</h1>
        <p className="text-xs text-muted-foreground">
          {teamHome.nombre} vs {teamAway.nombre}
        </p>
      </header>

      {/* Section tabs */}
      <div className="flex rounded-lg overflow-hidden border border-border mb-6">
        {(['result', 'signatures', 'finalize'] as const).map((s, i) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              section === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {i + 1}. {s === 'result' ? 'Resultado' : s === 'signatures' ? 'Firmas' : 'Cerrar'}
          </button>
        ))}
      </div>

      {/* Result section */}
      {section === 'result' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-around py-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground">{teamHome.nombre}</p>
                  <p className="text-6xl font-black text-primary tabular-nums">{homeScore}</p>
                </div>
                <div className="text-2xl text-muted-foreground font-light">—</div>
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground">{teamAway.nombre}</p>
                  <p className="text-6xl font-black text-secondary tabular-nums">{awayScore}</p>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                {homeScore > awayScore
                  ? `Ganó ${teamHome.nombre}`
                  : awayScore > homeScore
                    ? `Ganó ${teamAway.nombre}`
                    : 'Empate'}
              </p>
            </CardContent>
          </Card>
          <StatsTable
            players={playersHome}
            events={events}
            label={teamHome.nombre}
            color="text-primary"
          />
          <StatsTable
            players={playersAway}
            events={events}
            label={teamAway.nombre}
            color="text-secondary"
          />
          <Button className="w-full" onClick={() => setSection('signatures')}>
            Continuar a Firmas →
          </Button>
        </div>
      )}

      {/* Signatures section */}
      {section === 'signatures' && (
        <div className="space-y-4">
          {ROLES.map((rol) => (
            <Card key={rol}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{ROLE_LABELS[rol]}</h3>
                  {sigs[rol].svg && sigs[rol].name.trim() && (
                    <Badge variant="default" className="text-xs">
                      ✓ Firmado
                    </Badge>
                  )}
                </div>
                <Input
                  placeholder="Nombre completo"
                  value={sigs[rol].name}
                  onChange={(e) =>
                    setSigs((s) => ({ ...s, [rol]: { ...s[rol], name: e.target.value } }))
                  }
                />
                <SignatureCanvas
                  signed={!!sigs[rol].svg}
                  onSign={(svg) =>
                    setSigs((s) => ({ ...s, [rol]: { ...s[rol], svg } }))
                  }
                />
              </CardContent>
            </Card>
          ))}
          <Button
            className="w-full"
            disabled={!allSigned}
            onClick={() => setSection('finalize')}
          >
            {allSigned
              ? 'Continuar →'
              : `Faltan firmas (${ROLES.filter((r) => !sigs[r].svg || !sigs[r].name.trim()).length} pendientes)`}
          </Button>
        </div>
      )}

      {/* Finalize section */}
      {section === 'finalize' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-2">
              <h3 className="font-semibold mb-3">Resumen de firmas</h3>
              {ROLES.map((rol) => (
                <div
                  key={rol}
                  className="flex items-center justify-between py-1 border-b border-border/30"
                >
                  <span className="text-sm text-muted-foreground">{ROLE_LABELS[rol]}</span>
                  <span className="text-sm font-medium">
                    {sigs[rol].name} ✓
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-center text-muted-foreground">
              Al finalizar, el partido quedará cerrado y no podrá modificarse.
            </p>
          </div>

          <Button
            variant="destructive"
            className="w-full"
            size="lg"
            disabled={finalizing}
            onClick={handleFinalize}
          >
            {finalizing ? 'Cerrando partido...' : '🏁 Cerrar Partido Definitivamente'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setSection('signatures')}>
            ← Volver a revisar firmas
          </Button>
        </div>
      )}
    </main>
  )
}
