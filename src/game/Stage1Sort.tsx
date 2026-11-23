import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { db } from '../db/database'
import type { LearningSession } from '../types/vocabulary'
import { decideCard, getOrCreateSession, getTodayTrash, getTodayWords, restartStage1, restoreWord, type GameWord } from './session'

// 게임 1단계: 아는 단어 솎아내기
export default function Stage1Sort({ onHome, onNextStage }: { onHome: () => void; onNextStage: (s: LearningSession) => void }) {
  const [session, setSession] = useState<LearningSession | null>(null)
  const [words, setWords] = useState<GameWord[]>([])
  const [trash, setTrash] = useState<GameWord[]>([])
  const [showTrash, setShowTrash] = useState(false)
  const [overTrash, setOverTrash] = useState(false)
  const [exit, setExit] = useState<'up' | 'side'>('side')
  const busy = useRef(false)

  useEffect(() => {
    ;(async () => {
      const s = await getOrCreateSession(db)
      const w = await getTodayWords(db)
      setSession(s); setWords(w); setTrash(await getTodayTrash(db, w))
    })()
  }, [])

  if (!session) return <p className="p-10 text-center text-slate-500">불러오는 중…</p>

  const total = words.length
  const done = session.current_stage >= 2
  const card = done ? null : words[session.current_index]

  async function decide(known: boolean) {
    if (!card || !session || busy.current) return
    busy.current = true
    setExit(known ? 'up' : 'side')
    const s = await decideCard(db, session, card.word.id, known, total)
    setSession(s); setTrash(await getTodayTrash(db, words)); setOverTrash(false)
    busy.current = false
  }
  async function restore(id: string) {
    await restoreWord(db, session!.wordbook_id, id)
    setTrash(await getTodayTrash(db, words))
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col bg-slate-50 px-5 py-6 select-none">
      <div className="flex items-center justify-between">
        <button onClick={onHome} className="rounded-lg px-3 py-2 text-slate-500 active:bg-slate-200">← 홈</button>
        <span className="text-sm font-semibold text-slate-500">1단계 · 아는 단어 솎아내기</span>
        <span className="w-12 text-right text-sm text-slate-400">{done ? total : session.current_index + 1}/{total}</span>
      </div>

      {/* 휴지통 영역 */}
      <button
        type="button" data-testid="trash"
        onClick={() => setShowTrash(v => !v)}
        className={`mt-4 flex h-24 flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-colors ${overTrash ? 'border-rose-500 bg-rose-100 text-rose-600' : 'border-slate-300 bg-white text-slate-400'}`}
      >
        <span className="text-3xl">🗑️</span>
        <span className="text-sm">아는 단어는 위로 던지세요 · 휴지통 {trash.length}개 (눌러서 보기)</span>
      </button>

      {showTrash && (
        <div className="mt-3 max-h-60 overflow-y-auto rounded-2xl bg-white p-3 ring-1 ring-slate-200">
          {trash.length === 0 ? <p className="text-center text-sm text-slate-400">비어 있어요</p> : trash.map(t => (
            <div key={t.word.id} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
              <span><b>{t.word.word}</b> <span className="text-slate-500">{t.meanings[0]?.meaning}</span></span>
              <button onClick={() => restore(t.word.id)} className="rounded-lg bg-slate-100 px-3 py-1 text-sm text-indigo-600 active:bg-slate-200">복원</button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex flex-1 items-center justify-center py-8">
        {total === 0 ? (
          <p className="text-center text-slate-500">오늘 학습할 단어가 없어요. 모두 아는 단어예요!</p>
        ) : done ? (
          <div className="text-center" data-testid="stage1-done">
            <p className="text-2xl font-bold text-slate-800">1단계 끝!</p>
            <p className="mt-2 text-slate-500">아는 단어 {trash.length}개 · 학습할 단어 {total - trash.length}개</p>
            <div className="mt-6 flex justify-center gap-3">
              <button onClick={async () => setSession(await restartStage1(db, session))} className="rounded-xl bg-white px-4 py-3 text-indigo-600 ring-1 ring-slate-200">1단계 다시 보기</button>
              <button onClick={() => onNextStage(session)} className="rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white">2단계 시작 →</button>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout" custom={exit}>
            {card && <Card key={card.word.id} text={card.word.word} review={!!session.review_ids?.includes(card.word.id)} onKnown={() => decide(true)} onNext={() => decide(false)} onOver={setOverTrash} />}
          </AnimatePresence>
        )}
      </div>

      {!done && total > 0 && (
        <div className="grid grid-cols-2 gap-3 pb-2">
          <button onClick={() => decide(true)} className="rounded-2xl bg-rose-500 py-4 text-lg font-bold text-white active:scale-95">알아요 ↑</button>
          <button onClick={() => decide(false)} className="rounded-2xl bg-indigo-600 py-4 text-lg font-bold text-white active:scale-95">몰라요 →</button>
        </div>
      )}
    </main>
  )
}

const variants = {
  exit: (dir: 'up' | 'side') => (dir === 'up' ? { y: -500, opacity: 0, scale: 0.6, transition: { duration: 0.3 } } : { x: 400, opacity: 0, transition: { duration: 0.25 } }),
}

function Card({ text, review, onKnown, onNext, onOver }: { text: string; review: boolean; onKnown: () => void; onNext: () => void; onOver: (v: boolean) => void }) {
  const y = useMotionValue(0)
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-12, 12])
  function onDrag(_: unknown, info: PanInfo) { onOver(info.offset.y < -120) }
  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y < -120 || info.velocity.y < -800) onKnown()          // 위로 던지기 → 휴지통
    else if (Math.abs(info.offset.x) > 120) onNext()                       // 옆으로 넘기기 → 다음
    else onOver(false)
  }
  return (
    <motion.div
      data-testid="card"
      drag dragSnapToOrigin dragElastic={0.9}
      style={{ x, y, rotate }}
      onDrag={onDrag} onDragEnd={onDragEnd}
      initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      variants={variants} exit="exit"
      className={`relative flex h-64 w-full max-w-xs cursor-grab touch-none items-center justify-center break-words rounded-3xl bg-white px-5 text-center font-extrabold leading-tight text-slate-800 shadow-xl ring-1 ring-slate-200 active:cursor-grabbing ${text.length > 18 ? 'text-2xl' : text.length > 10 ? 'text-3xl' : 'text-5xl'}`}
    >
      {review && <span data-testid="review-badge" className="absolute left-4 top-4 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">복습</span>}
      {text}
    </motion.div>
  )
}
