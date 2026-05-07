'use client'

// ─── Image compression (Canvas API) ──────────────────────────────────────────

const IMAGE_MAX_DIMENSION = 1920
const IMAGE_QUALITY = 0.82

export async function compressImage(file: File): Promise<File> {
  return new Promise(resolve => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const { width, height } = img
      let targetW = width
      let targetH = height

      if (width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION) {
        if (width >= height) {
          targetW = IMAGE_MAX_DIMENSION
          targetH = Math.round((height / width) * IMAGE_MAX_DIMENSION)
        } else {
          targetH = IMAGE_MAX_DIMENSION
          targetW = Math.round((width / height) * IMAGE_MAX_DIMENSION)
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0, targetW, targetH)

      canvas.toBlob(
        blob => {
          if (!blob) { resolve(file); return }
          const outName = file.name.replace(/\.[^.]+$/, '.jpg')
          resolve(new File([blob], outName, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        IMAGE_QUALITY,
      )
    }

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file) }
    img.src = objectUrl
  })
}

// ─── Video compression (ffmpeg.wasm single-threaded) ─────────────────────────

type ProgressCallback = (ratio: number) => void

let ffmpegInstance: import('@ffmpeg/ffmpeg').FFmpeg | null = null
let ffmpegLoading: Promise<import('@ffmpeg/ffmpeg').FFmpeg> | null = null

async function getFFmpeg(onProgress?: ProgressCallback): Promise<import('@ffmpeg/ffmpeg').FFmpeg> {
  if (ffmpegInstance) {
    if (onProgress) ffmpegInstance.on('progress', ({ progress }) => onProgress(progress))
    return ffmpegInstance
  }

  if (ffmpegLoading) return ffmpegLoading

  ffmpegLoading = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const ff = new FFmpeg()
    if (onProgress) ff.on('progress', ({ progress }) => onProgress(progress))
    await ff.load({
      coreURL: '/ffmpeg/ffmpeg-core.js',
      wasmURL: '/ffmpeg/ffmpeg-core.wasm',
    })
    ffmpegInstance = ff
    ffmpegLoading = null
    return ff
  })()

  return ffmpegLoading
}

export async function compressVideo(
  file: File,
  onProgress?: ProgressCallback,
): Promise<File> {
  try {
    const { fetchFile } = await import('@ffmpeg/util')
    const ff = await getFFmpeg(onProgress)

    const inputName = 'input.' + (file.name.split('.').pop() || 'mp4')
    const outputName = 'output.mp4'

    await ff.writeFile(inputName, await fetchFile(file))

    // Scale to max 720p, H.264 CRF 28, ultrafast preset
    await ff.exec([
      '-i', inputName,
      '-vf', 'scale=-2:min(720\\,ih)',
      '-c:v', 'libx264',
      '-crf', '28',
      '-preset', 'ultrafast',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-movflags', '+faststart',
      outputName,
    ])

    const data = await ff.readFile(outputName)
    await ff.deleteFile(inputName)
    await ff.deleteFile(outputName)

    // FileData may be Uint8Array (possibly with SharedArrayBuffer) — copy to plain ArrayBuffer
    const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data as unknown as ArrayBuffer)
    const plain = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength) as ArrayBuffer
    const blob = new Blob([plain], { type: 'video/mp4' })
    const outName = file.name.replace(/\.[^.]+$/, '.mp4')
    return new File([blob], outName, { type: 'video/mp4' })
  } catch {
    // If compression fails, return original file
    return file
  }
}
