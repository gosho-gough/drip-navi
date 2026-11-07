import { fmt } from './recipes'
import type { Result } from './App'

export default function Done({ result, onAgain, onBack }: { result: Result; onAgain: () => void; onBack: () => void }) {
  return (
    <main className="screen done">
      <div className="seal" aria-hidden="true">
        <svg viewBox="0 0 48 48"><path d="M13 25.5l8 8L35 16" /></svg>
      </div>
      <h1>抽出が終わりました</h1>
      <dl className="tally">
        <div><dt>豆</dt><dd>{result.beans}<i>g</i></dd></div>
        <div><dt>お湯</dt><dd>{result.water}<i>ml</i></dd></div>
        <div><dt>抽出時間</dt><dd>{fmt(result.elapsed)}</dd></div>
      </dl>
      <div className="actions">
        <button className="primary" onClick={onAgain}>同じ設定でもう一杯</button>
        <button className="ghost" onClick={onBack}>設定に戻る</button>
      </div>
    </main>
  )
}
