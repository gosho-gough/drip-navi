import { useState } from 'react'
import { recipes, calc } from './recipes'
import Setup from './Setup'
import Navigate from './Navigate'
import Done from './Done'

export type Result = { beans: number; water: number; elapsed: number }

export default function App() {
  const [recipeId, setRecipeId] = useState(recipes[0]!.id)
  const [cups, setCups] = useState(2)
  const [screen, setScreen] = useState<'setup' | 'nav' | 'done'>('setup')
  const [speed, setSpeed] = useState(1) // モック確認用の倍速
  const [result, setResult] = useState<Result | null>(null)

  const recipe = recipes.find((r) => r.id === recipeId)!
  const plan = calc(recipe, cups)

  return (
    <div className="app">
      {screen === 'setup' && (
        <Setup
          {...{ recipeId, setRecipeId, cups, setCups, recipe, plan, speed, setSpeed }}
          onStart={() => setScreen('nav')}
        />
      )}
      {screen === 'nav' && (
        <Navigate
          recipe={recipe}
          plan={plan}
          speed={speed}
          onCancel={() => setScreen('setup')}
          onFinish={(elapsed) => {
            setResult({ beans: plan.beans, water: plan.water, elapsed })
            setScreen('done')
          }}
        />
      )}
      {screen === 'done' && result && (
        <Done result={result} onAgain={() => setScreen('nav')} onBack={() => setScreen('setup')} />
      )}
    </div>
  )
}
