import { useState, type FormEvent } from 'react'
import { cleanName, hideProfile, listProfiles } from '../db/profile'

// PC 버전 첫 화면: 이름을 넣거나 목록에서 골라 그 사람 데이터로 들어간다
export default function NameScreen({ onPick }: { onPick: (name: string) => void }) {
  const [name, setName] = useState('')
  const [list, setList] = useState(listProfiles)
  const [editing, setEditing] = useState(false)
  function submit(e: FormEvent) {
    e.preventDefault()
    const n = cleanName(name)
    if (n) onPick(n)
  }
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-5 bg-slate-50 px-6 py-10" data-testid="name-screen">
      <p className="text-5xl">🙋</p>
      <h1 className="text-2xl font-extrabold text-indigo-600">누가 공부하나요?</h1>
      <p className="text-center text-sm text-slate-500">이름을 넣으면 그 사람의 학습 기록만 불러와요.<br />기록은 이 컴퓨터에만 저장돼요.</p>
      <form onSubmit={submit} className="flex w-full max-w-sm gap-2">
        <input data-testid="name-input" value={name} autoFocus maxLength={20} onChange={e => setName(e.target.value)}
          placeholder="이름 (예: 김민수)" aria-label="이름"
          className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3 text-lg ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-indigo-500" />
        <button type="submit" data-testid="name-go" disabled={!cleanName(name)} className="rounded-xl bg-indigo-600 px-5 font-bold text-white disabled:opacity-40">시작</button>
      </form>
      {list.length > 0 && (
        <section className="w-full max-w-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-600">이 컴퓨터에서 공부한 사람</h2>
            <button onClick={() => setEditing(v => !v)} className="text-xs text-slate-400 underline">{editing ? '완료' : '목록 정리'}</button>
          </div>
          <ul className="grid grid-cols-2 gap-2" data-testid="name-list">
            {list.map(n => (
              <li key={n} className="relative">
                <button onClick={() => !editing && onPick(n)} data-testid={`pick-${n}`}
                  className="w-full truncate rounded-xl bg-white px-3 py-3 font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:ring-indigo-400">{n}</button>
                {editing && (
                  <button aria-label={`${n} 목록에서 빼기`} onClick={() => { hideProfile(n); setList(listProfiles()) }}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-rose-500 text-xs font-bold text-white">×</button>
                )}
              </li>
            ))}
          </ul>
          {editing && <p className="mt-2 text-xs text-slate-400">목록에서만 빠지고 학습 기록은 남아요. 같은 이름을 다시 넣으면 이어서 할 수 있어요.</p>}
        </section>
      )}
    </main>
  )
}
