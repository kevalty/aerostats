# Coach Roster Link + OCR Scanner — Design Spec

**Date:** 2026-10-05  
**Project:** AroStats basketball PWA  
**Status:** Approved

---

## Context

When configuring a match, the operator (mesa) currently enters all player data manually for both teams. This spec adds two parallel shortcuts that pre-fill the player list:

1. **Coach link** — a public URL the operator shares with each team's coach. The coach fills in player names, numbers, starters, and captain on their own device. The operator then pulls that data into the config form with one button.
2. **OCR scanner** — the operator photographs a paper roster. The system uses Claude Vision to extract player names and numbers and fills the form automatically.

Both features feed the same `PlayerForm` state in `config/page.tsx`; neither replaces manual editing.

---

## Subsystem A — Coach Roster Link

### Data model

New Supabase table: **`coach_roster_submissions`**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | default gen_random_uuid() |
| `tournament_match_id` | uuid FK → tournament_matches | |
| `team_id` | uuid FK → tournament_teams | identifies home or away |
| `players` | jsonb | `[{nombre, numero, is_starter, is_captain}]` |
| `updated_at` | timestamptz | default now(), updated on upsert |

Unique constraint: `(tournament_match_id, team_id)` — one submission per team per match, upserted on re-submit.

RLS: insert/update allowed without auth (public coach access); select allowed without auth (config page reads it).

### Public coach page

Route: `app/roster/[matchId]/[teamId]/page.tsx`

- Loads team name from `tournament_teams` by `teamId`
- Loads any existing submission for this match+team and pre-fills the form
- Form: add/remove player rows (nombre, número, T toggle, C toggle) — same UX as config page but simpler (no starters-count gating, no color picker)
- "Enviar plantel" button → upserts to `coach_roster_submissions`
- After submit: shows "Plantel enviado ✓ Podés actualizar y re-enviar en cualquier momento"
- No auth required; page is fully public

### Config page changes

In each team tab (home/away):

- **"Copiar link coach"** button → writes `/roster/[matchId]/[teamId]` to clipboard and shows "¡Link copiado!"
- **"Cargar plantel ↓"** button → fetches the latest submission for this match+team; if found, replaces the current player list in the form; if not found, shows "El coach aún no envió el plantel"

The operator still sets starters and captain manually after loading (or the coach can set them too — the data carries those flags).

### New queries (`lib/supabase/queries.ts`)

```typescript
getCoachRosterSubmission(matchId, teamId): Promise<CoachRosterPlayer[] | null>
upsertCoachRoster(matchId, teamId, players): Promise<void>
```

---

## Subsystem B — OCR Scanner

### API route

`app/api/scan-roster/route.ts` — POST, server-side only (keeps Anthropic key secret)

Request body: `{ image: string }` (base64 data URL)

Flow:
1. Strip the `data:image/*;base64,` prefix
2. Call `claude-haiku-4-5-20251001` with the image and this system prompt:
   > "You are a sports roster scanner. Extract all player entries from this roster image. Return ONLY a JSON array, no markdown: `[{\"nombre\": string, \"numero\": number}]`. If a field is unclear, omit that player."
3. Parse the JSON response; return `{ players: [{nombre, numero}] }` or `{ error: string }`

Error cases: non-image file, Claude API error, unparseable response → return 400 with descriptive message.

### Config page changes

In each team tab (home/away), below the player list:

- **"📷 Escanear planilla"** button → triggers a hidden `<input type="file" accept="image/*" capture="environment">` 
- On file selection: shows a loading state "Escaneando..."
- Sends the image to `/api/scan-roster`
- On success: appends extracted players to the current list (doesn't replace, appends — operator may have already added some manually)
- Player rows land with nombre and número filled; is_starter and is_captain default to false
- On error: shows inline error message

### Dependencies

- `@anthropic-ai/sdk` — already in the project or added
- `ANTHROPIC_API_KEY` env var in `.env.local` and Vercel

---

## Files to create / modify

| File | Action |
|---|---|
| `app/roster/[matchId]/[teamId]/page.tsx` | Create |
| `app/api/scan-roster/route.ts` | Create |
| `lib/supabase/queries.ts` | Add `getCoachRosterSubmission`, `upsertCoachRoster` |
| `types/index.ts` | Add `CoachRosterPlayer` type |
| `app/t/[tournamentId]/match/[matchId]/config/page.tsx` | Add "Copiar link", "Cargar plantel", "Escanear" buttons |
| Supabase dashboard | Create `coach_roster_submissions` table + RLS |

---

## Out of scope

- Email/WhatsApp sending of the coach link (operator copies and shares manually)
- PDF parsing (image-only for OCR)
- Real-time sync while coach is typing (submit-then-pull model)
- Roster reuse across multiple matches (per match+team submission only)
