'use client'

import { useEffect, useMemo, useState } from 'react'
import { Facebook, LogOut, Mail, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { getSupabaseBrowserClient } from '@/lib/supabase'

type SessionUser = { email?: string | null }

export function AuthQuickRegister() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [email, setEmail] = useState('')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ? { email: data.session.user.email } : null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { email: session.user.email } : null)
    })
    return () => sub.subscription.unsubscribe()
  }, [supabase])

  if (!supabase) {
    return (
      <div className="text-xs text-muted-foreground">
        Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` para habilitar registro/login real.
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Registro rápido y autenticación</p>
        {user?.email && <Badge variant="secondary" className="text-[10px]">{user.email}</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={async () => {
            setStatus('')
            await supabase.auth.signInWithOAuth({ provider: 'google' })
          }}
        >
          <Mail className="size-4" />
          Google
        </Button>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={async () => {
            setStatus('')
            await supabase.auth.signInWithOAuth({ provider: 'facebook' })
          }}
        >
          <Facebook className="size-4" />
          Facebook
        </Button>
        <Button
          variant="outline"
          className="gap-1.5 col-span-2"
          onClick={async () => {
            setStatus('')
            await supabase.auth.signInWithOAuth({
              provider: 'facebook',
              options: { queryParams: { scope: 'public_profile,email,instagram_basic' } },
            })
          }}
        >
          <ShieldCheck className="size-4" />
          Instagram (Meta Login)
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="correo@ejemplo.com"
        />
        <Button
          onClick={async () => {
            if (!email.trim()) return
            const { error } = await supabase.auth.signInWithOtp({ email: email.trim() })
            setStatus(error ? error.message : 'Te enviamos link mágico al correo.')
          }}
        >
          Correo
        </Button>
      </div>

      {user && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={async () => {
            await supabase.auth.signOut()
            setStatus('Sesión cerrada.')
          }}
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </Button>
      )}
      {!!status && <p className="text-xs text-muted-foreground">{status}</p>}
    </div>
  )
}

