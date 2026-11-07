import { useEffect, useRef, useState } from 'react'
import { fmt, type PlanStep, type Recipe, calc } from './recipes'
import { beep, keepAwake } from './feedback'

type Props = {
  recipe: Recipe
  plan: ReturnType<typeof calc>
  speed: number
  onCancel: () => void
  onFinish: (elapsed: number) => void
}
const WARN_SEC = 3

export default function Navigate({ recipe, plan, speed, onCancel, onFinish }: Props) {
  // 経過時間は setInterval のカウントではなく「開始時刻との差」で求める
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const startRef = useRef(performance.now())
  const pausedAtRef = useRef(0)
  const lastRef = useRef({ step: -1, warned: -1 })
  const doneRef = useRef(false)

  useEffect(() => {
    keepAwake(true)
    return () => {
      keepAwake(false)
    }
  }, [])

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setElapsed(((performance.now() - startRef.current) / 1000) * speed), 100)
    return () => clearInterval(id)
  }, [paused, speed])

  const togglePause = () => {
    if (!paused) pausedAtRef.current = performance.now()
    else startRef.current += performance.now() - pausedAtRef.current
    setPaused(!paused)
  }

  const steps = plan.steps
  const idx = steps.findIndex((s) => elapsed >= s.startSec && elapsed < s.endSec)
  const before = elapsed < steps[0].startSec
  const finished = elapsed >= recipe.finishSec
  const cur: PlanStep | undefined = steps[idx]

  // 切り替え合図
  useEffect(() => {
    if (finished && !doneRef.current) {
      doneRef.current = true
      beep('done')
      setTimeout(() => onFinish(Math.round(elapsed)), 1200)
      return
    }
    if (idx >= 0 && idx !== lastRef.current.step) {
      if (idx > 0) beep('switch')
      lastRef.current.step = idx
    }
    if (cur && cur.endSec - elapsed <= WARN_SEC && lastRef.current.warned !== idx) {
      lastRef.current.warned = idx
      if (!finished) beep('warn')
    }
  }, [elapsed]) // eslint-disable-line

  const remain = cur ? Math.ceil(cur.endSec - elapsed) : 0
  const pouring = cur ? elapsed < cur.startSec + cur.pourSec : false
  const isLast = idx === steps.length - 1

  const R = 88
  const C = 2 * Math.PI * R
  const stepProgress = cur
    ? Math.min(1, Math.max(0, (elapsed - cur.startSec) / (cur.endSec - cur.startSec)))
    : finished
      ? 1
      : 0
  const state = finished ? 'fin' : pouring ? 'pour' : 'wait'

  return (
    <main className={`screen nav ${state}`}>
      <div className="clock" aria-label="経過時間">
        {fmt(elapsed)}
        <small> / {fmt(recipe.finishSec)}</small>
      </div>

      <div className="stage">
        {finished ? (
          <p className="phase" role="status">
            完成です
          </p>
        ) : (
          <>
            <p className="phase" role="status">
              {cur ? (pouring ? '注ぐ' : '待つ') : '準備'}
              <span>{cur?.name}</span>
            </p>
            <div className="dial">
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle className="track" cx="100" cy="100" r={R} />
                <circle
                  key={idx} /* 工程ごとに作り直し、100%→0%の巻き戻りアニメを防ぐ */
                  className="arc"
                  cx="100"
                  cy="100"
                  r={R}
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - stepProgress)}
                  transform="rotate(-90 100 100)"
                />
              </svg>
              <div className="face">
                {cur ? (
                  <>
                    <b className="big">{cur.cumulative}</b>
                    <span className="unit">mlまで</span>
                    <span className="delta">今回 +{cur.amount}ml</span>
                  </>
                ) : (
                  <span className="unit">開始を待っています</span>
                )}
              </div>
            </div>
            <p className="count">
              {cur ? (
                <>
                  {isLast ? '終了まで' : '次の工程まで'}
                  <b>{remain}</b>秒
                </>
              ) : (
                <>&nbsp;</>
              )}
            </p>
          </>
        )}
      </div>

      <ol className="plist">
        {steps.map((s, i) => (
          <li key={s.name} className={finished || i < idx ? 'past' : i === idx ? 'now' : ''}>
            <span className="t">{fmt(s.startSec)}</span>
            <span className="n">{s.name}</span>
            <span className="a">+{s.amount}</span>
            <span className="c">{s.cumulative}ml</span>
          </li>
        ))}
      </ol>

      {before && <p className="hint">最初の工程を待っています</p>}
      <div className="ops">
        <button onClick={togglePause}>{paused ? '再開' : '一時停止'}</button>
        <button
          className="danger"
          onClick={() => {
            if (confirm('中止して設定に戻りますか?')) onCancel()
          }}
        >
          中止
        </button>
      </div>
    </main>
  )
}
