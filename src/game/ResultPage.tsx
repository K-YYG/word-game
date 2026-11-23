import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { db } from '../db/database'
import type { LearningSession } from '../types/vocabulary'
import { getSessionResult, MAX_ROUNDS_PER_DAY } from './session'

type Result = Awaited<ReturnType<typeof getSessionResult>>

// 오늘 학습 최종 결과
export default function ResultPage({ session, onHome, onNextRound }: { session: LearningSession; onHome: () => void; onNextRound?: () => void }) {
  const round = session.round ?? 1
  const last = round >= MAX_ROUNDS_PER_DAY
  const [r, setR] = useState<Result | null>(null)
  useEffect(() => { getSessionResult(db, session).then(setR) }, [session])
  if (!r) return <p className="p-10 text-center text-slate-500">불러오는 중…</p>
  const rate = r.studied ? Math.round((r.firstTry / r.studied) * 100) : 100
  const rows: [string, string | number][] = [
    ['이번에 본 단어', `${r.total} (복습 ${r.review} + 새 ${r.fresh})`], ['이미 아는 단어(휴지통)', r.known], ['연결 게임 단어', r.studied],
    ['한 번에 맞힌 단어', `${r.firstTry} (${rate}%)`], ['연결에서 틀린 단어', r.wrong2],
    ['O/X에서 X', r.x3], ['취약 단어 연결에서 또 틀림', r.wrong4],
  ]
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col bg-slate-50 px-5 py-8" data-testid="result">
      <motion.p initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center text-5xl">🎉</motion.p>
      <h1 className="mt-2 text-center text-2xl font-bold text-slate-800">{round}회차 학습 완료!</h1>
      <p className="text-center text-sm text-slate-400">{session.session_date} · 하루 {MAX_ROUNDS_PER_DAY}회 중 {round}회</p>
      <dl className="mt-6 divide-y divide-slate-100 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between px-4 py-3"><dt className="text-slate-500">{k}</dt><dd className="font-bold text-slate-800">{v}</dd></div>
        ))}
      </dl>
      <h2 className="mt-6 font-bold text-slate-700">취약 단어 {r.weakWords.length}개</h2>
      {r.weakWords.length === 0
        ? <p className="mt-1 text-sm text-slate-400">없어요. 아주 잘했어요!</p>
        : <ul className="mt-2 grid grid-cols-2 gap-2" data-testid="weak-list">
            {r.weakWords.map(w => <li key={w.word.id} className="rounded-xl bg-rose-50 px-3 py-2 text-sm"><b className="text-rose-600">{w.word.word}</b> <span className="text-slate-500">{w.meanings[0]?.meaning}</span></li>)}
          </ul>}
      <p className="mt-4 text-xs text-slate-400">휴지통에 넣지 않은 단어는 다음에 학습할 때 복습 단어로 다시 나와요.</p>
      {last
        ? <p className="mt-6 rounded-xl bg-emerald-50 py-3 text-center font-bold text-emerald-700" data-testid="day-done">오늘 학습 {MAX_ROUNDS_PER_DAY}회 모두 끝! 내일 또 만나요 👋</p>
        : onNextRound && <button onClick={onNextRound} data-testid="next-round" className="mt-6 rounded-xl bg-indigo-600 py-3 font-bold text-white">{round + 1}회차 시작 →</button>}
      <button onClick={onHome} className={`mt-3 rounded-xl py-3 font-bold ${last ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 ring-1 ring-slate-200'}`}>홈으로</button>
    </main>
  )
}
