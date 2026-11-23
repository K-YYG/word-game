import { useEffect, useState } from 'react'
import StatCard from '../components/StatCard'
import { db } from '../db/database'
import { loadAndInstall } from '../db/seed'
import { getHomeStats, getWordbookWords, today, type HomeStats } from '../db/queries'
import { getHistory, planToday, sessionId } from '../game/session'
import type { LearningSession } from '../types/vocabulary'
import { InstallButton } from '../pwa/PwaBar'

// 홈 화면: 처음 켤 때 기본 단어를 설치하고 학습 현황을 보여 준다
export default function HomePage({ onStart }: { onStart: () => void }) {
  const [stats, setStats] = useState<HomeStats | null>(null)
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null)
  const [sample, setSample] = useState<string[]>([])
  const [resume, setResume] = useState<'new' | 'resume' | 'done'>('new')
  const [plan, setPlan] = useState<{ total: number; review: number; fresh: number } | null>(null)
  const [history, setHistory] = useState<LearningSession[]>([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const r = await loadAndInstall(db)
      if (!alive) return
      if (!r.ok) { setError(r); return }
      setStats(await getHomeStats(db))
      const list = await getWordbookWords(db)
      const s = await db.learningSessions.get(sessionId(today()))
      setResume(s ? (s.status === 'in_progress' ? 'resume' : 'done') : 'new')
      if (s?.word_ids) { const rv = s.review_ids?.length ?? 0; setPlan({ total: s.word_ids.length, review: rv, fresh: s.word_ids.length - rv }) }
      else { const p = await planToday(db); setPlan({ total: p.word_ids.length, review: p.review.length, fresh: p.fresh.length }) }
      setHistory(await getHistory(db))
      setSample(list.slice(0, 3).map(x => `${x.word.word} – ${x.meanings[0]?.meaning ?? ''}`))
    })()
    return () => { alive = false }
  }, [])

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-6 bg-slate-50 px-5 py-10">
      <header className="text-center">
        <h1 className="text-3xl font-extrabold text-indigo-600">영단어 암기 게임</h1>
        <p className="mt-2 text-slate-500">
          {stats ? `${stats.wordbookName} · ${stats.totalWords}단어` : error ? '' : '단어를 준비하고 있어요…'}
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
          <p className="font-bold">{error.message}</p>
          <ul className="mt-2 list-disc pl-5">{error.details.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3">
        <StatCard label="오늘의 학습 단어" value={plan?.total ?? 0} />
        <StatCard label="아는 단어" value={stats?.knownWords ?? 0} />
        <StatCard label="오늘 복습 단어" value={plan?.review ?? 0} />
        <StatCard label="마지막 학습" value={stats?.lastDate ?? '-'} />
      </section>

      {plan && <p className="-mt-3 text-center text-sm text-slate-500" data-testid="plan">오늘: 복습 {plan.review}개 + 새 단어 {plan.fresh}개 (섞어서 나와요)</p>}

      {history.length > 0 && (
        <section data-testid="history">
          <h2 className="mb-2 font-bold text-slate-700">날짜별 학습 기록</h2>
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white text-sm shadow-sm ring-1 ring-slate-200">
            {history.slice(0, 14).map(h => (
              <li key={h.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-semibold text-slate-700">{h.session_date}</span>
                {h.summary
                  ? <span className="text-slate-500">{h.summary.total}단어 · 복습 {h.summary.review} · 한 번에 {h.summary.studied ? Math.round(h.summary.firstTry / h.summary.studied * 100) : 100}% · 취약 {h.summary.weak_ids.length}</span>
                  : <span className="text-amber-600">{h.status === 'completed' ? '완료' : `진행 중 (${Math.min(h.current_stage, 4)}단계)`}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sample.length > 0 && (
        <p className="text-center text-sm text-slate-400">예: {sample.join(' · ')}</p>
      )}

      <button
        type="button"
        disabled={!stats}
        onClick={onStart}
        className="mt-auto rounded-2xl bg-indigo-600 py-5 text-xl font-bold text-white shadow-lg active:scale-95 disabled:opacity-40"
      >
        {resume === 'resume' ? '이어서 학습' : resume === 'done' ? '오늘 결과 보기' : '학습 시작'}
      </button>
      <InstallButton />
    </main>
  )
}
