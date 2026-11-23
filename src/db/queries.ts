import type { VocabularyDB } from './database';
import type { Word, WordMeaning } from '../types/vocabulary';

export const DEFAULT_WORDBOOK_ID = 'B0001';

// 기기 현지 날짜 YYYY-MM-DD
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface HomeStats { wordbookName: string; totalWords: number; todayWords: number; knownWords: number; reviewWords: number; lastDate: string | null }

export async function getHomeStats(db: VocabularyDB, wordbookId = DEFAULT_WORDBOOK_ID): Promise<HomeStats> {
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
export async function getWordbookWords(db: VocabularyDB, wordbookId = DEFAULT_WORDBOOK_ID): Promise<{ word: Word; meanings: WordMeaning[] }[]> {
  const items = await db.wordbookItems.where('wordbook_id').equals(wordbookId).sortBy('sort_order');
  const words = await db.words.bulkGet(items.map(i => i.word_id));
  const meanings = await db.wordMeanings.where('word_id').anyOf(items.map(i => i.word_id)).toArray();
  return words.filter((w): w is Word => !!w).map(w => ({
    word: w,
    meanings: meanings.filter(m => m.word_id === w.id).sort((a, b) => a.meaning_order - b.meaning_order),
  }));
}
