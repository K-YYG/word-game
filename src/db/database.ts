import Dexie, { type Table } from 'dexie';
import type {
  Word, WordMeaning, Wordbook, WordbookItem,
  LearningProgress, LearningSession, LearningAnswer,
} from '../types/vocabulary';

// 기기 안(IndexedDB)에 저장되는 앱 DB – 버전 1
export class VocabularyDB extends Dexie {
  words!: Table<Word, string>;
  wordMeanings!: Table<WordMeaning, string>;
  wordbooks!: Table<Wordbook, string>;
  wordbookItems!: Table<WordbookItem, string>;
  learningProgress!: Table<LearningProgress, string>;
  learningSessions!: Table<LearningSession, string>;
  learningAnswers!: Table<LearningAnswer, string>;

  constructor(name = 'VocabularyGameDB') {
    super(name);
    this.version(1).stores({
      words: 'id, word, difficulty',
      wordMeanings: 'id, word_id, part_of_speech',
      wordbooks: 'id, category, is_active',
      wordbookItems: 'id, [wordbook_id+word_id], wordbook_id, word_id, sort_order',
      learningProgress: 'id, [wordbook_id+word_id], wordbook_id, word_id, known',
      learningSessions: 'id, [wordbook_id+session_date], session_date, status',
      learningAnswers: 'id, session_id, word_id, stage, answered_at',
    });
  }
}

export const db = new VocabularyDB();
