import type { VocabularyDB } from './database';
import type { VocabularyFile } from '../types/vocabulary';
import { validateVocabulary } from './validate';

export type SeedResult =
  | { ok: true; installed: boolean; words: number }
  | { ok: false; message: string; details: string[] };

// DB가 비어 있을 때만 기본 단어를 넣는다. 이미 있으면 아무것도 바꾸지 않는다(학습 기록 보존).
export async function installDefaultData(db: VocabularyDB, data: unknown): Promise<SeedResult> {
  const errors = validateVocabulary(data);
  if (errors.length) return { ok: false, message: '기본 단어 데이터에 문제가 있어 설치하지 않았습니다.', details: errors.slice(0, 20) };
  const v = data as VocabularyFile;
  try {
    const installed = await db.transaction('rw', [db.words, db.wordMeanings, db.wordbooks, db.wordbookItems], async () => {
      if ((await db.words.count()) > 0) return false;
      await db.wordbooks.bulkAdd(v.wordbooks);
      await db.words.bulkAdd(v.words);
      await db.wordMeanings.bulkAdd(v.word_meanings);
      await db.wordbookItems.bulkAdd(v.wordbook_items);
      return true;
    });
    return { ok: true, installed, words: await db.words.count() };
  } catch (e) {
    return { ok: false, message: '단어를 기기에 저장하지 못했습니다.', details: [String(e)] };
  }
}

// 앱에서 사용: public/data/vocabulary.json을 읽어 설치
export async function loadAndInstall(db: VocabularyDB, url = `${import.meta.env.BASE_URL}data/vocabulary.json`): Promise<SeedResult> {
  let data: unknown;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    if ((await db.words.count().catch(() => 0)) > 0) return { ok: true, installed: false, words: await db.words.count() };
    return { ok: false, message: '기본 단어 파일(vocabulary.json)을 읽지 못했습니다.', details: [String(e)] };
  }
  return installDefaultData(db, data);
}
