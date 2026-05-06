export function triggerTapHaptic(duration = 20) {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  navigator.vibrate(duration)
}

let audioCtx: AudioContext | null = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  return audioCtx
}

function tone(frequency: number, durationMs: number, gainValue: number, when = 0) {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => null)
  }
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.value = 0.0001
  oscillator.connect(gain)
  gain.connect(ctx.destination)

  const startAt = ctx.currentTime + when
  const endAt = startAt + durationMs / 1000
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt)
  oscillator.start(startAt)
  oscillator.stop(endAt + 0.01)
}

export function triggerSuccessTone() {
  // Patrón corto para acciones positivas (voto, guardado, etc).
  tone(660, 90, 0.03, 0)
  tone(880, 120, 0.03, 0.08)
}

export function triggerLevelUpTone() {
  // Secuencia ascendente más notoria para niveles/badges.
  tone(523, 110, 0.035, 0)
  tone(659, 110, 0.035, 0.1)
  tone(784, 160, 0.04, 0.22)
}
