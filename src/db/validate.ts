import type { VocabularyFile } from '../types/vocabulary';

// 기본 데이터 검사: 문제가 있으면 오류 목록을 돌려줌(빈 배열이면 정상)
export function validateVocabulary(data: unknown): string[] {
  const errors: string[] = [];
  const d = data as Partial<VocabularyFile>;
  for (const key of ['wordbooks', 'words', 'word_meanings', 'wordbook_items'] as const) {
    if (!Array.isArray(d?.[key])) errors.push(`"${key}" 목록이 없습니다.`);
  }
  if (errors.length) return errors;
  const v = d as VocabularyFile;

  const dup = (ids: string[], name: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (!id) errors.push(`${name}에 ID가 빈 항목이 있습니다.`);
      else if (seen.has(id)) errors.push(`${name} ID가 중복됩니다: ${id}`);
      seen.add(id);
    }
    return seen;
  };
  const bookIds = dup(v.wordbooks.map(b => b.id), '단어장');
  const wordIds = dup(v.words.map(w => w.id), '단어');
  dup(v.word_meanings.map(m => m.id), '뜻');
  dup(v.wordbook_items.map(i => i.id), '단어장 구성');

  for (const w of v.words) if (!w.word?.trim()) errors.push(`단어 ${w.id}의 영어 단어가 비어 있습니다.`);
  for (const m of v.word_meanings) {
    if (!wordIds.has(m.word_id)) errors.push(`뜻 ${m.id}가 없는 단어(${m.word_id})를 가리킵니다.`);
    if (!m.meaning?.trim()) errors.push(`뜻 ${m.id}의 한국어 뜻이 비어 있습니다.`);
  }
  for (const i of v.wordbook_items) {
    if (!bookIds.has(i.wordbook_id)) errors.push(`단어장 구성 ${i.id}가 없는 단어장(${i.wordbook_id})을 가리킵니다.`);
    if (!wordIds.has(i.word_id)) errors.push(`단어장 구성 ${i.id}가 없는 단어(${i.word_id})를 가리킵니다.`);
  }
  const hasMeaning = new Set(v.word_meanings.map(m => m.word_id));
  for (const w of v.words) if (!hasMeaning.has(w.id)) errors.push(`단어 ${w.word}(${w.id})에 뜻이 없습니다.`);
  return errors;
}
