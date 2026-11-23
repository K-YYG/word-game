import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { db } from '../db/database'
import type { LearningSession } from '../types/vocabulary'
import { getSessionAnswers, recordAnswer, ROUND_SIZE, saveSession, type GameWord } from './session'

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }
const meaningOf = (w: GameWord) => w.meanings[0]?.meaning ?? ''

// 게임 2단계(단어와 뜻 연결)·4단계(취약 단어 연결) 공용 화면 – 누르기로 연결 또는 끌어서 선 긋기
type Props = {
  session: LearningSession; stage: number; title: string; wrongNote: string
  loadWords: (s: LearningSession) => Promise<GameWord[]>
  finish: (s: LearningSession) => Promise<LearningSession>
  onHome: () => void; onDone: (s: LearningSession) => void
}
export default function Stage2Match({ session: s0, stage, title, wrongNote, loadWords, finish, onHome, onDone }: Props) {
  const [session, setSession] = useState(s0)
  const [all, setAll] = useState<GameWord[] | null>(null)
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set())
  const [round, setRound] = useState<{ left: GameWord[]; right: GameWord[] } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ ids: string[]; ok: boolean } | null>(null)
  const [line, setLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const roundStart = useRef(Date.now())
  const dragFrom = useRef<string | null>(null)

  // 처음: 대상 단어와 이미 맞힌 단어(이어하기) 불러오기
  useEffect(() => {
    ;(async () => {
      const words = await loadWords(s0)
      const answers = await getSessionAnswers(db, s0, stage)
      setAll(words)
      setMatched(new Set(answers.filter(a => a.is_correct).map(a => a.word_id)))
      setWrongIds(new Set(answers.filter(a => !a.is_correct).map(a => a.word_id)))
    })()
  }, [s0, stage, loadWords])

  const remaining = useMemo(() => (all ?? []).filter(w => !matched.has(w.word.id)), [all, matched])

  // 판에 남은 단어가 없으면 다음 묶음 만들기
  useEffect(() => {
    if (!all) return
    const onBoard = round?.left.filter(w => !matched.has(w.word.id)).length ?? 0
    if (onBoard > 0) return
    if (remaining.length === 0) {
      ;(async () => { const s = await finish(session); setSession(s); onDone(s) })()
      return
    }
    const next = remaining.slice(0, ROUND_SIZE)
    setRound({ left: shuffle(next), right: shuffle(next) })
    roundStart.current = Date.now()
  }, [all, matched, remaining, round, session, onDone, finish])

  const tryMatch = useCallback(async (wordId: string, meaningWordId: string) => {
    if (!all || !round) return
    const w = all.find(x => x.word.id === wordId)!, m = all.find(x => x.word.id === meaningWordId)!
    const ok = wordId === meaningWordId || meaningOf(w) === meaningOf(m) // 뜻 글자가 같으면 정답으로 인정
    const ms = Date.now() - roundStart.current
    setSelected(null)
    setFlash({ ids: [wordId, meaningWordId], ok })
    await recordAnswer(db, session, wordId, stage, ok, ms)
    if (ok) {
      const nm = new Set(matched); nm.add(wordId); if (meaningWordId !== wordId && meaningOf(w) === meaningOf(m)) nm.add(meaningWordId)
      setTimeout(() => { setMatched(nm); setFlash(null) }, 450)
      setSession(await saveSession(db, session, { current_stage: stage, current_index: nm.size }))
    } else {
      setWrongIds(prev => new Set(prev).add(wordId))
      setTimeout(() => setFlash(null), 600)
    }
  }, [all, round, session, matched, stage])

  // 끌어서 선 긋기
  const center = (el: Element) => { const b = boardRef.current!.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top } }
  function onPointerDown(e: React.PointerEvent, id: string) {
    dragFrom.current = id; setSelected(id)
    const c = center(e.currentTarget); setLine({ x1: c.x, y1: c.y, x2: c.x, y2: c.y })
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragFrom.current || !line) return
    const b = boardRef.current!.getBoundingClientRect()
    setLine({ ...line, x2: e.clientX - b.left, y2: e.clientY - b.top })
  }
  function onPointerUp(e: React.PointerEvent) {
    const from = dragFrom.current; dragFrom.current = null; setLine(null)
    if (!from) return
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-meaning]') as HTMLElement | null
    if (el) tryMatch(from, el.dataset.meaning!)
  }

  if (!all || !round) return <p className="p-10 text-center text-slate-500">불러오는 중…</p>
  const total = all.length
  const cls = (id: string, side: 'L' | 'R') => {
    if (flash?.ids.includes(id)) return flash.ok ? 'bg-emerald-500 text-white ring-emerald-500' : 'bg-rose-500 text-white ring-rose-500'
    if (side === 'L' && selected === id) return 'bg-indigo-600 text-white ring-indigo-600'
    return 'bg-white text-slate-800 ring-slate-200'
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col bg-slate-50 px-4 py-6 select-none">
      <div className="flex items-center justify-between">
        <button onClick={onHome} className="rounded-lg px-3 py-2 text-slate-500 active:bg-slate-200">← 홈</button>
        <span className="text-sm font-semibold text-slate-500">{title}</span>
        <span className="w-14 text-right text-sm text-slate-400" data-testid="progress">{matched.size}/{total}</span>
      </div>
      <p className="mt-3 text-center text-sm text-slate-500">영어 단어를 누른 뒤 뜻을 누르거나, 끌어서 뜻에 이어 주세요</p>
      <p className="text-center text-xs text-rose-400">틀린 단어 {wrongIds.size}개{wrongNote}</p>

      <div ref={boardRef} className="relative mt-4 grid flex-1 grid-cols-2 content-start gap-x-6 gap-y-3 touch-none"
        onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={() => { dragFrom.current = null; setLine(null) }}>
        <div className="flex flex-col gap-3">
          {round.left.map(w => matched.has(w.word.id) ? <div key={w.word.id} className="h-16" /> : (
            <motion.button key={w.word.id} data-word={w.word.id}
              animate={flash?.ids[0] === w.word.id && !flash.ok ? { x: [0, -8, 8, -6, 6, 0] } : flash?.ids[0] === w.word.id ? { scale: [1, 1.08, 1] } : {}}
              onPointerDown={e => onPointerDown(e, w.word.id)}
              className={`h-16 overflow-hidden rounded-2xl px-2 font-bold leading-tight shadow-sm ring-1 transition-colors ${w.word.word.length > 12 ? 'text-sm' : 'text-xl'} ${cls(w.word.id, 'L')}`}>
              {w.word.word}
            </motion.button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {round.right.map(w => matched.has(w.word.id) ? <div key={w.word.id} className="h-16" /> : (
            <motion.button key={w.word.id} data-meaning={w.word.id}
              animate={flash?.ids[1] === w.word.id && !flash.ok ? { x: [0, 8, -8, 6, -6, 0] } : {}}
              onClick={() => { if (selected && !line) tryMatch(selected, w.word.id) }}
              className={`h-16 overflow-hidden rounded-2xl px-2 font-semibold leading-tight shadow-sm ring-1 transition-colors ${meaningOf(w).length > 14 ? 'text-xs' : 'text-base'} ${cls(w.word.id, 'R')}`}>
              <span className="line-clamp-3">{meaningOf(w)}</span>
            </motion.button>
          ))}
        </div>
        {line && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <p className="pt-3 text-center text-xs text-slate-400">남은 단어 {remaining.length}개 · 한 번에 {ROUND_SIZE}개씩</p>
    </main>
  )
}
