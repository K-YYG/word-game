import { DEFAULT_DB_NAME, switchDatabase } from './database';

// PC 버전: 이름을 넣으면 그 사람 데이터(기기 안 DB)만 불러온다.
// - 사람마다 DB를 따로 둠: VocabularyGameDB-p-<이름>
// - 이름 목록은 이 PC에만 저장(다른 기기와 공유 안 함)
// - 휴대폰(화면 폭 1024px 미만)은 예전처럼 한 사람용
const LIST = 'wordgame.profiles';
const CUR = 'wordgame.profile';
export const PC_MIN_WIDTH = 1024;

export function isPC(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('mode');
    if (q === 'pc') return true;
    if (q === 'phone') return false;
    return window.matchMedia(`(min-width: ${PC_MIN_WIDTH}px)`).matches;
  } catch { return false; }
}

let current: string | null = null;
export const currentProfile = () => current;
// 사람마다 따로 기억할 값(고른 단어장 등)의 이름 뒤에 붙임
export const storageSuffix = () => (current ? `:${current}` : '');
export const dbNameFor = (name: string) => `${DEFAULT_DB_NAME}-p-${encodeURIComponent(name)}`;
export const cleanName = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, 20);

export function listProfiles(): string[] {
  try { const v = JSON.parse(localStorage.getItem(LIST) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch { return []; }
}
function saveList(list: string[]) { try { localStorage.setItem(LIST, JSON.stringify(list)); } catch { /* 저장 못 해도 이번에는 동작 */ } }

// 그 사람으로 들어가기(최근 사람이 목록 맨 앞)
export function openProfile(raw: string): string | null {
  const name = cleanName(raw);
  if (!name) return null;
  saveList([name, ...listProfiles().filter(n => n !== name)]);
  current = name;
  try { sessionStorage.setItem(CUR, name); } catch { /* 새로고침하면 다시 이름을 물음 */ }
  switchDatabase(dbNameFor(name));
  return name;
}

// 사람 바꾸기: 지금 사람에서 나감(데이터는 그대로 남음)
export function closeProfile() {
  current = null;
  try { sessionStorage.removeItem(CUR); } catch { /* 무시 */ }
  switchDatabase(DEFAULT_DB_NAME);
}

// 이름 목록에서만 빼기(학습 기록은 지우지 않음 – 같은 이름을 다시 넣으면 이어짐)
export function hideProfile(name: string) { saveList(listProfiles().filter(n => n !== name)); }

// 같은 창에서 새로고침했을 때는 그 사람 그대로
export function restoreProfile(): string | null {
  try { const n = sessionStorage.getItem(CUR); return n ? openProfile(n) : null; } catch { return null; }
}
