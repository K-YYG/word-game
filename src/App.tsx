import { useState } from 'react'
import HomePage from './pages/HomePage'
import GamePage from './game/GamePage'
import PwaBar from './pwa/PwaBar'
import LockScreen from './lock/LockScreen'

// 화면 전환: 홈 ↔ 게임(오늘 진행 단계에 맞춰 1·2단계 표시)
export default function App() {
  const [view, setView] = useState<'home' | 'game'>('home')
  const [homeKey, setHomeKey] = useState(0)
  return (
    <LockScreen>
      <PwaBar />
      {view === 'game'
        ? <GamePage onHome={() => { setView('home'); setHomeKey(k => k + 1) }} />
        : <HomePage key={homeKey} onStart={() => setView('game')} />}
    </LockScreen>
  )
}
