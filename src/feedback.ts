let ctx: AudioContext | null = null
let lock: WakeLockSentinel | null = null

// スタートボタンのタップ時に呼ぶ(自動再生制限対策)
export function initAudio() {
  const AC =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  ctx = ctx ?? new AC()
  ctx.resume()
}

export function beep(kind: 'warn' | 'switch' | 'done') {
  if (ctx) {
    const freqs = kind === 'warn' ? [660] : kind === 'switch' ? [880, 1100] : [660, 880, 1320]
    freqs.forEach((f, i) => {
      const o = ctx!.createOscillator()
      const g = ctx!.createGain()
      const t = ctx!.currentTime + i * 0.16
      o.frequency.value = f
      g.gain.setValueAtTime(0.2, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
      o.connect(g).connect(ctx!.destination)
      o.start(t)
      o.stop(t + 0.15)
    })
  }
  navigator.vibrate?.(kind === 'warn' ? 80 : [150, 80, 150])
}

export async function keepAwake(on: boolean) {
  try {
    if (on) lock = (await navigator.wakeLock?.request('screen')) ?? null
    else {
      await lock?.release()
      lock = null
    }
  } catch {
    /* 非対応・拒否は無視 */
  }
}
