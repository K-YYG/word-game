import { useEffect, useState } from 'react'
import { db } from '../db/database'
import type { LearningSession } from '../types/vocabulary'
import { completeSession, getOrCreateSession, getStage2Words, getStage4Words, saveSession, startNextRound } from './session'
import Stage1Sort from './Stage1Sort'
import Stage2Match from './Stage2Match'
import Stage3OX from './Stage3OX'
import ResultPage from './ResultPage'

const toStage3 = (s: LearningSession) => saveSession(db, s, { current_stage: 3, current_index: 0 })
const finishAll = (s: LearningSession) => completeSession(db, s)
const load2 = (s: LearningSession) => getStage2Words(db, s)
const load4 = (s: LearningSession) => getStage4Words(db, s)

// 오늘 세션의 단계에 맞는 게임 화면을 보여 준다(이어하기)
export default function GamePage({ onHome }: { onHome: () => void }) {
  const [session, setSession] = useState<LearningSession | null>(null)
  useEffect(() => { getOrCreateSession(db).then(setSession) }, [])

  if (!session) return <p className="p-10 text-center text-slate-500">불러오는 중…</p>
  if (session.word_ids && session.word_ids.length === 0) return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-3 bg-slate-50 px-5 text-center" data-testid="no-words">
      <p className="text-2xl font-bold text-slate-800">학습할 단어가 없어요</p>
      <p className="text-slate-500">이 단어장의 단어를 모두 공부했거나 '아는 단어'로 정했어요.</p>
      <button onClick={onHome} className="mt-4 rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white">홈으로</button>
    </main>
  )
  switch (session.current_stage) {
    case 1: return <Stage1Sort key={session.id} onHome={onHome} onNextStage={async s => setSession(await saveSession(db, s, { current_stage: 2, current_index: 0 }))} />
    case 2: return <Stage2Match key={session.id + "-2"} session={session} stage={2} title="2단계 · 단어와 뜻 연결" wrongNote=" → 3단계에서 다시 봐요"
      loadWords={load2} finish={toStage3} onHome={onHome} onDone={setSession} />
    case 3: return <Stage3OX key={session.id} session={session} onHome={onHome} onDone={setSession} />
    case 4: return <Stage2Match key={session.id + "-4"} session={session} stage={4} title="4단계 · 취약 단어 다시 연결" wrongNote=" (오답 횟수에 기록돼요)"
      loadWords={load4} finish={finishAll} onHome={onHome} onDone={setSession} />
    default: return <ResultPage key={session.id} session={session} onHome={onHome}
      onNextRound={async () => { const n = await startNextRound(db, session.wordbook_id); if (n) setSession(n) }} />
  }
}
