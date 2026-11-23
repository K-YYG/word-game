// PWA: 서비스 워커 등록 · 새 버전 알림 · 앱 설치 버튼 · 저장 공간 보호
type Listener = () => void
const listeners = new Set<Listener>()
const emit = () => listeners.forEach(l => l())

interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export const pwaState = {
  waitingWorker: null as ServiceWorker | null, // 새 버전이 준비됨
  installEvent: null as InstallPromptEvent | null, // 설치 버튼을 보여 줄 수 있음
  offlineReady: false, // 오프라인 준비 완료
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  installed: typeof window !== 'undefined' && !!window.matchMedia?.('(display-mode: standalone)').matches,
}
export function subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l) } }

export function setupPwa() {
  window.addEventListener('online', () => { pwaState.online = true; emit() })
  window.addEventListener('offline', () => { pwaState.online = false; emit() })
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); pwaState.installEvent = e as InstallPromptEvent; emit() })
  window.addEventListener('appinstalled', () => { pwaState.installEvent = null; pwaState.installed = true; emit() })

  // 학습 기록(IndexedDB)이 브라우저 정리로 지워지지 않게 요청
  navigator.storage?.persist?.().catch(() => {})

  // 개발 서버(npm run dev)에서는 sw.js가 없으므로 빌드한 앱에서만 등록
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (pwaState.waitingWorker && !reloading) { reloading = true; location.reload() }
  })
  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')
      const track = (w: ServiceWorker | null) => {
        if (!w) return
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) { pwaState.waitingWorker = w; emit() }
          if (w.state === 'activated' && !pwaState.waitingWorker) { pwaState.offlineReady = true; emit() }
        })
      }
      if (reg.waiting && navigator.serviceWorker.controller) { pwaState.waitingWorker = reg.waiting; emit() }
      if (reg.active) { pwaState.offlineReady = true; emit() }
      track(reg.installing)
      reg.addEventListener('updatefound', () => track(reg.installing))
    } catch (e) {
      console.warn('서비스 워커 등록 실패', e)
    }
  }
  if (document.readyState === 'complete') register(); else window.addEventListener('load', register)
}

export function applyUpdate() { pwaState.waitingWorker?.postMessage('SKIP_WAITING') }
export async function promptInstall() {
  const e = pwaState.installEvent; if (!e) return
  await e.prompt(); await e.userChoice.catch(() => null)
  pwaState.installEvent = null; emit()
}
