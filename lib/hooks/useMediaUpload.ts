'use client'

import { useRef, useState } from 'react'
import { getAuthHeaders } from '@/lib/api/auth'
import { compressImage, compressVideo } from '@/lib/media/compress'

type PreviewKind = 'photo' | 'video' | null

export function useMediaUpload() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewKind, setPreviewKind] = useState<PreviewKind>(null)
  const [uploading, setUploading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [compressProgress, setCompressProgress] = useState(0)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const resetMedia = () => {
    setPreview(null)
    setPreviewKind(null)
    setUploading(false)
    setCompressing(false)
    setCompressProgress(0)
    setUploadedUrl(null)
    setUploadError(null)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isVideo = file.type.startsWith('video/')
    const kind: PreviewKind = isVideo ? 'video' : 'photo'
    setPreviewKind(kind)
    setUploadedUrl(null)
    setUploadError(null)
    setCompressProgress(0)

    // Show preview immediately from original file
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    try {
      let fileToUpload = file

      if (isVideo) {
        // Client-side size check before compressing
        if (file.size > 200 * 1024 * 1024) {
          setUploadError('El video es demasiado grande (máx. 200 MB). Recórtalo antes de subir.')
          return
        }
        setCompressing(true)
        fileToUpload = await compressVideo(file, ratio => {
          setCompressProgress(Math.round(ratio * 100))
        })
        setCompressing(false)
        setCompressProgress(0)
      } else {
        // Compress image before uploading
        fileToUpload = await compressImage(file)
      }

      setUploading(true)
      const form = new FormData()
      form.append('file', fileToUpload)
      const authHeaders = await getAuthHeaders()
      const res = await fetch('/api/upload', { method: 'POST', body: form, headers: authHeaders })

      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; url?: string }
        if (data.ok && data.url) setUploadedUrl(data.url)
        setUploadError(null)
      } else {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string }
        const errCode = String(errJson.error || '')
        if (res.status === 401 || errCode === 'unauthorized') {
          setUploadError('Debes iniciar sesión para adjuntar fotos o videos.')
        } else if (res.status === 413 || errCode === 'file_too_large') {
          setUploadError('Archivo demasiado grande. Intenta con uno más liviano.')
        } else if (res.status === 415 || errCode === 'unsupported_file_type') {
          setUploadError('Tipo de archivo no soportado. Usa JPG/PNG/WEBP o MP4/WEBM/MOV.')
        } else if (res.status === 429 || errCode === 'rate_limited') {
          setUploadError('Subiste demasiados archivos en poco tiempo. Espera unos segundos y reintenta.')
        } else {
          setUploadError('No se pudo subir el archivo. Reintenta para publicarlo con foto/video.')
        }
      }
    } catch {
      setUploadError('Falló la subida del archivo. Reintenta para publicarlo con foto/video.')
      setCompressing(false)
    } finally {
      setUploading(false)
    }
  }

  return {
    fileRef,
    preview,
    previewKind,
    uploading,
    compressing,
    compressProgress,
    uploadedUrl,
    uploadError,
    setPreview,
    setPreviewKind,
    setUploadedUrl,
    setUploadError,
    handleFileChange,
    resetMedia,
  }
}
