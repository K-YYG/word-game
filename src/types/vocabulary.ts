// 영단어 게임 데이터 타입 (지침 4·5장 기준)
export interface Word {
  id: string;
  word: string;
  pronunciation: string;
  audio: string | null;
  difficulty: number;
  example: string;
  example_meaning: string;
  created_at: string;
}

export interface WordMeaning {
  id: string;
  word_id: string;
  part_of_speech: string;
  meaning: string;
  meaning_order: number;
}

export interface Wordbook {
  id: string;
  name: string;
  category: string;
  description: string;
  version: string;
  is_active: boolean;
}

export interface WordbookItem {
  id: string;
  wordbook_id: string;
  word_id: string;
  sort_order: number;
}

export interface LearningProgress {
  id: string;
  wordbook_id: string;
  word_id: string;
  known: boolean;
  correct_count: number;
  wrong_count: number;
  last_stage: number;
  last_studied_at: string | null;
  updated_at: string;
}

export interface LearningSession {
  id: string;
  wordbook_id: string;
  session_date: string;
  status: 'in_progress' | 'completed';
  started_at: string;
  completed_at: string | null;
  current_stage: number;
  current_index: number;
  // 6단계 추가(색인 없는 칸이라 DB 버전은 그대로)
  round?: number;           // 오늘 몇 번째 학습(1·2회차, 없으면 1)
  word_ids?: string[];      // 오늘 카드 순서(복습+새 단어 섞음) – 하루 동안 고정
  review_ids?: string[];    // 그중 복습 단어
  summary?: SessionSummary; // 학습을 마칠 때 저장하는 날짜별 결과
}

export interface SessionSummary {
  total: number; review: number; fresh: number; known: number; studied: number;
  firstTry: number; wrong2: number; x3: number; wrong4: number; weak_ids: string[];
}

export interface LearningAnswer {
  id: string;
  session_id: string;
  word_id: string;
  stage: number;
  is_correct: boolean;
  response_time_ms: number;
  answered_at: string;
}

// public/data/vocabulary.json 파일 모양
export interface VocabularyFile {
  wordbooks: Wordbook[];
  words: Word[];
  word_meanings: WordMeaning[];
  wordbook_items: WordbookItem[];
}
