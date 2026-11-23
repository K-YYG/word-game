import { useSyncExternalStore } from 'react'
import { applyUpdate, promptInstall, pwaState, subscribe } from './pwa'

let snap = { ...pwaState }
const getSnap = () => {
  const s = pwaState
  if (s.waitingWorker !== snap.waitingWorker || s.installEvent !== snap.installEvent || s.offlineReady !== snap.offlineReady || s.online !== snap.online || s.installed !== snap.installed) snap = { ...s }
  return snap
}

// 화면 위쪽 알림: 오프라인 / 새 버전
export default function PwaBar() {
  const s = useSyncExternalStore(subscribe, getSnap)
  if (s.online && !s.waitingWorker) return null
  return (
    <div className="fixed inset-x-0 top-0 z-50 mx-auto flex max-w-md flex-col gap-1 px-3 pt-2" data-testid="pwa-bar">
      {!s.online && (
        <p data-testid="offline-banner" className="rounded-xl bg-slate-800/90 px-3 py-2 text-center text-xs text-white">
          인터넷 연결 없음 · 저장된 앱으로 학습 중 (기록은 이 기기에 저장돼요)
        </p>
      )}
      {s.waitingWorker && (
        <div data-testid="update-banner" className="flex items-center justify-between rounded-xl bg-indigo-600 px-3 py-2 text-sm text-white shadow">
          <span>새 버전이 준비됐어요</span>
          <button onClick={applyUpdate} className="rounded-lg bg-white px-3 py-1 font-bold text-indigo-600">새로고침</button>
        </div>
      )}
    </div>
  )
}

// 홈 화면용: 설치 버튼(설치할 수 있을 때만) · 오프라인 준비 표시
export function InstallButton() {
  const s = useSyncExternalStore(subscribe, getSnap)
  if (s.installed) return <p className="text-center text-xs text-emerald-600" data-testid="installed">앱으로 실행 중</p>
  return (
    <div className="text-center text-xs text-slate-400">
      {s.installEvent && (
        <button data-testid="install-btn" onClick={promptInstall} className="mb-1 rounded-xl bg-white px-4 py-2 text-sm font-bold text-indigo-600 ring-1 ring-indigo-200">📲 앱으로 설치</button>
      )}
      {s.offlineReady && <p data-testid="offline-ready">✓ 오프라인에서도 사용할 수 있어요</p>}
    </div>
  )
}
