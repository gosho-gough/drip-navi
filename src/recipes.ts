export type Step = {
  startSec: number // 開始秒
  percent: number // 注湯の割合(%)
  name: string
  pourSec: number // 注ぎ切るまでの目安秒(以降は「待ち」)
}
export type Recipe = {
  id: string
  name: string
  description: string
  beansPerCup: number // g
  ratio: number // 湯の倍率
  grind: string
  temp: string
  finishSec: number // 最後の工程の終了秒
  steps: Step[]
}

export const recipes: Recipe[] = [
  {
    id: 'basic',
    name: '基本の1投ドリップ',
    description: '蒸らし後にたっぷり注ぐ、すっきり素直な味わい',
    beansPerCup: 10, ratio: 16, grind: '中挽き', temp: '90℃', finishSec: 150,
    steps: [
      { startSec: 0, percent: 15, name: '蒸らし', pourSec: 10 },
      { startSec: 30, percent: 45, name: '注湯1', pourSec: 30 },
      { startSec: 75, percent: 25, name: '注湯2', pourSec: 25 },
      { startSec: 110, percent: 15, name: '注湯3', pourSec: 15 },
    ],
  },
  {
    id: '46',
    name: '4:6メソッド',
    description: '前半40%で味、後半60%で濃度を調整する',
    beansPerCup: 10, ratio: 15, grind: '粗挽き', temp: '92℃', finishSec: 210,
    steps: [
      { startSec: 0, percent: 17, name: '注湯1(甘さ・酸味)', pourSec: 10 },
      { startSec: 45, percent: 23, name: '注湯2(甘さ・酸味)', pourSec: 12 },
      { startSec: 90, percent: 20, name: '注湯3(濃度)', pourSec: 12 },
      { startSec: 135, percent: 20, name: '注湯4(濃度)', pourSec: 12 },
      { startSec: 180, percent: 20, name: '注湯5(濃度)', pourSec: 12 },
    ],
  },
  {
    id: 'light',
    name: '浅煎りのていねい2投',
    description: '高めの湯温で酸味と香りを引き出す',
    beansPerCup: 12, ratio: 15, grind: 'やや粗挽き', temp: '94℃', finishSec: 165,
    steps: [
      { startSec: 0, percent: 17, name: '蒸らし', pourSec: 10 },
      { startSec: 40, percent: 50, name: '注湯1', pourSec: 30 },
      { startSec: 100, percent: 33, name: '注湯2', pourSec: 25 },
    ],
  },
]

export type PlanStep = Step & { amount: number; cumulative: number; endSec: number }

export function calc(recipe: Recipe, cups: number) {
  const beans = recipe.beansPerCup * cups
  const water = Math.round(beans * recipe.ratio)
  let acc = 0
  const steps: PlanStep[] = recipe.steps.map((s, i) => {
    const prev = acc
    acc += s.percent
    const cumulative = Math.round((acc / 100) * water)
    return {
      ...s,
      amount: cumulative - Math.round((prev / 100) * water),
      cumulative,
      endSec: recipe.steps[i + 1]?.startSec ?? recipe.finishSec,
    }
  })
  return { beans, water, steps }
}

export const fmt = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
