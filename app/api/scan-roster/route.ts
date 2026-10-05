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

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Servicio de escaneo no configurado.' }, { status: 500 })
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: body.image },
              },
              {
                type: 'text',
                text: 'You are a sports roster scanner. Extract all player entries from this roster image. Return ONLY a JSON array, no markdown, no explanation: [{"nombre": string, "numero": number}]. If a field is unclear, omit that player.',
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[scan-roster] OpenRouter error:', errText)
      return NextResponse.json({ error: 'Error al escanear la imagen.' }, { status: 400 })
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
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
