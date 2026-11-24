import { useEffect, useState } from 'react'
import StatCard from '../components/StatCard'
import { db } from '../db/database'
import { ensureWordbook, loadIndex, type BookInfo } from '../db/seed'
import { currentWordbookId, getHomeStats, getWordsByIds, setCurrentWordbookId, today, type HomeStats } from '../db/queries'
import { getHistory, getTodayState, MAX_ROUNDS_PER_DAY, planToday, startNextRound, WORDS_PER_ROUND } from '../game/session'
import type { LearningSession } from '../types/vocabulary'
import { InstallButton } from '../pwa/PwaBar'
import { GrassScene, Logo } from '../components/Cats'

// 홈 화면: 처음 켤 때 기본 단어를 설치하고 학습 현황을 보여 준다
export default function HomePage({ onStart }: { onStart: () => void }) {
  const [stats, setStats] = useState<HomeStats | null>(null)
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null)
  const [sample, setSample] = useState<string[]>([])
  const [resume, setResume] = useState<'new' | 'resume' | 'next' | 'done'>('new')
  const [round, setRound] = useState(1)
  const [plan, setPlan] = useState<{ total: number; review: number; fresh: number; waiting: number } | null>(null)
  const [history, setHistory] = useState<LearningSession[]>([])
  const [books, setBooks] = useState<BookInfo[]>([])
  const [bookId, setBookId] = useState(currentWordbookId())
  const [loading, setLoading] = useState(true)
  const [prep, setPrep] = useState<{ pct: number; label: string } | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true); setStats(null); setError(null); setPlan(null); setSample([]); setHistory([]); setPrep(null)
    ;(async () => {
      let idx: BookInfo[]
      try { idx = await loadIndex() } catch (e) { if (alive) setError({ message: '단어장 목록을 읽지 못했습니다.', details: [String(e)] }); return }
      if (!alive) return
      setBooks(idx)
      const info = idx.find(b => b.id === bookId) ?? idx[0]
      if (info.id !== bookId) { setCurrentWordbookId(info.id); setBookId(info.id); return }
      const r = await ensureWordbook(db, info, (pct, label) => { if (alive) setPrep({ pct, label }) })
      if (!alive) return
      setPrep(null)
      if (!r.ok) { setError(r); return }
      setStats(await getHomeStats(db))
      const first = (await db.wordbookItems.where('wordbook_id').equals(info.id).sortBy('sort_order')).slice(0, 3).map(i => i.word_id)
      const list = await getWordsByIds(db, first)
      const st = await getTodayState(db)
      const s = st.last
      setResume(!s ? 'new' : s.status === 'in_progress' ? 'resume' : st.canStartNext ? 'next' : 'done')
      setRound(!s ? 1 : s.status === 'in_progress' ? st.round : st.canStartNext ? st.round + 1 : st.round)
      if (s && s.status === 'in_progress' && s.word_ids) { const rv = s.review_ids?.length ?? 0; setPlan({ total: s.word_ids.length, review: rv, fresh: s.word_ids.length - rv, waiting: 0 }) }
      else if (!s || st.canStartNext) { const p = await planToday(db, info.id, today(), st.round + 1, st.rounds.flatMap(r => r.word_ids ?? [])); setPlan({ total: p.word_ids.length, review: p.review.length, fresh: p.fresh.length, waiting: p.waiting }) }
      else setPlan(null)
      setHistory(await getHistory(db))
      setSample(list.slice(0, 3).map(x => `${x.word.word} – ${x.meanings[0]?.meaning ?? ''}`))
      setLoading(false)
    })()
    return () => { alive = false }
  }, [bookId, retry])

  function choose(id: string) {
    if (id === bookId || loading) return
    setCurrentWordbookId(id); setBookId(id)
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-6 bg-slate-50 px-5 py-10">
      <header className="text-center">
        <h1><Logo /><span className="sr-only">VOCA CAT</span></h1>
        <p className="mt-2 text-slate-500">
          {stats ? `${stats.wordbookName} · ${stats.totalWords}단어` : error ? '' : '단어장을 준비하고 있어요…'}
        </p>
      </header>

      {books.length > 1 && (
        <nav className="-mt-2 flex gap-2" data-testid="book-picker" aria-label="단어장 고르기">
          {books.map(b => (
            <button key={b.id} data-testid={`book-${b.id}`} onClick={() => choose(b.id)} disabled={loading && b.id !== bookId}
              aria-pressed={b.id === bookId}
              className={`flex-1 rounded-2xl px-2 py-3 text-center ring-1 transition-colors ${b.id === bookId ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-700 ring-slate-200'} disabled:opacity-50`}>
              <span className="block text-lg font-bold">{b.category}</span>
              <span className={`block text-xs ${b.id === bookId ? 'text-indigo-100' : 'text-slate-400'}`}>{b.words.toLocaleString()}단어</span>
            </button>
          ))}
        </nav>
      )}

      {error && (
        <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
          <p className="font-bold">{error.message}</p>
          <ul className="mt-2 list-disc pl-5">{error.details.map((d, i) => <li key={i}>{d}</li>)}</ul>
          <button onClick={() => setRetry(n => n + 1)} data-testid="retry" className="mt-3 rounded-xl bg-red-600 px-4 py-2 font-bold text-white">다시 시도</button>
        </div>
      )}

      {prep && !error && (
        <div role="status" data-testid="preparing" className="rounded-2xl bg-amber-50 p-4 text-center ring-1 ring-amber-200">
          <p className="text-lg font-bold text-amber-800">📚 {books.find(b => b.id === bookId)?.category ?? ''} 단어장 준비 중… {prep.pct}%</p>
          <p className="mt-1 text-sm text-amber-700">{prep.label} · 처음 한 번만 10~20초 걸려요. 잠시만 기다려 주세요</p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-amber-100"><div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${prep.pct}%` }} /></div>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3">
        <StatCard label={`${round}회차 학습 단어`} value={plan?.total ?? 0} />
        <StatCard label="아는 단어" value={stats?.knownWords ?? 0} />
        <StatCard label="그중 복습 단어" value={plan?.review ?? 0} />
        <StatCard label="마지막 학습" value={stats?.lastDate ? stats.lastDate.slice(5) : '-'} />
      </section>

      <p className="-mt-3 text-center text-sm text-slate-500" data-testid="plan">
        {resume === 'done'
          ? `오늘 ${MAX_ROUNDS_PER_DAY}회 학습을 모두 마쳤어요. 내일 또 만나요!`
          : plan && <>{round}회차: 복습 {plan.review}개 + 새 단어 {plan.fresh}개 (한 번에 {WORDS_PER_ROUND}개 · 하루 {MAX_ROUNDS_PER_DAY}회){plan.waiting > plan.review && <span className="block text-xs text-amber-600">밀린 복습 단어 {plan.waiting}개 – 틀린 횟수가 많은 단어부터 나와요</span>}</>}
      </p>

      {history.length > 0 && (
        <section data-testid="history">
          <h2 className="mb-2 font-bold text-slate-700">날짜별 학습 기록</h2>
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white text-sm shadow-sm ring-1 ring-slate-200">
            {history.slice(0, 20).map(h => (
              <li key={h.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-semibold text-slate-700">{h.session_date.slice(5)} <span className="text-indigo-500">{h.round ?? 1}회</span></span>
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

      <div className="mt-auto -mx-5"><GrassScene /></div>

      <button
        type="button"
        disabled={!stats || loading}
        onClick={async () => { if (resume === 'next') await startNextRound(db, bookId); onStart() }}
        className="-mt-4 rounded-2xl bg-indigo-600 py-5 text-xl font-bold text-white shadow-lg active:scale-95 disabled:opacity-40"
      >
        {resume === 'resume' ? `이어서 학습 (${round}회차)` : resume === 'next' ? `${round}회차 시작` : resume === 'done' ? '오늘 학습 끝 · 결과 보기' : '학습 시작'}
      </button>
      <InstallButton />
    </main>
  )
}
