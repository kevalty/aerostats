import { NextResponse } from 'next/server'

const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type SupportedType = (typeof SUPPORTED_TYPES)[number]

export async function POST(req: Request) {
  try {
    const body = await req.json() as { image?: string }

    if (!body.image || typeof body.image !== 'string') {
      return NextResponse.json({ error: 'Se requiere una imagen en base64' }, { status: 400 })
    }

    const mediaMatch = body.image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/)
    const mediaType = mediaMatch?.[1] as SupportedType | undefined

    if (!mediaType || !(SUPPORTED_TYPES as readonly string[]).includes(mediaType)) {
      return NextResponse.json(
        { error: 'Formato de imagen no soportado. Usá JPG, PNG o WebP.' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Servicio de escaneo no configurado.' }, { status: 500 })
    }

    const base64Data = body.image.slice(body.image.indexOf(',') + 1)

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mediaType, data: base64Data } },
              { text: 'You are a sports roster scanner. Extract all player entries from this roster image. Return ONLY a JSON array, no markdown, no explanation: [{"nombre": string, "numero": number}]. If a field is unclear, omit that player.' },
            ],
          }],
          generationConfig: { temperature: 0 },
        }),
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error('[scan-roster] Google AI error:', response.status, errText)
      return NextResponse.json({ error: `Error del escáner: ${response.status} — ${errText.slice(0, 200)}` }, { status: 400 })
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: 'No se pudo leer la planilla. Intentá con una foto más clara.' },
        { status: 400 }
      )
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
