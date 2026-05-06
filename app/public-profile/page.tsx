import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type PublicPayload = {
  username: string
  bio: string
  favorites: { id: string; title: string; author: string; sourceUrl: string }[]
  reviews: string[]
  visited: string[]
}

function decodePayload(raw: string | undefined): PublicPayload | null {
  if (!raw) return null
  try {
    const b64 = decodeURIComponent(raw)
    const json = Buffer.from(b64, 'base64').toString('utf-8')
    return JSON.parse(json) as PublicPayload
  } catch {
    return null
  }
}

export default async function PublicProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>
}) {
  const data = decodePayload((await searchParams).data)

  if (!data) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Enlace inválido o expirado.</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background px-4 py-6">
      <div className="max-w-xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>@{data.username}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{data.bio}</p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Perfil público Picada.App</Badge>
              <Button
                size="sm"
                onClick={async () => {
                  if (typeof window === 'undefined') return
                  const me = window.localStorage.getItem('picada.user.id.v1') || 'guest-user'
                  await fetch('/api/social', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'follow', follower_id: me, following_id: data.username }),
                  })
                }}
              >
                Follow
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Mapa de descubrimientos</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {data.visited.length === 0 ? <p className="text-sm text-muted-foreground">Sin visitas aún.</p> : data.visited.map((v, i) => (
              <div key={`${v}-${i}`} className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">Descubrimiento</p>
                <p className="text-sm font-medium">{v}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Favoritos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.favorites.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin favoritos.</p>
            ) : data.favorites.map(f => (
              <a key={f.id} href={f.sourceUrl} target="_blank" rel="noreferrer" className="block text-sm underline">
                {f.title} · {f.author}
              </a>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Reseñas</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {data.reviews.length === 0 ? <p className="text-sm text-muted-foreground">Sin reseñas.</p> : data.reviews.map((r, i) => <p key={`${r}-${i}`} className="text-sm">- {r}</p>)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Lugares visitados</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {data.visited.length === 0 ? <p className="text-sm text-muted-foreground">Sin lugares.</p> : data.visited.map((v, i) => <p key={`${v}-${i}`} className="text-sm">- {v}</p>)}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

