'use client'

import { useEffect, useState } from 'react'
import { UserPlus, UserCheck, MapPin, X } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import type { SocialPost } from '@/app/api/social-feed/route'
import { sanitizeUserText } from '@/lib/utils/sanitize'

type Profile = {
  id: string
  username: string
  avatar_url: string | null
  bio: string | null
}

type FollowStats = { followers: number; following: number }

export function UserProfileSheet({
  userId,
  onClose,
}: {
  userId: string | null
  onClose: () => void
}) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<FollowStats>({ followers: 0, following: 0 })
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [meId, setMeId] = useState<string | null>(null)
  const [followLoading, setFollowLoading] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    setProfile(null)
    setPosts([])
    setIsFollowing(false)

    const supabase = getSupabaseBrowserClient()

    async function load() {
      if (!supabase) return

      const [{ data: sessionData }, { data: prof }, statsRes, postsRes] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from('profiles').select('id, username, avatar_url, bio').eq('id', userId!).maybeSingle(),
        fetch(`/api/social?user_id=${encodeURIComponent(userId!)}`).then(r => r.json()) as Promise<FollowStats>,
        fetch(`/api/social-feed?user_id=${encodeURIComponent(userId!)}&limit=20`).then(r => r.json()) as Promise<{ posts: SocialPost[] }>,
      ])

      const myId = sessionData.session?.user?.id ?? null
      setMeId(myId)
      setProfile(prof ?? null)
      setStats({ followers: statsRes.followers ?? 0, following: statsRes.following ?? 0 })
      setPosts(postsRes.posts ?? [])

      if (myId && myId !== userId) {
        const { data: followRow } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', myId)
          .eq('following_id', userId!)
          .maybeSingle()
        setIsFollowing(!!followRow)
      }

      setLoading(false)
    }

    void load()
  }, [userId])

  const handleFollow = async () => {
    if (!meId || !userId || followLoading) return
    setFollowLoading(true)

    if (isFollowing) {
      const supabase = getSupabaseBrowserClient()
      if (supabase) {
        await supabase.from('follows').delete().eq('follower_id', meId).eq('following_id', userId)
        setIsFollowing(false)
        setStats(s => ({ ...s, followers: Math.max(0, s.followers - 1) }))
      }
    } else {
      const token = (await getSupabaseBrowserClient()?.auth.getSession())?.data.session?.access_token
      await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'follow', following_id: userId }),
      })
      setIsFollowing(true)
      setStats(s => ({ ...s, followers: s.followers + 1 }))
    }

    setFollowLoading(false)
  }

  const isOwnProfile = meId === userId

  return (
    <Sheet open={!!userId} onOpenChange={open => !open && onClose()}>
      <SheetContent side="bottom" className="h-[92dvh] rounded-t-3xl p-0 flex flex-col overflow-hidden">
        <SheetTitle className="sr-only">Perfil de usuario</SheetTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-orange-100 shrink-0">
          <h2 className="text-sm font-bold">Perfil</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
              Cargando perfil…
            </div>
          ) : !profile ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
              Perfil no encontrado
            </div>
          ) : (
            <>
              {/* Info del usuario */}
              <div className="flex flex-col items-center gap-3 px-4 pt-6 pb-5 text-center">
                <Avatar className="size-20 ring-4 ring-orange-100">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="size-full rounded-full object-cover" />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-orange-400 to-amber-300 text-white font-bold text-2xl">
                      {(profile.username || '?').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>

                <div>
                  <p className="text-lg font-bold">@{profile.username}</p>
                  {profile.bio && (
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">{profile.bio}</p>
                  )}
                </div>

                {/* Stats */}
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-base font-bold">{stats.followers}</p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Seguidores</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold">{stats.following}</p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Siguiendo</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold">{posts.length}</p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Publicaciones</p>
                  </div>
                </div>

                {/* Botón follow */}
                {!isOwnProfile && meId && (
                  <Button
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={isFollowing
                      ? 'bg-muted text-foreground hover:bg-muted/80 border'
                      : 'bg-orange-500 hover:bg-orange-600 text-white'}
                    size="sm"
                  >
                    {isFollowing
                      ? <><UserCheck className="size-4 mr-1.5" /> Siguiendo</>
                      : <><UserPlus className="size-4 mr-1.5" /> Seguir</>}
                  </Button>
                )}
                {!meId && (
                  <p className="text-xs text-muted-foreground">Inicia sesión para seguir a este usuario</p>
                )}
              </div>

              {/* Posts */}
              <div className="border-t border-orange-100">
                {posts.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Sin publicaciones aún
                  </div>
                ) : (
                  <div className="divide-y divide-orange-50">
                    {posts.map(post => (
                      <MiniPostCard key={post.id} post={post} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MiniPostCard({ post }: { post: SocialPost }) {
  const content = sanitizeUserText(post.content || '')
  return (
    <div className="px-4 py-3 flex gap-3">
      {post.media_url && (
        <img src={post.media_url} alt="" className="size-14 rounded-xl object-cover shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        {post.place_name && (
          <div className="flex items-center gap-1 mb-0.5">
            <MapPin className="size-3 text-orange-500 shrink-0" />
            <p className="text-xs text-orange-600 font-medium truncate">{sanitizeUserText(post.place_name)}</p>
          </div>
        )}
        {content && <p className="text-sm text-foreground line-clamp-2">{content}</p>}
        {post.rating != null && (
          <div className="flex items-center gap-0.5 mt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={`text-[11px] ${i < post.rating! ? 'text-yellow-400' : 'text-muted-foreground/30'}`}>★</span>
            ))}
          </div>
        )}
        {post.mood_tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {post.mood_tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0">{tag}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
