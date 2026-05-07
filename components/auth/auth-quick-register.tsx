'use client'

import { useEffect, useMemo, useState } from 'react'
import { Facebook, LogOut, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { getSupabaseBrowserClient } from '@/lib/supabase'

type Mode = 'signin' | 'signup' | 'reset'
type SessionUser = { email?: string | null }

export function AuthQuickRegister() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<{ msg: string; error?: boolean } | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)

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
        Configura <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> para habilitar autenticación.
      </div>
    )
  }

  const handleSubmit = async () => {
    if (!email.trim() || (!password.trim() && mode !== 'reset')) return
    setLoading(true)
    setStatus(null)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setStatus({ msg: error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : error.message, error: true })
      else setStatus({ msg: '¡Sesión iniciada!' })
    } else if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password })
      if (error) {
        const msg = error.status === 429 || error.message.toLowerCase().includes('rate')
          ? 'Límite de emails alcanzado. Espera unos minutos e inténtalo de nuevo.'
          : error.message
        setStatus({ msg, error: true })
      } else {
        setSubmitted(true)
        setStatus({ msg: 'Cuenta creada. Revisa tu correo para confirmarla.' })
      }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
      if (error) {
        const msg = error.status === 429 || error.message.toLowerCase().includes('rate')
          ? 'Límite de emails alcanzado. Espera unos minutos e inténtalo de nuevo.'
          : error.message
        setStatus({ msg, error: true })
      } else {
        setSubmitted(true)
        setStatus({ msg: 'Te enviamos un link para restablecer tu contraseña.' })
      }
    }

    setLoading(false)
  }

  if (user) {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Sesión activa</p>
          <Badge variant="secondary" className="text-[10px]">{user.email}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 w-full"
          onClick={async () => {
            await supabase.auth.signOut()
            setStatus({ msg: 'Sesión cerrada.' })
          }}
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* OAuth */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => { setStatus(null); supabase.auth.signInWithOAuth({ provider: 'google' }) }}
        >
          <svg className="size-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Google
        </Button>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => { setStatus(null); supabase.auth.signInWithOAuth({ provider: 'facebook' }) }}
        >
          <Facebook className="size-4 text-[#1877F2]" />
          Facebook
        </Button>
      </div>

      <div className="relative flex items-center gap-2">
        <div className="flex-1 border-t" />
        <span className="text-xs text-muted-foreground">o con correo</span>
        <div className="flex-1 border-t" />
      </div>

      {/* Mode tabs */}
      <div className="flex rounded-lg border p-0.5 gap-0.5">
        <button
          className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${mode === 'signin' ? 'bg-orange-500 text-white font-medium' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => { setMode('signin'); setStatus(null); setSubmitted(false) }}
        >
          Iniciar sesión
        </button>
        <button
          className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${mode === 'signup' ? 'bg-orange-500 text-white font-medium' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => { setMode('signup'); setStatus(null); setSubmitted(false) }}
        >
          Registrarse
        </button>
      </div>

      <Input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="correo@ejemplo.com"
        autoComplete="email"
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
      />

      {mode !== 'reset' && (
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            className="pr-10"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword(v => !v)}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      )}

      <Button
        className="w-full bg-orange-500 hover:bg-orange-600 text-white"
        onClick={handleSubmit}
        disabled={loading || submitted}
      >
        {loading ? 'Cargando...' : mode === 'signin' ? 'Iniciar sesión' : mode === 'signup' ? 'Crear cuenta' : 'Enviar link'}
      </Button>

      {mode === 'signin' && (
        <button
          className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
          onClick={() => { setMode('reset'); setStatus(null) }}
        >
          ¿Olvidaste tu contraseña?
        </button>
      )}

      {mode === 'reset' && (
        <button
          className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
          onClick={() => { setMode('signin'); setStatus(null); setSubmitted(false) }}
        >
          Volver a iniciar sesión
        </button>
      )}

      {status && (
        <p className={`text-xs text-center ${status.error ? 'text-destructive' : 'text-muted-foreground'}`}>
          {status.msg}
        </p>
      )}
    </div>
  )
}
