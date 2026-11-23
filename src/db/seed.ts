import type { VocabularyDB } from './database';
import type { VocabularyFile } from '../types/vocabulary';
import { validateVocabulary } from './validate';

export type SeedResult =
  | { ok: true; installed: boolean; words: number }
  | { ok: false; message: string; details: string[] };

// 단어장 목록(public/data/wordbooks.json) 한 줄
export interface BookInfo { id: string; name: string; category: string; file: string; words: number; version: string; description: string }

const BASE = import.meta.env?.BASE_URL ?? '/';

// 단어장 파일의 작은 형식(compact-1)을 원래 표 모양으로 펼친다
// w: [단어ID, 단어] · m: [단어 번호, 품사, 뜻] (뜻은 많이 나온 순서)
interface CompactFile { format: 'compact-1'; book: VocabularyFile['wordbooks'][number]; difficulty: number; created_at: string; w: [string, string][]; m: [number, string, string][] }
export function expandWordbook(data: unknown): unknown {
  const c = data as CompactFile;
  if (!c || c.format !== 'compact-1') return data;
  const b = c.book.id;
  const words = c.w.map(([id, word]) => ({ id, word, pronunciation: '', audio: null, difficulty: c.difficulty, example: '', example_meaning: '', created_at: c.created_at }));
  const order = new Map<number, number>();
  const word_meanings = c.m.map(([wi, pos, meaning], k) => {
    const n = (order.get(wi) ?? 0) + 1; order.set(wi, n);
    return { id: `M-${b}-${k + 1}`, word_id: c.w[wi]?.[0] ?? '', part_of_speech: pos, meaning, meaning_order: n };
  });
  const wordbook_items = c.w.map(([id], k) => ({ id: `BI-${b}-${k + 1}`, wordbook_id: b, word_id: id, sort_order: k + 1 }));
  return { wordbooks: [c.book], words, word_meanings, wordbook_items };
}

// 단어장 파일 하나를 기기에 넣는다.
// - 이미 같은 버전이 있으면 아무것도 바꾸지 않음
// - 버전이 다르면 그 단어장의 단어·뜻·목록만 바꿈(학습 기록은 그대로 – 단어 ID가 같으면 진도도 이어짐)
export async function installWordbook(db: VocabularyDB, raw: unknown): Promise<SeedResult> {
  const data = expandWordbook(raw);
  const errors = validateVocabulary(data);
  if (errors.length) return { ok: false, message: '단어 데이터에 문제가 있어 설치하지 않았습니다.', details: errors.slice(0, 20) };
  const v = data as VocabularyFile;
  try {
    const installed = await db.transaction('rw', [db.words, db.wordMeanings, db.wordbooks, db.wordbookItems], async () => {
      let changed = false;
      for (const book of v.wordbooks) {
        const old = await db.wordbooks.get(book.id);
        if (old && old.version === book.version) continue;
        const items = v.wordbook_items.filter(i => i.wordbook_id === book.id);
        const ids = new Set(items.map(i => i.word_id));
        await db.wordbookItems.where('wordbook_id').equals(book.id).delete();
        await db.wordMeanings.where('word_id').anyOf([...ids]).delete();
        await db.words.bulkPut(v.words.filter(w => ids.has(w.id)));
        await db.wordMeanings.bulkPut(v.word_meanings.filter(m => ids.has(m.word_id)));
        await db.wordbookItems.bulkPut(items);
        await db.wordbooks.put(book);
        changed = true;
      }
      return changed;
    });
    return { ok: true, installed, words: await db.words.count() };
  } catch (e) {
    return { ok: false, message: '단어를 기기에 저장하지 못했습니다.', details: [String(e)] };
  }
}

// 예전 이름(시험 코드용)
export const installDefaultData = installWordbook;

// 단어장 목록 읽기
export async function loadIndex(): Promise<BookInfo[]> {
  const res = await fetch(`${BASE}data/wordbooks.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).books as BookInfo[];
}

// 고른 단어장이 기기에 없거나 예전 버전이면 받아서 넣는다(인터넷이 없어도 미리 저장된 파일 사용)
export async function ensureWordbook(db: VocabularyDB, info: BookInfo): Promise<SeedResult> {
  const have = await db.wordbooks.get(info.id).catch(() => undefined);
  if (have && have.version === info.version) return { ok: true, installed: false, words: info.words };
  let data: unknown;
  try {
    const res = await fetch(`${BASE}${info.file}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    if (have) return { ok: true, installed: false, words: info.words };
    return { ok: false, message: `단어장 파일(${info.file})을 읽지 못했습니다.`, details: [String(e)] };
  }
  return installWordbook(db, data);
}
