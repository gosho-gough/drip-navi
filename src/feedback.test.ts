import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// feedback.ts はモジュール内に状態(ctx, lock)を持つので、テストごとに読み込み直す
const load = () => import('./feedback')

type Osc = { frequency: { value: number } }
let oscillators: Osc[]

function stubAudioContext() {
  oscillators = []
  class FakeAudioContext {
    currentTime = 0
    destination = {}
    resume = vi.fn()
    createGain() {
      return {
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      }
    }
    createOscillator() {
      const gain = this.createGain()
      const osc = { frequency: { value: 0 }, connect: vi.fn(() => gain), start: vi.fn(), stop: vi.fn() }
      oscillators.push(osc)
      return osc
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext)
  ;(window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext
}

function stubNavigator(props: Record<string, unknown>) {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(navigator, key, { value, configurable: true })
  }
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete (window as unknown as { AudioContext?: unknown }).AudioContext
  stubNavigator({ vibrate: undefined, wakeLock: undefined })
})

describe('beep', () => {
  it.each([
    ['warn', [660]],
    ['switch', [880, 1100]],
    ['done', [660, 880, 1320]],
  ] as const)('%s: 周波数 %j を鳴らす', async (kind, freqs) => {
    stubAudioContext()
    const { initAudio, beep } = await load()
    initAudio()
    beep(kind)
    expect(oscillators.map((o) => o.frequency.value)).toEqual(freqs)
  })

  it('バイブ: warn は 80、それ以外は [150,80,150]', async () => {
    const vibrate = vi.fn()
    stubNavigator({ vibrate })
    const { beep } = await load()
    beep('warn')
    beep('switch')
    beep('done')
    expect(vibrate.mock.calls).toEqual([[80], [[150, 80, 150]], [[150, 80, 150]]])
  })

  it('AudioContext もバイブも無い環境で例外を出さない', async () => {
    const { initAudio, beep } = await load()
    expect(() => {
      initAudio()
      beep('done')
    }).not.toThrow()
  })
})

describe('keepAwake', () => {
  it('on で画面スリープ防止を要求し、off で解放する', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    const request = vi.fn().mockResolvedValue({ release })
    stubNavigator({ wakeLock: { request } })
    const { keepAwake } = await load()
    await keepAwake(true)
    expect(request).toHaveBeenCalledWith('screen')
    await keepAwake(false)
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('要求が拒否されても例外を出さない', async () => {
    stubNavigator({ wakeLock: { request: vi.fn().mockRejectedValue(new Error('denied')) } })
    const { keepAwake } = await load()
    await expect(keepAwake(true)).resolves.toBeUndefined()
  })

  it('Wake Lock 非対応でも例外を出さない', async () => {
    const { keepAwake } = await load()
    await expect(keepAwake(true)).resolves.toBeUndefined()
    await expect(keepAwake(false)).resolves.toBeUndefined()
  })

  // 本実装で追加する(docs/design-handoff.md 6節の1)。実装時に実テストへ変える
  it.todo('画面が非表示から戻ったとき(visibilitychange)に再取得する')
})
