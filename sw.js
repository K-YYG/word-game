// 영단어 암기 게임 – 오프라인용 서비스 워커 (빌드할 때 vite.config.ts가 sw.js로 만듦)
const CACHE = 'word-game-ee8cb749d3bb'
const FILES = [
  "./",
  "./assets/index-CsSOOyqU.css",
  "./assets/index-D90tb0dG.js",
  "./data/vocabulary.json",
  "./favicon.svg",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./manifest.webmanifest"
]

// 설치: 앱 파일 전부를 미리 저장
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)))
})

// 새 버전 적용: 화면의 [새로고침] 버튼을 누르면 바로 교체
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

// 활성화: 예전 버전 캐시 지우기
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('word-game-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// 요청: 저장된 파일이 있으면 그것을 쓰고(인터넷 없어도 됨), 없으면 인터넷에서 받기
self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('./', { cacheName: CACHE, ignoreVary: true }).then(r => r || fetch(req)))
    return
  }
  event.respondWith(caches.match(req, { cacheName: CACHE, ignoreSearch: true, ignoreVary: true }).then(r => r || fetch(req)))
})
