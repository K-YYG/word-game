// DB 시험(작업 공간용): npm run test:db
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { VocabularyDB } from './database'
import { expandWordbook, installWordbook } from './seed'
import { getWordbookWords } from './queries'
import { validateVocabulary } from './validate'

const index = JSON.parse(readFileSync('public/data/wordbooks.json', 'utf8')).books
const file = (f: string) => JSON.parse(readFileSync('public/' + f, 'utf8'))
const db = new VocabularyDB('test-db')
const out: Record<string, unknown> = {}
// 예전 초등 100 설치 + 학습 기록 → 새 초등 900으로 바꿔도 기록과 단어 ID가 그대로인지
const old = JSON.parse(readFileSync(process.env.OLD_VOCAB ?? '/tmp/v2/old_vocabulary.json', 'utf8'))
out.old = await installWordbook(db, old)
await db.learningProgress.add({ id: 'P-B0001-W000001', wordbook_id: 'B0001', word_id: 'W000001', known: true, correct_count: 2, wrong_count: 1, last_stage: 2, last_studied_at: '2026-11-22', updated_at: '2026-11-22' })
for (const b of index.filter((x: { id: string }) => process.env.FULL || x.id !== 'B0003')) {
  const data = file(b.file)
  out[b.id + ' 검사 오류'] = validateVocabulary(expandWordbook(data)).length
  out[b.id + ' 설치'] = await installWordbook(db, data)
  out[b.id + ' 다시 설치(같은 버전)'] = (await installWordbook(db, data) as { installed: boolean }).installed
  const list = await getWordbookWords(db, b.id)
  out[b.id + ' 단어'] = [list.length, b.words, list.every(x => x.meanings.length > 0)]
}
const w1 = await db.words.get('W000001')
out['기존 W000001'] = w1?.word
out['학습 기록 유지'] = !!(await db.learningProgress.get('P-B0001-W000001'))
out['초등 옛 목록 남음'] = await db.wordbookItems.where('wordbook_id').equals('B0001').count()
out['전체 단어'] = await db.words.count()
console.log(JSON.stringify(out, null, 1))
