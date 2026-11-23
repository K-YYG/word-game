import type { VocabularyDB } from './database';
import type { Word, WordMeaning } from '../types/vocabulary';
import { storageSuffix } from './profile';

export const DEFAULT_WORDBOOK_ID = 'B0001';

// 지금 고른 단어장(이 기기에 기억). 저장 공간을 못 쓰는 환경이면 기본 단어장
const KEY = 'wordgame.wordbook';
export function currentWordbookId(): string {
  try { return localStorage.getItem(KEY + storageSuffix()) || DEFAULT_WORDBOOK_ID; } catch { return DEFAULT_WORDBOOK_ID; }
}
export function setCurrentWordbookId(id: string) {
  try { localStorage.setItem(KEY + storageSuffix(), id); } catch { /* 기억 못 해도 동작에는 문제 없음 */ }
}

// 기기 현지 날짜 YYYY-MM-DD
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface HomeStats { wordbookName: string; totalWords: number; todayWords: number; knownWords: number; reviewWords: number; lastDate: string | null }

export async function getHomeStats(db: VocabularyDB, wordbookId = currentWordbookId()): Promise<HomeStats> {
  const book = await db.wordbooks.get(wordbookId);
  const totalWords = await db.wordbookItems.where('wordbook_id').equals(wordbookId).count();
  const progress = await db.learningProgress.where('wordbook_id').equals(wordbookId).toArray();
  const t = today();
  const studiedToday = new Set(progress.filter(p => p.last_studied_at === t).map(p => p.word_id));
  const lastDate = progress.reduce<string | null>((a, p) => (p.last_studied_at && (!a || p.last_studied_at > a) ? p.last_studied_at : a), null);
  return {
    wordbookName: book?.name ?? '단어장 없음',
    totalWords,
    todayWords: studiedToday.size,
    knownWords: progress.filter(p => p.known).length,
    reviewWords: progress.filter(p => !p.known && !!p.last_studied_at && p.last_studied_at < t).length, // 오늘 이전에 공부했고 아직 모르는 단어 = 오늘 복습 대상
    lastDate,
  };
}

// 단어장 단어 + 뜻(순서대로) 조회
export async function getWordbookWords(db: VocabularyDB, wordbookId = currentWordbookId()): Promise<{ word: Word; meanings: WordMeaning[] }[]> {
  const items = await db.wordbookItems.where('wordbook_id').equals(wordbookId).sortBy('sort_order');
  return getWordsByIds(db, items.map(i => i.word_id));
}

// 단어 ID 목록 → 단어 + 뜻(목록 순서 유지). 큰 단어장에서도 빠르게: 뜻을 한 번에 읽어 단어별로 묶음
export async function getWordsByIds(db: VocabularyDB, ids: string[]): Promise<{ word: Word; meanings: WordMeaning[] }[]> {
  const words = await db.words.bulkGet(ids);
  const meanings = await db.wordMeanings.where('word_id').anyOf(ids).toArray();
  const by = new Map<string, WordMeaning[]>();
  for (const m of meanings) { const a = by.get(m.word_id); if (a) a.push(m); else by.set(m.word_id, [m]); }
  return words.filter((w): w is Word => !!w).map(w => ({
    word: w,
    meanings: (by.get(w.id) ?? []).sort((a, b) => a.meaning_order - b.meaning_order),
  }));
}
