import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { db } from '../db/database'
import type { LearningSession } from '../types/vocabulary'
import { getSessionResult, MAX_ROUNDS_PER_DAY } from './session'
import { loadExamples, type Example } from '../db/seed'
import { isPC } from '../db/profile'

const SHOW_EXAMPLES = isPC()

type Result = Awaited<ReturnType<typeof getSessionResult>>

// 오늘 학습 최종 결과
export default function ResultPage({ session, onHome, onNextRound }: { session: LearningSession; onHome: () => void; onNextRound?: () => void }) {
  const round = session.round ?? 1
  const last = round >= MAX_ROUNDS_PER_DAY
  const [r, setR] = useState<Result | null>(null)
  const [ex, setEx] = useState<Map<string, Example> | null>(null)
  useEffect(() => { getSessionResult(db, session).then(setR) }, [session])
  // PC 버전: 틀린 단어마다 예문(영어 + 해석)을 함께 보여 줌
  useEffect(() => { if (SHOW_EXAMPLES) loadExamples(session.wordbook_id).then(setEx) }, [session])
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
      <h2 className="mt-6 font-bold text-slate-700">이번 회차에 틀린 단어 <span className="text-rose-500">{r.wrongWords.length}개</span></h2>
      {r.wrongWords.length === 0
        ? <p className="mt-1 text-sm text-slate-400">하나도 안 틀렸어요. 아주 잘했어요!</p>
        : <ul className="mt-2 flex flex-col gap-2" data-testid="wrong-list">
            {r.wrongWords.map(({ w, s2, x3, s4 }) => (
              <li key={w.word.id} className="rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-rose-100">
                <div className="flex items-baseline gap-2"><b className="text-rose-600">{w.word.word}</b><span className="text-sm text-slate-600">{w.meanings[0]?.meaning}</span></div>
                {SHOW_EXAMPLES && <ExampleLine e={ex?.get(w.word.id)} loading={!ex} />}
                <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-semibold">
                  {s2 > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">연결 {s2}번</span>}
                  {x3 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">O/X에서 X</span>}
                  {s4 > 0 && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-700">다시 연결 {s4}번</span>}
                </div>
              </li>
            ))}
          </ul>}
      <p className="mt-4 text-xs text-slate-400">휴지통에 넣지 않은 단어는 다음에 학습할 때 복습 단어로 다시 나와요.</p>
      {last
        ? <p className="mt-6 rounded-xl bg-emerald-50 py-3 text-center font-bold text-emerald-700" data-testid="day-done">오늘 학습 {MAX_ROUNDS_PER_DAY}회 모두 끝! 내일 또 만나요 👋</p>
        : onNextRound && <button onClick={onNextRound} data-testid="next-round" className="mt-6 rounded-xl bg-indigo-600 py-3 font-bold text-white">{round + 1}회차 시작 →</button>}
      <button onClick={onHome} className={`mt-3 rounded-xl py-3 font-bold ${last ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 ring-1 ring-slate-200'}`}>홈으로</button>
    </main>
  )
}

// 예문 한 줄: 자료 문장이면 [자료] 표시(AI가 만든 문장은 표시 없음). 해석이 아직 없으면 '해석 준비 중'
function ExampleLine({ e, loading }: { e?: Example; loading: boolean }) {
  if (loading) return <p className="mt-1 text-sm text-slate-300">예문 불러오는 중…</p>
  if (!e) return <p className="mt-1 text-sm text-slate-300" data-testid="no-example">예문 준비 중</p>
  return (
    <div className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2" data-testid="example">
      <p className="text-[15px] text-slate-800">{e.en}
        {!e.ai && <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 align-middle text-[10px] font-bold text-emerald-700">자료</span>}
      </p>
      <p className="text-sm text-slate-500">{e.ko || '해석 준비 중'}</p>
    </div>
  )
}
