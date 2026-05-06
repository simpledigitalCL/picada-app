'use client'

export type ShareInput = {
  picadaId: string
  name: string
  address?: string
  imageUrl?: string
  votes?: number
}

export type ShareData = {
  title: string
  text: string
  url?: string
}

export function generateShareData(input: ShareInput): ShareData {
  const votesText = typeof input.votes === 'number' ? ` · 🔥 ${input.votes} votos` : ''
  const text = `${input.name}${input.address ? ` — ${input.address}` : ''}${votesText}`
  return {
    title: `Picada.App · ${input.name}`,
    text,
    url: input.imageUrl,
  }
}

export async function sharePicada(input: ShareInput) {
  const data = generateShareData(input)
  if (typeof navigator !== 'undefined' && navigator.share) {
    await navigator.share(data)
    return
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(`${data.title}\n${data.text}${data.url ? `\n${data.url}` : ''}`)
  }
}

