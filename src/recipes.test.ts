import { describe, expect, it } from 'vitest'
import { calc, fmt, recipes } from './recipes'

const CUPS = [1, 2, 3, 4]
const cases = recipes.flatMap((r) => CUPS.map((c) => [r.id, c] as const))

describe('calc', () => {
  it.each(cases)('%s / %i杯: 最終の累計は総湯量に一致し、工程の合計も総湯量に一致する', (id, cups) => {
    const recipe = recipes.find((r) => r.id === id)!
    const { water, steps } = calc(recipe, cups)
    expect(steps[steps.length - 1]!.cumulative).toBe(water)
    expect(steps.reduce((sum, s) => sum + s.amount, 0)).toBe(water)
  })

  it.each(cases)('%s / %i杯: 各工程の量は0以上で、累計は単調に増える', (id, cups) => {
    const recipe = recipes.find((r) => r.id === id)!
    const { steps } = calc(recipe, cups)
    steps.forEach((s) => expect(s.amount).toBeGreaterThanOrEqual(0))
    steps.slice(1).forEach((s, i) => expect(s.cumulative).toBeGreaterThanOrEqual(steps[i]!.cumulative))
  })

  it('基本の1投ドリップ 2杯: 豆20g・湯320ml・累計48/192/272/320', () => {
    const { beans, water, steps } = calc(
      recipes.find((r) => r.id === 'basic')!,
      2,
    )
    expect(beans).toBe(20)
    expect(water).toBe(320)
    expect(steps.map((s) => s.cumulative)).toEqual([48, 192, 272, 320])
  })

  it('豆量は1杯あたりの豆 × 杯数、総湯量は豆量 × 倍率(四捨五入)', () => {
    for (const r of recipes) {
      for (const cups of CUPS) {
        const { beans, water } = calc(r, cups)
        expect(beans).toBe(r.beansPerCup * cups)
        expect(water).toBe(Math.round(beans * r.ratio))
      }
    }
  })

  it('各工程の終了秒は次の工程の開始秒、最後は finishSec', () => {
    for (const r of recipes) {
      const { steps } = calc(r, 2)
      steps.forEach((s, i) => expect(s.endSec).toBe(steps[i + 1]?.startSec ?? r.finishSec))
    }
  })
})

describe('fmt', () => {
  it.each([
    [-5, '0:00'],
    [0, '0:00'],
    [59, '0:59'],
    [60, '1:00'],
    [125.9, '2:05'],
  ])('%f秒 → %s', (sec, expected) => {
    expect(fmt(sec)).toBe(expected)
  })
})

// 新しいレシピを足したときに、データの不備を自動で検出する
describe('レシピデータの不変条件', () => {
  it('id は一意', () => {
    expect(new Set(recipes.map((r) => r.id)).size).toBe(recipes.length)
  })

  describe.each(recipes.map((r) => [r.id, r] as const))('%s', (_id, r) => {
    it('1杯あたりの豆と倍率は正', () => {
      expect(r.beansPerCup).toBeGreaterThan(0)
      expect(r.ratio).toBeGreaterThan(0)
    })

    it('注湯の割合の合計は100%', () => {
      expect(r.steps.reduce((sum, s) => sum + s.percent, 0)).toBe(100)
    })

    it('先頭の工程は0秒開始で、開始秒は昇順、最後の工程は finishSec より前に始まる', () => {
      expect(r.steps[0]!.startSec).toBe(0)
      r.steps.slice(1).forEach((s, i) => expect(s.startSec).toBeGreaterThan(r.steps[i]!.startSec))
      expect(r.steps[r.steps.length - 1]!.startSec).toBeLessThan(r.finishSec)
    })

    it('注ぎ切る目安秒は工程の長さ以内', () => {
      calc(r, 1).steps.forEach((s) => expect(s.pourSec).toBeLessThanOrEqual(s.endSec - s.startSec))
    })

    it('工程名は一意(一覧の key に使っている)', () => {
      expect(new Set(r.steps.map((s) => s.name)).size).toBe(r.steps.length)
    })
  })
})
