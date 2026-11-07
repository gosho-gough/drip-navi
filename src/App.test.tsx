import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./feedback', () => ({ beep: vi.fn(), keepAwake: vi.fn(), initAudio: vi.fn() }))

const button = (name: string) => screen.getByRole('button', { name })
const advance = (sec: number) => {
  for (let i = 0; i < sec * 10; i++) act(() => void vi.advanceTimersByTime(100))
}
const radio = (name: string | RegExp) => screen.getByRole('radio', { name })

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('設定画面', () => {
  it('レシピと杯数を選ぶと、豆量・湯量と工程が更新される', () => {
    render(<App />)
    expect(radio(/基本の1投ドリップ/)).toHaveAttribute('aria-checked', 'true')
    expect(radio('2 杯')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelector('.result')).toHaveTextContent('20g')
    expect(document.querySelector('.result')).toHaveTextContent('320ml')

    fireEvent.click(radio('4 杯'))
    expect(document.querySelector('.result')).toHaveTextContent('40g')
    expect(document.querySelector('.result')).toHaveTextContent('640ml')

    fireEvent.click(radio(/4:6メソッド/))
    expect(radio(/4:6メソッド/)).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelector('.result')).toHaveTextContent('600ml')
  })

  it('杯数は 1〜4 の4択', () => {
    render(<App />)
    expect(screen.getAllByRole('radio', { name: /^\d 杯$/ }).map((e) => e.textContent)).toEqual([
      '1杯',
      '2杯',
      '3杯',
      '4杯',
    ])
  })

  it('開始ボタンの文言は「抽出をはじめる」', () => {
    render(<App />)
    expect(button('抽出をはじめる')).toBeInTheDocument()
  })
})

describe('画面遷移', () => {
  it('設定 → ナビ → 中止で設定に戻る', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<App />)
    fireEvent.click(button('抽出をはじめる'))
    expect(button('一時停止')).toBeInTheDocument()
    fireEvent.click(button('中止'))
    expect(button('抽出をはじめる')).toBeInTheDocument()
  })

  it('設定 → ナビ → 完了 → もう一杯でナビ / 設定に戻るで設定', () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('確認用の再生速度'), { target: { value: '10' } })
    fireEvent.click(button('抽出をはじめる'))
    advance(17)

    expect(screen.getByRole('heading', { name: '抽出が終わりました' })).toBeInTheDocument()
    expect(document.querySelector('.tally')).toHaveTextContent('20g')
    expect(document.querySelector('.tally')).toHaveTextContent('320ml')
    expect(document.querySelector('.tally')).toHaveTextContent('2:30')

    fireEvent.click(button('同じ設定でもう一杯'))
    expect(button('一時停止')).toBeInTheDocument()

    advance(17)
    fireEvent.click(button('設定に戻る'))
    expect(button('抽出をはじめる')).toBeInTheDocument()
  })
})
