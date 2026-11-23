import type { VocabularyDB } from '../db/database'
import type { LearningProgress, LearningSession, Word, WordMeaning } from '../types/vocabulary'
import { DEFAULT_WORDBOOK_ID, getWordbookWords, today } from '../db/queries'

// 하루에 새로 학습할 단어 수(바꾸려면 이 숫자만 고치면 됨)
export const TODAY_WORD_COUNT = 20

export interface GameWord { word: Word; meanings: WordMeaning[] }

export const sessionId = (date: string, wordbookId = DEFAULT_WORDBOOK_ID) => `S-${wordbookId}-${date}`
const progressId = (wordbookId: string, wordId: string) => `P-${wordbookId}-${wordId}`

// 같은 날짜에는 항상 같은 순서가 나오는 섞기(새로고침해도 카드 순서 유지)
function seededShuffle<T>(arr: T[], seedText: string): T[] {
  let h = 2166136261
  for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const rand = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296 }
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// ---------- 6단계: 날짜별 오늘 단어 정하기 ----------
// 복습 단어 = 오늘 이전에 공부했고(2단계로 넘어간 단어) 아직 '아는 단어'가 아닌 단어
// 새 단어 = 한 번도 공부하지 않은 단어 중 단어장의 정해진 순서로 앞의 N개
export async function planToday(db: VocabularyDB, wordbookId = DEFAULT_WORDBOOK_ID, date = today()) {
  const all = await getWordbookWords(db, wordbookId)
  const progress = await db.learningProgress.where('wordbook_id').equals(wordbookId).toArray()
  const seen = new Set(progress.map(p => p.word_id))
  const review = progress.filter(p => !p.known && p.last_studied_at && p.last_studied_at < date).map(p => p.word_id)
  const fresh = seededShuffle(all, `NEW-${wordbookId}`).filter(w => !seen.has(w.word.id)).slice(0, TODAY_WORD_COUNT).map(w => w.word.id)
  return { review, fresh, word_ids: seededShuffle([...review, ...fresh], sessionId(date, wordbookId)) }
}

// 6단계 전에 만든 세션(단어 목록 저장 안 됨)용 예전 방식
async function legacyWordIds(db: VocabularyDB, wordbookId: string, date: string) {
  const all = await getWordbookWords(db, wordbookId)
  const progress = await db.learningProgress.where('wordbook_id').equals(wordbookId).toArray()
  const knownBefore = new Set(progress.filter(p => p.known && p.last_studied_at !== date).map(p => p.word_id))
  return seededShuffle(all, sessionId(date, wordbookId)).filter(w => !knownBefore.has(w.word.id)).slice(0, TODAY_WORD_COUNT).map(w => w.word.id)
}

// 오늘 세션 가져오기(없으면 오늘 단어를 정해 새로 만듦 → 하루 동안 같은 단어·같은 순서)
export async function getOrCreateSession(db: VocabularyDB, wordbookId = DEFAULT_WORDBOOK_ID): Promise<LearningSession> {
  const date = today()
  const id = sessionId(date, wordbookId)
  const found = await db.learningSessions.get(id)
  if (found?.word_ids) return found
  if (found) { const s = { ...found, word_ids: await legacyWordIds(db, wordbookId, date), review_ids: [] }; await db.learningSessions.put(s); return s }
  const plan = await planToday(db, wordbookId, date)
  const s: LearningSession = { id, wordbook_id: wordbookId, session_date: date, status: 'in_progress', started_at: new Date().toISOString(), completed_at: null, current_stage: 1, current_index: 0, word_ids: plan.word_ids, review_ids: plan.review }
  await db.learningSessions.put(s)
  return s
}

// 세션에 저장된 단어 목록 → 단어+뜻
export async function getSessionWords(db: VocabularyDB, session: LearningSession): Promise<GameWord[]> {
  const all = await getWordbookWords(db, session.wordbook_id)
  const byId = new Map(all.map(w => [w.word.id, w]))
  return (session.word_ids ?? []).map(id => byId.get(id)).filter((w): w is GameWord => !!w)
}

// 오늘 1단계 카드 목록
export async function getTodayWords(db: VocabularyDB, wordbookId = DEFAULT_WORDBOOK_ID): Promise<GameWord[]> {
  return getSessionWords(db, await getOrCreateSession(db, wordbookId))
}

async function upsertProgress(db: VocabularyDB, wordbookId: string, wordId: string, change: Partial<LearningProgress>) {
  const id = progressId(wordbookId, wordId)
  const now = new Date().toISOString()
  const old = await db.learningProgress.get(id)
  const base: LearningProgress = old ?? { id, wordbook_id: wordbookId, word_id: wordId, known: false, correct_count: 0, wrong_count: 0, last_stage: 1, last_studied_at: null, updated_at: now }
  await db.learningProgress.put({ ...base, ...change, last_studied_at: today(), updated_at: now })
}

// 카드 한 장 처리: known=true(휴지통) 또는 false(모름 → 다음)
export async function decideCard(db: VocabularyDB, session: LearningSession, wordId: string, known: boolean, total: number): Promise<LearningSession> {
  return db.transaction('rw', [db.learningProgress, db.learningSessions], async () => {
    await upsertProgress(db, session.wordbook_id, wordId, { known, last_stage: 1 })
    const next = session.current_index + 1
    const s: LearningSession = next >= total ? { ...session, current_index: 0, current_stage: 2 } : { ...session, current_index: next }
    await db.learningSessions.put(s)
    return s
  })
}

// 휴지통에서 복원(아는 단어 → 모르는 단어)
export async function restoreWord(db: VocabularyDB, wordbookId: string, wordId: string) {
  await upsertProgress(db, wordbookId, wordId, { known: false })
}

// 오늘 휴지통(아는 단어로 넣은 단어) 목록
export async function getTodayTrash(db: VocabularyDB, words: GameWord[], wordbookId = DEFAULT_WORDBOOK_ID, date = today()): Promise<GameWord[]> {
  const ids = new Set((await db.learningProgress.where('wordbook_id').equals(wordbookId).toArray()).filter(p => p.known && p.last_studied_at === date).map(p => p.word_id))
  return words.filter(w => ids.has(w.word.id))
}

// 1단계를 처음부터 다시(오늘 정한 '아는 단어' 그대로 두고 위치만 처음으로)
export async function restartStage1(db: VocabularyDB, session: LearningSession): Promise<LearningSession> {
  const s = { ...session, current_stage: 1, current_index: 0 }
  await db.learningSessions.put(s)
  return s
}

// ---------- 2단계: 단어와 뜻 연결 ----------
export const ROUND_SIZE = 5 // 한 화면에 연결할 단어 수

// 2단계 대상: 오늘 카드 중 '아는 단어'가 아닌 것
export async function getStage2Words(db: VocabularyDB, session: LearningSession): Promise<GameWord[]> {
  const words = await getSessionWords(db, session)
  const trash = new Set((await getTodayTrash(db, words, session.wordbook_id, session.session_date)).map(w => w.word.id))
  return words.filter(w => !trash.has(w.word.id))
}

export async function getSessionAnswers(db: VocabularyDB, session: LearningSession, stage: number) {
  return (await db.learningAnswers.where('session_id').equals(session.id).toArray()).filter(a => a.stage === stage)
}

// 답 하나 기록(덮어쓰지 않고 새로 추가) + 누적 정답·오답 수
export async function recordAnswer(db: VocabularyDB, session: LearningSession, wordId: string, stage: number, isCorrect: boolean, responseTimeMs: number) {
  await db.transaction('rw', [db.learningAnswers, db.learningProgress], async () => {
    await db.learningAnswers.add({
      id: `A-${session.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      session_id: session.id, word_id: wordId, stage, is_correct: isCorrect,
      response_time_ms: Math.round(responseTimeMs), answered_at: new Date().toISOString(),
    })
    const old = await db.learningProgress.get(progressId(session.wordbook_id, wordId))
    await upsertProgress(db, session.wordbook_id, wordId, {
      last_stage: Math.max(old?.last_stage ?? 1, stage),
      correct_count: (old?.correct_count ?? 0) + (isCorrect ? 1 : 0),
      wrong_count: (old?.wrong_count ?? 0) + (isCorrect ? 0 : 1),
    })
  })
}

// 세션 단계·위치 저장
export async function saveSession(db: VocabularyDB, session: LearningSession, change: Partial<LearningSession>): Promise<LearningSession> {
  const s = { ...session, ...change }
  await db.learningSessions.put(s)
  return s
}

// ---------- 3단계 O/X · 4단계 취약 단어 ----------
const uniq = (ids: string[]) => [...new Set(ids)]

// 3단계 대상: 오늘 2단계에서 한 번이라도 틀린 단어(새로고침해도 같은 순서)
export async function getStage3Words(db: VocabularyDB, session: LearningSession): Promise<GameWord[]> {
  const wrong = new Set((await getSessionAnswers(db, session, 2)).filter(a => !a.is_correct).map(a => a.word_id))
  const words = (await getStage2Words(db, session)).filter(w => wrong.has(w.word.id))
  return seededShuffle(words, session.id + '-3')
}

// 4단계 대상: 3단계에서 X(몰랐어요)를 고른 단어
export async function getStage4Words(db: VocabularyDB, session: LearningSession): Promise<GameWord[]> {
  const x = new Set((await getSessionAnswers(db, session, 3)).filter(a => !a.is_correct).map(a => a.word_id))
  return (await getStage3Words(db, session)).filter(w => x.has(w.word.id))
}

// 오늘 학습 마치기
export async function completeSession(db: VocabularyDB, session: LearningSession): Promise<LearningSession> {
  const r = await getSessionResult(db, session)
  const { weakWords, ...rest } = r
  return saveSession(db, session, { current_stage: 5, current_index: 0, status: 'completed', completed_at: new Date().toISOString(), summary: { ...rest, weak_ids: weakWords.map(w => w.word.id) } })
}

// 날짜별 학습 기록(최근 날짜부터)
export async function getHistory(db: VocabularyDB, wordbookId = DEFAULT_WORDBOOK_ID) {
  return (await db.learningSessions.where('[wordbook_id+session_date]').between([wordbookId, ''], [wordbookId, '\uffff']).toArray()).reverse()
}

// 최종 결과 숫자
export async function getSessionResult(db: VocabularyDB, session: LearningSession) {
  const today = await getSessionWords(db, session)
  const known = await getTodayTrash(db, today, session.wordbook_id, session.session_date)
  const reviewSet = new Set(session.review_ids ?? [])
  const s2 = await getSessionAnswers(db, session, 2), s3 = await getSessionAnswers(db, session, 3), s4 = await getSessionAnswers(db, session, 4)
  const s2Words = await getStage2Words(db, session)
  const wrong2 = uniq(s2.filter(a => !a.is_correct).map(a => a.word_id))
  const x3 = uniq(s3.filter(a => !a.is_correct).map(a => a.word_id))
  const wrong4 = uniq(s4.filter(a => !a.is_correct).map(a => a.word_id))
  const name = (id: string) => today.find(w => w.word.id === id)
  return {
    total: today.length, review: today.filter(w => reviewSet.has(w.word.id)).length, fresh: today.filter(w => !reviewSet.has(w.word.id)).length, known: known.length, studied: s2Words.length,
    firstTry: s2Words.length - wrong2.length,
    wrong2: wrong2.length, x3: x3.length, wrong4: wrong4.length,
    weakWords: x3.map(name).filter((w): w is GameWord => !!w),
  }
}
