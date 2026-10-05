# Coach Roster Link + OCR Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two shortcuts that pre-fill the player list in the match config page — a public coach link where each team's coach submits their roster, and an OCR scanner that reads player names/numbers from a photographed paper roster using Claude Vision.

**Architecture:** Coach link creates a public Supabase-backed page at `/roster/[matchId]/[teamId]`; the operator copies the URL from the config page and shares it; after the coach submits, the operator clicks "Cargar plantel" to pull the data into the form. OCR sends a base64 image from the config page to a server-side API route that calls Claude Haiku with vision and returns a player array. Both features append/replace data in the existing `PlayerForm` state in `config/page.tsx` — neither bypasses the existing validation or form flow.

**Tech Stack:** Next.js 16.3.5 App Router, TypeScript, Supabase (anon key, RLS), Tailwind, `@anthropic-ai/sdk`, shadcn/base-ui components

**Spec:** `docs/superpowers/specs/2026-10-05-coach-roster-and-ocr-design.md`

## Global Constraints

- All user-visible Spanish copy must use the exact strings from the spec (e.g. "Enviar plantel", "Cargar plantel ↓", "Copiar link coach", "Escaneando...", "El coach aún no envió el plantel")
- Coach page (`/roster/[matchId]/[teamId]`) must work with no auth — no session check, no redirect
- OCR API route must be server-side only (`route.ts` in `app/api/`) to keep `ANTHROPIC_API_KEY` secret — never call Anthropic from client code
- Claude model for OCR: `claude-haiku-4-5-20251001` (exact string)
- OCR appends to existing player list; "Cargar plantel" replaces the player list
- No test framework is configured in this project — verification is TypeScript type check (`npx tsc --noEmit`) plus manual browser testing steps described per task

---

## Review Focus

- **Coach submits, operator loads, then coach re-submits:** The "Cargar plantel" button must fetch the latest upserted data; if called again after a re-submission it should reflect the newest version.
- **No submission yet when operator clicks "Cargar plantel":** Must show the "El coach aún no envió el plantel" message without crashing.
- **Image type from iOS camera is HEIC:** Claude vision doesn't accept HEIC. The API route must detect unsupported media types and return a 400 with a clear message before calling Claude.
- **Claude returns malformed JSON (extra text, markdown fences):** The API route must strip markdown code fences before parsing and return a 400 error if JSON is still unparseable — never let an unhandled exception surface as a 500.
- **Player number extracted as string by Claude:** The OCR response parser must coerce `numero` to `number` and skip entries where `numero` is NaN or `nombre` is empty.

---

## Task 1: Supabase Table + Types + Queries

**Files:**
- Modify: `types/index.ts`
- Modify: `lib/supabase/queries.ts`
- Manual step: Supabase dashboard SQL

**Interfaces:**
- Produces:
  - `CoachRosterPlayer` type (used by Tasks 2, 3)
  - `getCoachRosterSubmission(matchId: string, teamId: string): Promise<CoachRosterPlayer[] | null>`
  - `upsertCoachRoster(matchId: string, teamId: string, players: CoachRosterPlayer[]): Promise<void>`

---

- [ ] **Step 1: Create the Supabase table manually**

Go to your Supabase project → SQL Editor → run this:

```sql
CREATE TABLE IF NOT EXISTS coach_roster_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_match_id uuid REFERENCES tournament_matches(id) NOT NULL,
  team_id uuid REFERENCES tournament_teams(id) NOT NULL,
  players jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_match_id, team_id)
);

ALTER TABLE coach_roster_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_select" ON coach_roster_submissions
  FOR SELECT TO anon USING (true);

CREATE POLICY "public_insert" ON coach_roster_submissions
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "public_update" ON coach_roster_submissions
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
```

Verify: the table appears in the Table Editor with 5 columns.

---

- [ ] **Step 2: Add `CoachRosterPlayer` type to `types/index.ts`**

Add at the bottom of `types/index.ts`:

```typescript
export type CoachRosterPlayer = {
  nombre: string
  numero: number
  is_starter: boolean
  is_captain: boolean
}
```

---

- [ ] **Step 3: Add queries to `lib/supabase/queries.ts`**

Add these two functions at the bottom of `lib/supabase/queries.ts`:

```typescript
// ── Coach roster ──────────────────────────────────────────────────────────────

export async function getCoachRosterSubmission(
  matchId: string,
  teamId: string
): Promise<import('@/types').CoachRosterPlayer[] | null> {
  const supabase = await db()
  const { data } = await supabase
    .from('coach_roster_submissions')
    .select('players')
    .eq('tournament_match_id', matchId)
    .eq('team_id', teamId)
    .single()
  return data ? (data.players as import('@/types').CoachRosterPlayer[]) : null
}

export async function upsertCoachRoster(
  matchId: string,
  teamId: string,
  players: import('@/types').CoachRosterPlayer[]
): Promise<void> {
  const supabase = await db()
  const { error } = await supabase
    .from('coach_roster_submissions')
    .upsert(
      { tournament_match_id: matchId, team_id: teamId, players, updated_at: new Date().toISOString() },
      { onConflict: 'tournament_match_id,team_id' }
    )
  if (error) throw error
}
```

---

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

- [ ] **Step 5: Commit**

```bash
git add types/index.ts lib/supabase/queries.ts
git commit -m "feat: add CoachRosterPlayer type and coach_roster_submissions queries"
```

---

## Task 2: Public Coach Roster Page

**Files:**
- Create: `app/roster/[matchId]/[teamId]/page.tsx`

**Interfaces:**
- Consumes: `getCoachRosterSubmission`, `upsertCoachRoster`, `CoachRosterPlayer` from Task 1
- Consumes: `supabase` from `@/lib/supabase/client` (for team name lookup)

---

- [ ] **Step 1: Create the directory and file**

Create `app/roster/[matchId]/[teamId]/page.tsx` with this full content:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getCoachRosterSubmission, upsertCoachRoster } from '@/lib/supabase/queries'
import type { CoachRosterPlayer } from '@/types'

function emptyPlayer(): CoachRosterPlayer {
  return { nombre: '', numero: 0, is_starter: false, is_captain: false }
}

export default function CoachRosterPage() {
  const { matchId, teamId } = useParams<{ matchId: string; teamId: string }>()
  const [teamName, setTeamName] = useState<string>('')
  const [players, setPlayers] = useState<CoachRosterPlayer[]>([emptyPlayer()])
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { supabase } = await import('@/lib/supabase/client')
        const { data: team } = await supabase
          .from('tournament_teams')
          .select('nombre')
          .eq('id', teamId)
          .single()
        if (team) setTeamName(team.nombre)

        const existing = await getCoachRosterSubmission(matchId, teamId)
        if (existing && existing.length > 0) setPlayers(existing)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [matchId, teamId])

  function updatePlayer(index: number, patch: Partial<CoachRosterPlayer>) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  function addPlayer() {
    setPlayers((prev) => [...prev, emptyPlayer()])
  }

  function removePlayer(index: number) {
    setPlayers((prev) => prev.filter((_, i) => i !== index))
  }

  function toggleCaptain(index: number) {
    setPlayers((prev) =>
      prev.map((p, i) => ({ ...p, is_captain: i === index ? !p.is_captain : false }))
    )
  }

  async function handleSubmit() {
    const valid = players.filter((p) => p.nombre.trim() && p.numero > 0)
    if (valid.length === 0) return
    setSubmitting(true)
    try {
      await upsertCoachRoster(matchId, teamId, valid)
      setSubmitted(true)
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const startersCount = players.filter((p) => p.is_starter).length

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm uppercase tracking-widest">Cargando...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto">
      <header className="pt-6 mb-6 border-b border-border/40 pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">AroStats</p>
        <h1 className="text-2xl font-black tracking-tight">{teamName || 'Equipo'}</h1>
        <p className="text-sm text-muted-foreground mt-1">Ingresá los jugadores para este partido</p>
      </header>

      {submitted && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 mb-6 text-center">
          <p className="text-sm font-semibold text-primary">Plantel enviado ✓</p>
          <p className="text-xs text-muted-foreground mt-1">Podés actualizar y re-enviar en cualquier momento</p>
        </div>
      )}

      <div className="space-y-2 mb-4">
        {players.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              className="w-14 text-center font-mono"
              placeholder="#"
              value={p.numero === 0 ? '' : String(p.numero)}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, '').slice(0, 2))
                updatePlayer(i, { numero: isNaN(n) ? 0 : n })
              }}
              type="text"
              inputMode="numeric"
            />
            <Input
              className="flex-1 uppercase"
              placeholder="Nombre del jugador"
              value={p.nombre}
              onChange={(e) => updatePlayer(i, { nombre: e.target.value })}
            />
            <button
              onClick={() => updatePlayer(i, { is_starter: !p.is_starter })}
              disabled={!p.is_starter && startersCount >= 5}
              className={`w-8 h-8 rounded text-xs font-bold flex-shrink-0 transition-colors ${
                p.is_starter
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              } disabled:opacity-40`}
              title="Titular"
            >
              T
            </button>
            <button
              onClick={() => toggleCaptain(i)}
              disabled={!p.is_captain && players.some((x) => x.is_captain)}
              className={`w-8 h-8 rounded text-xs font-bold flex-shrink-0 transition-colors ${
                p.is_captain
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              } disabled:opacity-40`}
              title="Capitán"
            >
              C
            </button>
            <button
              onClick={() => removePlayer(i)}
              className="w-8 h-8 rounded text-xs text-destructive hover:bg-destructive/10 flex-shrink-0"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" className="w-full mb-6 text-xs uppercase tracking-wider font-semibold" onClick={addPlayer}>
        + Agregar Jugador
      </Button>

      <Button
        className="w-full h-11 font-bold uppercase tracking-wider"
        onClick={handleSubmit}
        disabled={submitting || players.filter((p) => p.nombre.trim() && p.numero > 0).length === 0}
      >
        {submitting ? 'Enviando...' : 'Enviar plantel'}
      </Button>
    </main>
  )
}
```

---

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

- [ ] **Step 3: Manual verification**

Start `npm run dev`. Navigate to `/roster/some-uuid/some-uuid` (with real IDs from your DB).
- Page loads without auth prompt
- Team name appears from DB
- Add a few players, click "Enviar plantel" → shows "Plantel enviado ✓"
- Reload the page → previously submitted players pre-fill the form
- Submit again with different data → data is updated (upsert works)

---

- [ ] **Step 4: Commit**

```bash
git add "app/roster/[matchId]/[teamId]/page.tsx"
git commit -m "feat: add public coach roster page at /roster/[matchId]/[teamId]"
```

---

## Task 3: Config Page — Coach Link Buttons

**Files:**
- Modify: `app/t/[tournamentId]/match/[matchId]/config/page.tsx`

**Interfaces:**
- Consumes: `getCoachRosterSubmission` from Task 1
- Consumes: existing `matchData.teamHome.id`, `matchData.teamAway.id`, `matchId` already in scope
- Consumes: existing `setPlayersHome`, `setPlayersAway`, `PlayerForm` already in scope

---

- [ ] **Step 1: Add imports and state to config page**

At the top of `config/page.tsx`, the import from queries already exists. Add `getCoachRosterSubmission` to that import:

```typescript
import {
  getTournamentMatches, saveMatchConfig, saveMatchPlayer, updateTournamentMatchStatus,
  getCoachRosterSubmission,
} from '@/lib/supabase/queries'
```

Add two state variables inside the component (after the existing state declarations):

```typescript
const [copiedSide, setCopiedSide] = useState<'home' | 'away' | null>(null)
const [loadingRoster, setLoadingRoster] = useState<'home' | 'away' | null>(null)
const [rosterMsg, setRosterMsg] = useState<{ side: 'home' | 'away'; text: string } | null>(null)
```

---

- [ ] **Step 2: Add handler functions**

Add these two functions inside the component, after `handleStart`:

```typescript
async function handleCopyLink(side: 'home' | 'away') {
  if (!matchData) return
  const teamId = side === 'home' ? matchData.teamHome.id : matchData.teamAway.id
  const url = `${window.location.origin}/roster/${matchId}/${teamId}`
  await navigator.clipboard.writeText(url)
  setCopiedSide(side)
  setTimeout(() => setCopiedSide(null), 2000)
}

async function handleLoadRoster(side: 'home' | 'away') {
  if (!matchData) return
  const teamId = side === 'home' ? matchData.teamHome.id : matchData.teamAway.id
  setLoadingRoster(side)
  setRosterMsg(null)
  try {
    const data = await getCoachRosterSubmission(matchId, teamId)
    if (!data || data.length === 0) {
      setRosterMsg({ side, text: 'El coach aún no envió el plantel' })
      return
    }
    const forms: PlayerForm[] = data.map((p) => ({
      nombre: p.nombre,
      numero: String(p.numero),
      is_starter: p.is_starter,
      is_captain: p.is_captain,
    }))
    if (side === 'home') setPlayersHome(forms)
    else setPlayersAway(forms)
    setRosterMsg({ side, text: `Plantel cargado — ${forms.length} jugadores` })
    setTimeout(() => setRosterMsg(null), 3000)
  } catch (e) {
    console.error(e)
    setRosterMsg({ side, text: 'Error al cargar el plantel' })
  } finally {
    setLoadingRoster(null)
  }
}
```

---

- [ ] **Step 3: Add the buttons to the team tab UI**

In the `(activeTab === 'home' || activeTab === 'away')` section, find the `<div className="space-y-4">` wrapper. Add this block **just below** the `<p className="text-xs text-muted-foreground uppercase...">` team name heading and before the starters/captain badges row:

```typescript
{/* Coach link row */}
<div className="flex gap-2">
  <Button
    variant="outline"
    size="sm"
    className="flex-1 text-xs uppercase tracking-wider font-semibold h-8"
    onClick={() => handleCopyLink(side)}
  >
    {copiedSide === side ? '¡Link copiado!' : 'Copiar link coach'}
  </Button>
  <Button
    variant="outline"
    size="sm"
    className="flex-1 text-xs uppercase tracking-wider font-semibold h-8"
    onClick={() => handleLoadRoster(side)}
    disabled={loadingRoster === side}
  >
    {loadingRoster === side ? 'Cargando...' : 'Cargar plantel ↓'}
  </Button>
</div>
{rosterMsg?.side === side && (
  <p className="text-xs text-muted-foreground text-center">{rosterMsg.text}</p>
)}
```

Specifically, find this block in the HOME/AWAY tab render:

```typescript
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                  {teamName}
                </p>
                <div className="flex items-center gap-2">
```

Insert the coach link row right after the closing `</div>` of that `flex items-center justify-between` block and before `<div className="flex gap-4 text-xs...">` (the T/C legend row).

---

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

- [ ] **Step 5: Manual verification**

In a real tournament match config:
- Switch to home team tab → click "Copiar link coach" → button shows "¡Link copiado!" for 2s → paste the URL and verify it is `https://.../roster/[matchId]/[homeTeamId]`
- Open that URL in another tab → submit a roster → return to config → click "Cargar plantel ↓" → player rows fill in
- Click again before any submission → message "El coach aún no envió el plantel" appears

---

- [ ] **Step 6: Commit**

```bash
git add "app/t/[tournamentId]/match/[matchId]/config/page.tsx"
git commit -m "feat: add copy coach link and load roster buttons to config page"
```

---

## Task 4: OCR API Route

**Files:**
- Create: `app/api/scan-roster/route.ts`
- Modify: `.env.local` (add `ANTHROPIC_API_KEY`)
- Modify: Vercel dashboard (add `ANTHROPIC_API_KEY` env var)

**Interfaces:**
- Produces: `POST /api/scan-roster` accepting `{ image: string }` (base64 data URL), returning `{ players: Array<{ nombre: string; numero: number }> }` or `{ error: string }` with status 400

---

- [ ] **Step 1: Install Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

Verify it appears in `package.json` under `dependencies`.

---

- [ ] **Step 2: Add env var**

Add to `.env.local` (create if it doesn't exist):

```
ANTHROPIC_API_KEY=sk-ant-...your-key-here...
```

Also add this key to Vercel: Project Settings → Environment Variables → `ANTHROPIC_API_KEY` → Production + Preview + Development.

---

- [ ] **Step 3: Create the API route**

Create `app/api/scan-roster/route.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type SupportedType = (typeof SUPPORTED_TYPES)[number]

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  try {
    const { image } = await req.json() as { image?: string }

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Se requiere una imagen en base64' }, { status: 400 })
    }

    const mediaMatch = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/)
    const mediaType = mediaMatch?.[1] as SupportedType | undefined

    if (!mediaType || !SUPPORTED_TYPES.includes(mediaType)) {
      return NextResponse.json(
        { error: 'Formato de imagen no soportado. Usá JPG, PNG o WebP.' },
        { status: 400 }
      )
    }

    const base64Data = image.slice(image.indexOf(',') + 1)

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            {
              type: 'text',
              text: 'You are a sports roster scanner. Extract all player entries from this roster image. Return ONLY a JSON array, no markdown, no explanation: [{"nombre": string, "numero": number}]. If a field is unclear, omit that player.',
            },
          ],
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'No se pudo leer la planilla. Intentá con una foto más clara.' }, { status: 400 })
    }

    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Respuesta inesperada del escáner.' }, { status: 400 })
    }

    const players = (parsed as Array<Record<string, unknown>>)
      .map((entry) => ({
        nombre: String(entry.nombre ?? '').trim(),
        numero: Number(entry.numero),
      }))
      .filter((p) => p.nombre && !isNaN(p.numero) && p.numero > 0)

    return NextResponse.json({ players })
  } catch (err) {
    console.error('[scan-roster]', err)
    return NextResponse.json({ error: 'Error al procesar la imagen.' }, { status: 400 })
  }
}
```

---

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

- [ ] **Step 5: Manual verification**

Start `npm run dev`. Use curl or a REST client:

```bash
# encode a small test image
node -e "
const fs = require('fs');
const img = fs.readFileSync('public/icon-192.png');
const b64 = 'data:image/png;base64,' + img.toString('base64');
const body = JSON.stringify({ image: b64 });
require('child_process').execSync('curl -s -X POST http://localhost:3000/api/scan-roster -H \"Content-Type: application/json\" -d ' + JSON.stringify(body), {stdio:'inherit'});
"
```

Expected: `{ "players": [] }` (an icon has no roster — 0 players is correct).

Then photograph a real paper roster with phone camera, convert to JPG, and test with that image. Verify extracted players match what's on the paper.

Also verify error cases:
- Send `{ "image": "data:image/heic;base64,abc" }` → expect 400 with "Formato de imagen no soportado"
- Send `{}` → expect 400 with "Se requiere una imagen en base64"

---

- [ ] **Step 6: Commit**

```bash
git add app/api/scan-roster/route.ts package.json package-lock.json
git commit -m "feat: add OCR scan-roster API route using Claude Haiku vision"
```

---

## Task 5: Config Page — Scan Button

**Files:**
- Modify: `app/t/[tournamentId]/match/[matchId]/config/page.tsx`

**Interfaces:**
- Consumes: `POST /api/scan-roster` from Task 4
- Consumes: existing `setPlayersHome`, `setPlayersAway`, `PlayerForm`, `side` variable already in scope in the tab render

---

- [ ] **Step 1: Add scan state to config page**

Add inside the component (after the existing state declarations from Task 3):

```typescript
const [scanning, setScanning] = useState<'home' | 'away' | null>(null)
const [scanError, setScanError] = useState<{ side: 'home' | 'away'; text: string } | null>(null)
const scanInputHomeRef = useRef<HTMLInputElement>(null)
const scanInputAwayRef = useRef<HTMLInputElement>(null)
```

Add `useRef` to the React import if not already there:
```typescript
import { useState, useEffect, useRef } from 'react'
```

---

- [ ] **Step 2: Add the scan handler**

Add inside the component after `handleLoadRoster`:

```typescript
async function handleScanImage(side: 'home' | 'away', file: File) {
  setScanning(side)
  setScanError(null)
  try {
    const reader = new FileReader()
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    const res = await fetch('/api/scan-roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
    })

    const json = await res.json() as { players?: Array<{ nombre: string; numero: number }>; error?: string }

    if (!res.ok || json.error) {
      setScanError({ side, text: json.error ?? 'Error al escanear' })
      return
    }

    const newPlayers: PlayerForm[] = (json.players ?? []).map((p) => ({
      nombre: p.nombre,
      numero: String(p.numero),
      is_starter: false,
      is_captain: false,
    }))

    if (side === 'home') {
      setPlayersHome((prev) => {
        const hasContent = prev.some((p) => p.nombre.trim() || p.numero)
        return hasContent ? [...prev, ...newPlayers] : newPlayers
      })
    } else {
      setPlayersAway((prev) => {
        const hasContent = prev.some((p) => p.nombre.trim() || p.numero)
        return hasContent ? [...prev, ...newPlayers] : newPlayers
      })
    }
  } catch (e) {
    console.error(e)
    setScanError({ side, text: 'Error al procesar la imagen' })
  } finally {
    setScanning(null)
  }
}
```

---

- [ ] **Step 3: Add hidden file inputs to the JSX**

Right before the closing `</main>` tag (or inside the return, just before the fixed bottom bar), add two hidden inputs:

```typescript
<input
  ref={scanInputHomeRef}
  type="file"
  accept="image/*"
  capture="environment"
  className="hidden"
  onChange={(e) => {
    const file = e.target.files?.[0]
    if (file) handleScanImage('home', file)
    e.target.value = ''
  }}
/>
<input
  ref={scanInputAwayRef}
  type="file"
  accept="image/*"
  capture="environment"
  className="hidden"
  onChange={(e) => {
    const file = e.target.files?.[0]
    if (file) handleScanImage('away', file)
    e.target.value = ''
  }}
/>
```

---

- [ ] **Step 4: Add scan button inside the team tab**

In the HOME/AWAY tab render, find the `<Button variant="outline" size="sm" className="w-full text-xs uppercase..." onClick={() => addPlayer(side)}>+ Agregar Jugador</Button>` button.

Replace it with:

```typescript
<div className="flex gap-2">
  <Button
    variant="outline"
    size="sm"
    className="flex-1 text-xs uppercase tracking-wider font-semibold"
    onClick={() => addPlayer(side)}
  >
    + Agregar Jugador
  </Button>
  <Button
    variant="outline"
    size="sm"
    className="flex-1 text-xs uppercase tracking-wider font-semibold"
    disabled={scanning === side}
    onClick={() => {
      setScanError(null)
      if (side === 'home') scanInputHomeRef.current?.click()
      else scanInputAwayRef.current?.click()
    }}
  >
    {scanning === side ? 'Escaneando...' : '📷 Escanear planilla'}
  </Button>
</div>
{scanError?.side === side && (
  <p className="text-xs text-destructive text-center">{scanError.text}</p>
)}
```

---

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

- [ ] **Step 6: Manual verification**

In the config page on a real match:
- Switch to home or away tab
- Click "📷 Escanear planilla" → device camera/file picker opens
- Take a photo of a paper roster with names and numbers
- Wait for "Escaneando..." to finish → players appear appended to the list
- If the form was empty, the list replaces the empty row; if it had existing rows, new ones are appended
- Test error: select a PDF or non-image → error message appears below the button

Also verify deploy works — push to `master`, confirm Vercel build succeeds with `ANTHROPIC_API_KEY` set.

---

- [ ] **Step 7: Commit and push**

```bash
git add "app/t/[tournamentId]/match/[matchId]/config/page.tsx"
git commit -m "feat: add OCR scan button to config page team tabs"
git push
```

---

## Post-implementation checklist

- [ ] Supabase table `coach_roster_submissions` created with correct RLS
- [ ] `ANTHROPIC_API_KEY` set in Vercel environment variables
- [ ] `/roster/[matchId]/[teamId]` accessible without login in production
- [ ] Coach page pre-fills on reload after a submission
- [ ] "Cargar plantel ↓" replaces the player form with coach's data
- [ ] OCR scan appends players (or fills if list was empty)
- [ ] TypeScript passes with no errors across all modified files
