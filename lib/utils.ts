import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Envuelve una URL de video de Supabase Storage en el proxy local.
 * Esto evita que Firefox bloquee la cookie __cf_bm de Cloudflare al
 * cargar el video directamente desde supabase.co.
 * Los data: URIs y URLs vacías se devuelven sin modificar.
 */
export function proxyVideoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const s = String(url).trim()
  if (!s || s.startsWith('data:') || s.startsWith('blob:')) return s
  // Solo proxear URLs de Supabase Storage
  if (s.includes('.supabase.co/storage/')) {
    return `/api/media-proxy?url=${encodeURIComponent(s)}`
  }
  return s
}

export function videoMimeFromUrl(url: string | null | undefined): string {
  if (!url) return 'video/mp4'
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/mp4',
    m4v: 'video/mp4',
    ogv: 'video/ogg',
  }
  return map[ext] ?? 'video/mp4'
}
