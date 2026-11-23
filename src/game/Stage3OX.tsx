import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { db } from '../db/database'
import type { LearningSession } from '../types/vocabulary'
import { completeSession, getSessionAnswers, getStage3Words, recordAnswer, saveSession, type GameWord } from './session'

const REVEAL_MS = 1000 // 단어를 보여 주고 뜻을 보여 주기까지 시간

// 게임 3단계: 단어 → 1초 뒤 뜻 → O(알았어요)/X(몰랐어요)
export default function Stage3OX({ session: s0, onHome, onDone }: { session: LearningSession; onHome: () => void; onDone: (s: LearningSession) => void }) {
  const [session, setSession] = useState(s0)
  const [words, setWords] = useState<GameWord[] | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [xCount, setXCount] = useState(0)
  const [reveal, setReveal] = useState(false)
  const [busy, setBusy] = useState(false)
  const shownAt = useRef(Date.now())

  useEffect(() => {
    ;(async () => {
      const w = await getStage3Words(db, s0)
      const a = await getSessionAnswers(db, s0, 3)
      setDone(new Set(a.map(x => x.word_id)))
      setXCount(new Set(a.filter(x => !x.is_correct).map(x => x.word_id)).size)
      setWords(w)
    })()
  }, [s0])

  const current = words?.find(w => !done.has(w.word.id)) ?? null

  // 다음 카드가 나오면 1초 뒤 뜻 보여 주기
  useEffect(() => {
    if (!current) return
    setReveal(false); shownAt.current = Date.now()
    const t = setTimeout(() => setReveal(true), REVEAL_MS)
    return () => clearTimeout(t)
  }, [current?.word.id])

  // 모두 끝나면: X가 있으면 4단계, 없으면 오늘 학습 끝
  useEffect(() => {
    if (!words || current) return
    ;(async () => {
      const s = xCount > 0 ? await saveSession(db, session, { current_stage: 4, current_index: 0 }) : await completeSession(db, session)
      onDone(s)
    })()
  }, [words, current, xCount, session, onDone])

  async function answer(ok: boolean) {
    if (!current || !reveal || busy) return
    setBusy(true)
    await recordAnswer(db, session, current.word.id, 3, ok, Date.now() - shownAt.current)
    const nd = new Set(done).add(current.word.id)
    setSession(await saveSession(db, session, { current_stage: 3, current_index: nd.size }))
    if (!ok) setXCount(c => c + 1)
    setDone(nd); setBusy(false)
  }

  if (!words || !current) return <p className="p-10 text-center text-slate-500">불러오는 중…</p>
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col bg-slate-50 px-4 py-6 select-none">
      <div className="flex items-center justify-between">
        <button onClick={onHome} className="rounded-lg px-3 py-2 text-slate-500 active:bg-slate-200">← 홈</button>
        <span className="text-sm font-semibold text-slate-500">3단계 · O/X 확인</span>
        <span className="w-14 text-right text-sm text-slate-400" data-testid="progress">{done.size}/{words.length}</span>
      </div>
      <p className="mt-3 text-center text-sm text-slate-500">뜻을 떠올려 본 뒤, 맞았으면 O · 몰랐으면 X</p>
      <p className="text-center text-xs text-rose-400">X {xCount}개 → 4단계에서 다시 연결해요</p>

      <div className="flex flex-1 items-center justify-center py-8">
          <motion.div key={current.word.id} data-testid="ox-card"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
            className="flex h-64 w-full flex-col items-center justify-center gap-5 rounded-3xl bg-white shadow-md ring-1 ring-slate-200">
            <p className={`px-4 text-center font-extrabold leading-tight text-slate-800 ${current.word.word.length > 14 ? 'text-2xl' : 'text-4xl'}`}>{current.word.word}</p>
            <div className="flex min-h-10 items-center">
              {reveal
                ? <motion.p data-testid="ox-meaning" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={`px-4 text-center font-semibold leading-snug text-indigo-600 ${(current.meanings[0]?.meaning ?? '').length > 14 ? 'text-lg' : 'text-2xl'}`}>{current.meanings[0]?.meaning}</motion.p>
                : <p className="text-slate-300">뜻을 떠올려 보세요…</p>}
            </div>
          </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-4 pb-2">
        <button disabled={!reveal || busy} onClick={() => answer(true)}
          className="h-20 rounded-2xl bg-emerald-500 text-4xl font-black text-white shadow disabled:opacity-30">O</button>
        <button disabled={!reveal || busy} onClick={() => answer(false)}
          className="h-20 rounded-2xl bg-rose-500 text-4xl font-black text-white shadow disabled:opacity-30">X</button>
      </div>
    </main>
  )
}
