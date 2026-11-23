import { useEffect, useState } from 'react'
import HomePage from './pages/HomePage'
import GamePage from './game/GamePage'
import PwaBar from './pwa/PwaBar'
import LockScreen from './lock/LockScreen'
import NameScreen from './profile/NameScreen'
import { closeProfile, isPC, openProfile, restoreProfile } from './db/profile'

const PC = isPC()

// 화면 전환: (PC: 이름 고르기 →) 홈 ↔ 게임
export default function App() {
  const [who, setWho] = useState<string | null>(() => (PC ? restoreProfile() : null))
  const [view, setView] = useState<'home' | 'game'>('home')
  const [homeKey, setHomeKey] = useState(0)
  useEffect(() => { document.documentElement.classList.toggle('pc', PC) }, [])
  const pick = (n: string) => { const name = openProfile(n); if (name) { setWho(name); setView('home'); setHomeKey(k => k + 1) } }
  const leave = () => { closeProfile(); setWho(null); setView('home') }
  return (
    <LockScreen>
      <PwaBar />
      {PC && !who
        ? <NameScreen onPick={pick} />
        : <div key={who ?? 'phone'} className="flex min-h-full flex-col">
            {PC && (
              <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-2" data-testid="who-bar">
                <span className="text-sm text-slate-500">공부하는 사람 <b className="ml-1 text-base text-indigo-600" data-testid="who">{who}</b></span>
                <button onClick={leave} data-testid="switch-person" className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-200">사람 바꾸기</button>
              </header>
            )}
            <div className="flex-1">
              {view === 'game'
                ? <GamePage onHome={() => { setView('home'); setHomeKey(k => k + 1) }} />
                : <HomePage key={homeKey} onStart={() => setView('game')} />}
            </div>
          </div>}
    </LockScreen>
  )
}
