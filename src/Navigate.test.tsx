import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Navigate from './Navigate'
import { calc, recipes } from './recipes'
import { beep, keepAwake } from './feedback'

vi.mock('./feedback', () => ({ beep: vi.fn(), keepAwake: vi.fn(), initAudio: vi.fn() }))

// 基本の1投ドリップ 2杯: 蒸らし 0-30s(注ぐ10s) / 注湯1 30-75s / 注湯2 75-110s / 注湯3 110-150s
const recipe = recipes.find((r) => r.id === 'basic')!
const plan = calc(recipe, 2)

// 実機と同じく 100ms ごとに描画と副作用を回す(まとめて進めると途中の合図が飛ぶ)
const advance = (sec: number) => {
  for (let i = 0; i < Math.round(sec * 10); i++) act(() => void vi.advanceTimersByTime(100))
}
const clock = () => screen.getByLabelText('経過時間').textContent ?? ''
const arc = () => document.querySelector('.arc')!

function setup(speed = 1) {
  const onCancel = vi.fn()
  const onFinish = vi.fn()
  render(<Navigate recipe={recipe} plan={plan} speed={speed} onCancel={onCancel} onFinish={onFinish} />)
  return { onCancel, onFinish }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(beep).mockClear()
  vi.mocked(keepAwake).mockClear()
})
afterEach(() => vi.useRealTimers())

describe('Navigate: 工程の判定', () => {
  it('開始直後は「注ぐ」で、蒸らしの累計と今回の量を両方出す', () => {
    setup()
    expect(screen.getByRole('status')).toHaveTextContent('注ぐ蒸らし')
    expect(document.querySelector('.big')).toHaveTextContent('48')
    expect(screen.getByText('今回 +48ml')).toBeInTheDocument()
    expect(document.querySelector('.dial')).toHaveClass('dial')
    expect(document.querySelector('main')).toHaveClass('pour')
  })

  it('注ぎ切る目安秒を過ぎると「待つ」(wait)になる', () => {
    setup()
    advance(10)
    expect(screen.getByRole('status')).toHaveTextContent('待つ蒸らし')
    expect(document.querySelector('main')).toHaveClass('wait')
  })

  it('境界は左閉右開: 30秒ちょうどで次の工程に入る', () => {
    setup()
    advance(29.9)
    expect(screen.getByRole('status')).toHaveTextContent('蒸らし')
    advance(0.1)
    expect(screen.getByRole('status')).toHaveTextContent('注湯1')
  })

  it('残り秒数は切り上げ、最後の工程は「終了まで」と表示する', () => {
    setup()
    advance(10)
    expect(screen.getByText(/次の工程まで/).textContent).toBe('次の工程まで20秒')
    advance(100)
    expect(screen.getByText(/終了まで/)).toBeInTheDocument()
  })

  it('経過時間を m:ss で表示する', () => {
    setup()
    advance(65)
    expect(clock()).toContain('1:05')
  })

  it('speed 倍で経過が進む(モック専用の倍速)', () => {
    setup(10)
    advance(3)
    expect(screen.getByRole('status')).toHaveTextContent('注湯1')
  })
})

describe('Navigate: 合図', () => {
  it('最初の工程では切り替えの音を鳴らさない', () => {
    setup()
    advance(5)
    expect(beep).not.toHaveBeenCalled()
  })

  it('工程終了の3秒前に、工程ごとに1回だけ warn を鳴らす', () => {
    setup()
    advance(26.9)
    expect(beep).not.toHaveBeenCalled()
    advance(0.1)
    expect(beep).toHaveBeenCalledTimes(1)
    expect(beep).toHaveBeenLastCalledWith('warn')
    advance(2.8)
    expect(beep).toHaveBeenCalledTimes(1)
  })

  it('工程が切り替わったとき switch を鳴らす', () => {
    setup()
    advance(30)
    expect(vi.mocked(beep).mock.calls.map(([k]) => k)).toEqual(['warn', 'switch'])
  })

  it('完了時に done を1回だけ鳴らし、少し待ってから onFinish(経過秒)を呼ぶ', () => {
    const { onFinish } = setup()
    advance(150)
    expect(vi.mocked(beep).mock.calls.filter(([k]) => k === 'done')).toHaveLength(1)
    expect(onFinish).not.toHaveBeenCalled()
    advance(1.2)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith(150)
    expect(vi.mocked(beep).mock.calls.filter(([k]) => k === 'done')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('完成です')
  })

  it('表示中は画面スリープを防ぎ、閉じるときに解除する', () => {
    const { unmount } = render(<Navigate recipe={recipe} plan={plan} speed={1} onCancel={vi.fn()} onFinish={vi.fn()} />)
    expect(keepAwake).toHaveBeenLastCalledWith(true)
    unmount()
    expect(keepAwake).toHaveBeenLastCalledWith(false)
  })
})

describe('Navigate: ダイヤル', () => {
  it('リングは工程の経過 0〜1 に応じて dashoffset が減る', () => {
    setup()
    const C = 2 * Math.PI * 88
    expect(Number(arc().getAttribute('stroke-dashoffset'))).toBeCloseTo(C, 5)
    advance(15)
    expect(Number(arc().getAttribute('stroke-dashoffset'))).toBeCloseTo(C * 0.5, 1)
  })

  it('工程が変わるとリングの要素が作り直される(100%→0%の巻き戻りアニメを防ぐ key={idx})', () => {
    setup()
    advance(20)
    const before = arc()
    advance(15)
    expect(arc()).not.toBe(before)
    expect(before.isConnected).toBe(false)
  })

  it('同じ工程の間はリングの要素を使い回す', () => {
    setup()
    advance(5)
    const before = arc()
    advance(5)
    expect(arc()).toBe(before)
  })
})

describe('Navigate: 操作', () => {
  it('一時停止中は経過が進まず、再開すると停止していた時間を除いて進む', () => {
    setup()
    advance(10)
    fireEvent.click(screen.getByRole('button', { name: '一時停止' }))
    advance(30)
    expect(clock()).toContain('0:10')
    fireEvent.click(screen.getByRole('button', { name: '再開' }))
    advance(5)
    expect(clock()).toContain('0:15')
  })

  it('中止は確認ダイアログで承認されたときだけ onCancel を呼ぶ', () => {
    const { onCancel } = setup()
    const confirm = vi.spyOn(window, 'confirm')
    confirm.mockReturnValueOnce(false)
    fireEvent.click(screen.getByRole('button', { name: '中止' }))
    expect(onCancel).not.toHaveBeenCalled()
    confirm.mockReturnValueOnce(true)
    fireEvent.click(screen.getByRole('button', { name: '中止' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
