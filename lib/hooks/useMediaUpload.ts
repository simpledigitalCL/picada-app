'use client'

import { useRef, useState } from 'react'
import { getAuthHeaders } from '@/lib/api/auth'
import { compressImage, compressVideo } from '@/lib/media/compress'

export type MediaUploadItem = {
  id: string
  preview: string
  url: string | null
  kind: 'photo' | 'video'
  uploading: boolean
  error: string | null
}

export const MAX_PHOTOS = 3

// Subidas transitorias (red caída / 5xx / 429) se reintentan una vez de forma
// automática antes de marcar el item como fallido.
const MAX_UPLOAD_ATTEMPTS = 2

function mapUploadError(status: number, code: string): string {
  if (status === 401 || code === 'unauthorized') return 'Debes iniciar sesión para adjuntar fotos o videos.'
  if (status === 413 || code === 'file_too_large') return 'Archivo demasiado grande. Intenta con uno más liviano.'
  if (status === 415 || code === 'unsupported_file_type') return 'Tipo de archivo no soportado. Usa JPG/PNG/WEBP o MP4/WEBM/MOV.'
  if (status === 429 || code === 'rate_limited') return 'Subiste demasiados archivos en poco tiempo. Espera unos segundos y reintenta.'
  return 'No se pudo subir el archivo. Reintenta.'
}

export function useMediaUpload() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<MediaUploadItem[]>([])
  const [compressing, setCompressing] = useState(false)
  const [compressProgress, setCompressProgress] = useState(0)
  const [limitError, setLimitError] = useState<string | null>(null)

  const itemsRef = useRef<MediaUploadItem[]>([])
  // Guardamos el File original por id para poder reintentar una subida fallida.
  const filesRef = useRef<Map<string, File>>(new Map())
  const idSeq = useRef(0)
  const newId = () => `m${Date.now()}-${idSeq.current++}`

  const update = (fn: (prev: MediaUploadItem[]) => MediaUploadItem[]) => {
    setItems(prev => {
      const next = fn(prev)
      itemsRef.current = next
      return next
    })
  }

  const patch = (id: string, partial: Partial<MediaUploadItem>) =>
    update(prev => prev.map(it => (it.id === id ? { ...it, ...partial } : it)))

  const resetMedia = () => {
    itemsRef.current = []
    filesRef.current.clear()
    setItems([])
    setCompressing(false)
    setCompressProgress(0)
    setLimitError(null)
  }

  const uploadItem = async (id: string, file: File, kind: 'photo' | 'video') => {
    filesRef.current.set(id, file)
    patch(id, { uploading: true, error: null })
    try {
      let fileToUpload = file
      if (kind === 'video') {
        if (file.size > 200 * 1024 * 1024) {
          patch(id, { uploading: false, error: 'El video es demasiado grande (máx. 200 MB).' })
          return
        }
        setCompressing(true)
        fileToUpload = await compressVideo(file, ratio => setCompressProgress(Math.round(ratio * 100)))
        setCompressing(false)
        setCompressProgress(0)
      } else {
        fileToUpload = await compressImage(file)
      }

      const authHeaders = await getAuthHeaders()

      // Reintenta subidas transitorias (red caída o 5xx/429). La compresión se
      // hace una sola vez arriba; solo se re-emite el POST.
      for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
        try {
          const form = new FormData()
          form.append('file', fileToUpload)
          const res = await fetch('/api/upload', { method: 'POST', body: form, headers: authHeaders })

          if (res.ok) {
            const data = (await res.json()) as { ok: boolean; url?: string }
            if (data.ok && data.url) { patch(id, { url: data.url, uploading: false, error: null }); return }
            if (attempt < MAX_UPLOAD_ATTEMPTS) continue
            patch(id, { uploading: false, error: 'No se pudo subir el archivo. Reintenta.' })
            return
          }

          // 5xx/429 son transitorios → reintenta; los 4xx de cliente (401/413/415) no.
          if ((res.status >= 500 || res.status === 429) && attempt < MAX_UPLOAD_ATTEMPTS) continue
          const errJson = (await res.json().catch(() => ({}))) as { error?: string }
          patch(id, { uploading: false, error: mapUploadError(res.status, String(errJson.error || '')) })
          return
        } catch (err) {
          // Error de red → reintenta si quedan intentos, si no propaga al catch externo.
          if (attempt < MAX_UPLOAD_ATTEMPTS) continue
          throw err
        }
      }
    } catch {
      setCompressing(false)
      patch(id, { uploading: false, error: 'Falló la subida del archivo. Reintenta.' })
    }
  }

  /** Reintenta la subida de un item que quedó en error (mismo File original). */
  const retryItem = (id: string) => {
    const file = filesRef.current.get(id)
    const item = itemsRef.current.find(i => i.id === id)
    if (!file || !item) return
    void uploadItem(id, file, item.kind)
  }

  /** Agrega archivos respetando la regla: hasta 3 fotos O 1 video (sin mezclar). */
  const addFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (files.length === 0) return
    setLimitError(null)

    const videos = files.filter(f => f.type.startsWith('video/'))

    // Elegir un video → reemplaza todo (1 video, sin fotos).
    if (videos.length > 0) {
      const file = videos[0]
      const id = newId()
      const item: MediaUploadItem = {
        id, preview: URL.createObjectURL(file), url: null, kind: 'video', uploading: true, error: null,
      }
      update(() => [item])
      void uploadItem(id, file, 'video')
      return
    }

    // Fotos: si había un video, se descarta para empezar la galería de fotos.
    const current = itemsRef.current.some(i => i.kind === 'video') ? [] : itemsRef.current
    const slots = MAX_PHOTOS - current.length
    if (slots <= 0) {
      setLimitError(`Máximo ${MAX_PHOTOS} fotos por publicación.`)
      return
    }

    const accepted = files.slice(0, slots)
    if (files.length > slots) setLimitError(`Máximo ${MAX_PHOTOS} fotos: se agregaron ${slots}.`)

    const newItems: MediaUploadItem[] = accepted.map(file => ({
      id: newId(), preview: URL.createObjectURL(file), url: null, kind: 'photo', uploading: true, error: null,
    }))
    update(() => [...current, ...newItems])
    newItems.forEach((it, i) => void uploadItem(it.id, accepted[i], 'photo'))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) addFiles(e.target.files)
    // Permitir re-seleccionar el mismo archivo después de quitarlo.
    e.target.value = ''
  }

  const removeItem = (id: string) => {
    setLimitError(null)
    filesRef.current.delete(id)
    update(prev => prev.filter(it => it.id !== id))
  }

  /** Siembra la galería con media ya subida (para el modo edición de un post). */
  const seedMedia = (media: Array<{ url: string; kind: 'photo' | 'video' }>) => {
    filesRef.current.clear()
    const seeded = media
      .filter(m => m.url && m.url.trim())
      .slice(0, 3)
      .map(m => ({
        id: newId(),
        preview: m.url,
        url: m.url,
        kind: m.kind === 'video' ? ('video' as const) : ('photo' as const),
        uploading: false,
        error: null,
      }))
    update(() => seeded)
  }

  // ── Accesores de retrocompatibilidad (single) para new-picada y restauración de borrador ──
  const setPreview = (v: string | null) => {
    if (v == null) { resetMedia(); return }
    update(() => [{
      id: newId(), preview: v, url: /^https?:\/\//i.test(v) ? v : null, kind: 'photo', uploading: false, error: null,
    }])
  }
  const setUploadedUrl = (v: string | null) => {
    if (v == null) { resetMedia(); return }
    update(prev => (prev.length > 0
      ? [{ ...prev[0], url: v }, ...prev.slice(1)]
      : [{ id: newId(), preview: v, url: v, kind: 'photo', uploading: false, error: null }]))
  }

  const hasVideo = items.some(i => i.kind === 'video')
  const photoCount = items.filter(i => i.kind === 'photo').length
  const canAddMore = !hasVideo && photoCount < MAX_PHOTOS
  const hasErrors = items.some(i => i.error != null)

  return {
    fileRef,
    items,
    addFiles,
    handleFileChange,
    removeItem,
    retryItem,
    resetMedia,
    seedMedia,
    hasVideo,
    canAddMore,
    hasErrors,
    compressing,
    compressProgress,
    // Compat single-accessors
    preview: items[0]?.preview ?? null,
    previewKind: items[0]?.kind ?? null,
    uploadedUrl: items[0]?.url ?? null,
    uploading: items.some(i => i.uploading),
    uploadError: limitError ?? items.find(i => i.error)?.error ?? null,
    setPreview,
    setUploadedUrl,
  }
}
