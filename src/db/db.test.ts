// 2단계 DB 시험(작업 공간용): npm run test:db
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { VocabularyDB } from './database'
import { installDefaultData } from './seed'
import { getWordbookWords, getHomeStats } from './queries'
import { validateVocabulary } from './validate'

const data = JSON.parse(readFileSync('public/data/vocabulary.json', 'utf8'))
const db = new VocabularyDB('test-db')
const r1 = await installDefaultData(db, data)
// 학습 기록 하나를 넣은 뒤 다시 설치 → 단어·기록이 그대로여야 함
await db.learningProgress.add({ id: 'P1', wordbook_id: 'B0001', word_id: 'W000001', known: true, correct_count: 0, wrong_count: 0, last_stage: 1, last_studied_at: '2026-11-22', updated_at: '2026-11-22' })
db.close(); const db2 = new VocabularyDB('test-db')  // 앱 다시 실행
const r2 = await installDefaultData(db2, data)
const list = await getWordbookWords(db2)
const bad = structuredClone(data); bad.word_meanings[0].word_id = 'W999999'
const out = {
  firstInstall: r1, secondRun: r2,
  counts: { words: await db2.words.count(), meanings: await db2.wordMeanings.count(), wordbooks: await db2.wordbooks.count(), items: await db2.wordbookItems.count(), progress: await db2.learningProgress.count() },
  allWordsHaveMeaning: list.length === 100 && list.every(x => x.meanings.length > 0),
  first3: list.slice(0, 3).map(x => `${x.word.id} ${x.word.word} = ${x.meanings.map(m => m.part_of_speech + ' ' + m.meaning).join(' / ')}`),
  stats: await getHomeStats(db2),
  brokenDataErrors: validateVocabulary(bad),
  brokenDataInstall: await installDefaultData(new VocabularyDB('broken-db'), bad),
}
console.log(JSON.stringify(out, null, 1))
