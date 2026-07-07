'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { proxyVideoUrl, videoMimeFromUrl } from '@/lib/utils'

export type CarouselMedia = { url: string; kind: 'photo' | 'video' }

type Props = {
  media: CarouselMedia[]
  /** Slot opcional sobre la media (badge de local, etc.) */
  overlay?: React.ReactNode
  rounded?: boolean
}

function Slide({ item }: { item: CarouselMedia }) {
  const url = item.url.trim()
  if (item.kind === 'video') {
    return (
      <div className="relative aspect-video w-full shrink-0 snap-center bg-black">
        <video className="h-full w-full object-cover" controls playsInline preload="metadata">
          <source src={proxyVideoUrl(url) ?? undefined} type={videoMimeFromUrl(url)} />
          <source src={url} type={videoMimeFromUrl(url)} />
          <p className="flex items-center justify-center p-4 text-center text-xs text-white/70">
            Tu navegador no puede reproducir este video.
          </p>
        </video>
      </div>
    )
  }
  if (url.startsWith('data:')) {
    return (
      <div className="relative aspect-square w-full shrink-0 snap-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full object-cover" />
      </div>
    )
  }
  return (
    <div className="relative aspect-square w-full shrink-0 snap-center">
      <Image src={url} alt="" fill className="object-cover" sizes="100vw" />
    </div>
  )
}

/** Carrusel de media con scroll-snap horizontal + puntos. Una sola pieza = sin chrome. */
export function MediaCarousel({ media, overlay, rounded }: Props) {
  const [active, setActive] = useState(0)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const items = media.filter(m => m.url && m.url.trim())
  if (items.length === 0) return null

  if (items.length === 1) {
    return (
      <div className={`relative overflow-hidden bg-muted ${rounded ? 'rounded-2xl border' : ''}`}>
        <Slide item={items[0]} />
        {overlay}
      </div>
    )
  }

  const scrollTo = (i: number) => {
    const el = scrollerRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(items.length - 1, i))
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className={`relative overflow-hidden bg-muted ${rounded ? 'rounded-2xl border' : ''}`}>
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none"
        onScroll={e => {
          const el = e.currentTarget
          setActive(Math.round(el.scrollLeft / el.clientWidth))
        }}
      >
        {items.map((item, i) => (
          <Slide key={`${item.url}-${i}`} item={item} />
        ))}
      </div>

      {/* Flechas de navegación (no dependen del swipe) */}
      {active > 0 && (
        <button
          type="button"
          aria-label="Anterior"
          onClick={e => { e.stopPropagation(); scrollTo(active - 1) }}
          className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm active:bg-black/70"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {active < items.length - 1 && (
        <button
          type="button"
          aria-label="Siguiente"
          onClick={e => { e.stopPropagation(); scrollTo(active + 1) }}
          className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm active:bg-black/70"
        >
          <ChevronRight className="size-5" />
        </button>
      )}

      {/* Contador */}
      <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
        {active + 1}/{items.length}
      </div>

      {/* Puntos (con fondo para que no se pierdan sobre la imagen) */}
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/35 px-2 py-1 backdrop-blur-sm">
        {items.map((_, i) => (
          <span
            key={i}
            className={`size-1.5 rounded-full transition-colors ${i === active ? 'bg-white' : 'bg-white/50'}`}
          />
        ))}
      </div>

      {overlay}
    </div>
  )
}
