import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { consumeRateLimit, getClientIp } from '@/lib/server/rate-limit'

const SYSTEM_PROMPT = `Eres nutricionista chileno y analista gastronómico.
Reconoce platos típicos de Chile (chorrillana, completo, paila marina, pastel de choclo, cazuela, empanadas, etc.).
Si la imagen NO es claramente comida o menú, responde EXACTAMENTE:
{"error":"not_food_detected"}
Tu salida DEBE ser JSON válido, sin markdown ni texto extra, con esta forma exacta:
{
  "nombre_estimado": "string",
  "calorias_aprox": number,
  "proteinas_g": number,
  "carbohidratos_g": number,
  "grasas_g": number,
  "comentario": "string corto, tono cercano chileno",
  "es_apto_vegetariano": boolean,
  "es_apto_vegano": boolean,
  "es_sin_gluten": boolean,
  "es_sin_lactosa": boolean,
  "score_viral": number,
  "confidence": number,
  "etiquetas_detectadas": string[]
}
Evalúa especialmente: Sin Lactosa, Vegano y Sin Gluten.
Si no estás seguro, estima de forma conservadora.
IMPORTANTE: esto es solo un borrador/sugerencia, no una reseña final publicada.`

function extractJson(raw: string) {
  const text = raw.trim()
  if (text.startsWith('{') && text.endsWith('}')) return text
  const s = text.indexOf('{')
  const e = text.lastIndexOf('}')
  if (s >= 0 && e > s) return text.slice(s, e + 1)
  return '{}'
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`scanner:${ip}`, 5, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  try {
    const { imagen_base64, media_type } = await req.json()
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Falta GEMINI_API_KEY en entorno' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT,
    })

    const result = await model.generateContent([
      {
        inlineData: {
          data: imagen_base64,
          mimeType: media_type || 'image/jpeg',
        },
      },
      'Analiza el plato y responde solo JSON.',
    ])

    const text = result.response.text()
    const data = JSON.parse(extractJson(text))
    if (data?.error === 'not_food_detected') {
      return NextResponse.json({ error: 'not_food_detected' }, { status: 422 })
    }
    return NextResponse.json({
      ...data,
      source: 'AI_GENERATED',
      draft_only: true,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
