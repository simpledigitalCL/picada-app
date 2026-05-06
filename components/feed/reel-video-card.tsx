'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Heart, Loader2, Bookmark, Share2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ReelItem } from '@/lib/feed/types'

const IFRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen'
const SLIDE_H = 'h-[calc(100dvh-3.5rem)] min-h-[calc(100dvh-3.5rem)]'

type Props = {
  item: ReelItem
  scrollRoot: React.RefObject<HTMLDivElement | null>
  className?: string
  liked?: boolean
  favorite?: boolean
  onToggleLike?: (item: ReelItem) => void
  onToggleFavorite?: (item: ReelItem) => void
}

const platformClass: Record<ReelItem['platform'], string> = {
  youtube: 'bg-red-600/90 text-white border-0',
  tiktok: 'bg-stone-900 text-white border-0',
  instagram: 'bg-gradient-to-r from-purple-600 to-amber-500 text-white border-0',
}

const platformLabel: Record<ReelItem['platform'], string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
}

function buildPlayableEmbedUrl(item: ReelItem, active: boolean, soundEnabled: boolean): string {
  if (!active) return item.embedUrl
  try {
    const u = new URL(item.embedUrl)
    if (item.platform === 'youtube') {
      const id = u.pathname.split('/').filter(Boolean).pop() || ''
      u.searchParams.set('autoplay', '1')
      u.searchParams.set('mute', soundEnabled ? '0' : '1')
      u.searchParams.set('controls', '1')
      u.searchParams.set('playsinline', '1')
      u.searchParams.set('loop', '1')
      u.searchParams.set('start', '0')
      u.searchParams.set('rel', '0')
      u.searchParams.set('modestbranding', '1')
      u.searchParams.set('enablejsapi', '1')
      if (id) u.searchParams.set('playlist', id)
      return u.toString()
    }
    if (item.platform === 'tiktok') {
      u.searchParams.set('autoplay', '1')
      u.searchParams.set('mute', soundEnabled ? '0' : '1')
      return u.toString()
    }
    if (item.platform === 'instagram') {
      u.searchParams.set('autoplay', '1')
      return u.toString()
    }
    return u.toString()
  } catch {
    return item.embedUrl
  }
}

export function ReelVideoCard({
  item,
  scrollRoot,
  className,
  liked = false,
  favorite = false,
  onToggleLike,
  onToggleFavorite,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)

  const onIO = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const e = entries[0]
      if (!e) return
      setInView(
        e.isIntersecting && e.intersectionRatio >= 0.42,
      )
    },
    [],
  )

  useEffect(() => {
    const el = wrapRef.current
    const root = scrollRoot.current
    if (!el) return
    const io = new IntersectionObserver(onIO, {
      root: root ?? undefined,
      rootMargin: '0px',
      threshold: [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1],
    })
    io.observe(el)
    return () => io.disconnect()
  }, [onIO, scrollRoot])

  const shouldLoad = inView
  const playableUrl = buildPlayableEmbedUrl(item, shouldLoad, soundEnabled)

  return (
    <div
      ref={wrapRef}
      className={cn(
        'relative w-full max-w-md mx-auto snap-start flex flex-col',
        SLIDE_H,
        className,
      )}
    >
      <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl bg-black ring-1 ring-border/30">
        {shouldLoad ? (
          <iframe
            key={`${item.id}-${shouldLoad ? 'active' : 'idle'}-${soundEnabled ? 'sound' : 'mute'}`}
            title={item.title}
            src={playableUrl}
            className="absolute inset-0 h-full w-full border-0"
            allow={IFRAME_ALLOW}
            allowFullScreen
            loading="lazy"
            onLoad={() => setLoaded(true)}
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div
            className="absolute inset-0 bg-zinc-950"
            style={
              item.thumbnailUrl
                ? { backgroundImage: `url(${item.thumbnailUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : undefined
            }
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
            {!item.thumbnailUrl && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <Loader2 className="size-6 animate-spin opacity-50" />
              </div>
            )}
          </div>
        )}

        {shouldLoad && !loaded && (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-black/50">
            <Loader2 className="size-8 animate-spin text-white" />
          </div>
        )}
        {shouldLoad && (
          <div className="absolute left-2 top-2 z-[2]">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 rounded-full bg-black/55 text-white border-0 hover:bg-black/70"
              onClick={() => {
                setLoaded(false)
                setSoundEnabled(v => !v)
              }}
            >
              {soundEnabled ? 'Audio: ON' : 'Activar audio'}
            </Button>
          </div>
        )}
      </div>

      <div className="absolute top-12 left-2 right-14 z-20 flex items-start gap-2 pointer-events-none">
        <Badge className={cn('shrink-0 text-[0.65rem] font-bold uppercase', platformClass[item.platform])}>
          {platformLabel[item.platform]}
        </Badge>
        {item.tags?.slice(0, 2).map(t => (
          <Badge
            key={t}
            variant="secondary"
            className="text-[0.6rem] bg-black/45 text-white border-0 pointer-events-none"
          >
            #{t}
          </Badge>
        ))}
      </div>

      <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20">
        <div className="flex flex-col items-center gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="size-9 rounded-full bg-background/30 backdrop-blur-md border-0 text-white hover:bg-white/20"
            onClick={() => onToggleLike?.(item)}
            aria-label="Me gusta"
          >
            <Heart className={cn('size-4', liked ? 'fill-rose-500 text-rose-500' : 'text-white')} />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="size-9 rounded-full bg-background/30 backdrop-blur-md border-0 text-white hover:bg-white/20"
            onClick={() => onToggleFavorite?.(item)}
            aria-label="Favorito"
          >
            <Bookmark className={cn('size-4', favorite ? 'fill-amber-400 text-amber-400' : 'text-white')} />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="size-9 rounded-full bg-background/30 backdrop-blur-md border-0 text-white hover:bg-white/20"
            onClick={async () => {
              try {
                if (navigator.share) {
                  await navigator.share({ title: item.title, url: item.sourceUrl })
                  return
                }
                await navigator.clipboard.writeText(item.sourceUrl)
              } catch {
                // ignore
              }
            }}
            aria-label="Compartir"
          >
            <Share2 className="size-4 text-white" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="size-9 rounded-full bg-background/30 backdrop-blur-md border-0 text-white hover:bg-white/20"
            asChild
          >
            <a href={item.sourceUrl} target="_blank" rel="noreferrer noopener" aria-label="Abrir en la app original">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none p-3 pt-20 bg-gradient-to-t from-black/85 via-black/30 to-transparent rounded-b-2xl">
        <p className="text-white text-sm font-bold leading-tight line-clamp-2 drop-shadow-sm">
          {item.title}
        </p>
        <p className="text-white/80 text-xs mt-1 line-clamp-1">{item.author}</p>
        {item.likes != null && (
          <p className="text-white/50 text-xs mt-0.5">
            {item.likes.toLocaleString('es-CL')} reacciones
          </p>
        )}
      </div>
    </div>
  )
}
