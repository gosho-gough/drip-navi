import { recipes, fmt, type Recipe, calc } from './recipes'
import { initAudio } from './feedback'

type Props = {
  recipeId: string
  setRecipeId: (v: string) => void
  cups: number
  setCups: (v: number) => void
  recipe: Recipe
  plan: ReturnType<typeof calc>
  speed: number
  setSpeed: (v: number) => void
  onStart: () => void
}

export default function Setup({ recipeId, setRecipeId, cups, setCups, recipe, plan, speed, setSpeed, onStart }: Props) {
  return (
    <main className="screen setup">
      <header className="masthead">
        <p className="brand">ドリップナビ</p>
        <div className="result" aria-live="polite">
          <div>
            <span className="label">豆</span>
            <b>
              {plan.beans}
              <i>g</i>
            </b>
          </div>
          <div>
            <span className="label">お湯</span>
            <b>
              {plan.water}
              <i>ml</i>
            </b>
          </div>
        </div>
        <ul className="chips">
          <li>{recipe.grind}</li>
          <li>{recipe.temp}</li>
          <li>約{fmt(recipe.finishSec)}</li>
        </ul>
      </header>

      <div className="body">
        <section aria-labelledby="h-recipe">
          <h2 id="h-recipe">レシピ</h2>
          <div className="list" role="radiogroup" aria-labelledby="h-recipe">
            {recipes.map((r) => (
              <button
                key={r.id}
                role="radio"
                aria-checked={r.id === recipeId}
                className={`opt ${r.id === recipeId ? 'on' : ''}`}
                onClick={() => setRecipeId(r.id)}
              >
                <span className="mark" aria-hidden="true" />
                <span className="txt">
                  <strong>{r.name}</strong>
                  <small>{r.description}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="h-cups">
          <h2 id="h-cups">杯数</h2>
          <div className="cups" role="radiogroup" aria-labelledby="h-cups">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                role="radio"
                aria-checked={n === cups}
                className={n === cups ? 'on' : ''}
                onClick={() => setCups(n)}
              >
                {n}
                <small>杯</small>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="h-steps">
          <h2 id="h-steps">注ぎ方</h2>
          <ol className="timeline">
            {plan.steps.map((s) => (
              <li key={s.name}>
                <span className="t">{fmt(s.startSec)}</span>
                <span className="n">{s.name}</span>
                <span className="a">+{s.amount}</span>
                <span className="c">
                  {s.cumulative}
                  <small>ml</small>
                </span>
              </li>
            ))}
          </ol>
          <p className="note">右端が、その工程で注ぎ終わる時点の累計です。</p>
        </section>

        <label className="speed">
          確認用の再生速度
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            <option value={1}>×1(実時間)</option>
            <option value={5}>×5</option>
            <option value={10}>×10</option>
          </select>
        </label>
      </div>

      <div className="dock">
        <button
          className="primary"
          onClick={() => {
            initAudio()
            onStart()
          }}
        >
          抽出をはじめる
        </button>
      </div>
    </main>
  )
}
