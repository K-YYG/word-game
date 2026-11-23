import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// 오프라인용 서비스 워커(sw.js)를 빌드할 때 만든다.
// 추가 패키지 없이: 빌드된 모든 파일 + public 폴더 파일을 미리 저장할 목록으로 넣고,
// 파일 내용이 바뀌면 캐시 이름(버전)이 바뀌어 새 버전으로 교체된다.
function offlineServiceWorker(): Plugin {
  const listFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? listFiles(p) : [p] })
  return {
    name: 'offline-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const hash = createHash('sha256')
      const files = new Set<string>(['./'])
      for (const [name, chunk] of Object.entries(bundle)) {
        files.add('./' + name)
        hash.update(name).update(chunk.type === 'chunk' ? chunk.code : typeof chunk.source === 'string' ? chunk.source : Buffer.from(chunk.source))
      }
      for (const p of listFiles('public')) {
        const rel = relative('public', p).split('\\').join('/')
        files.add('./' + rel)
        hash.update(rel).update(readFileSync(p))
      }
      const template = readFileSync('src/sw-template.js', 'utf8')
      hash.update(template)
      const version = hash.digest('hex').slice(0, 12)
      const source = template
        .replace('__VERSION__', version)
        .replace('__FILES__', JSON.stringify([...files].sort(), null, 2))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// 개발·빌드 설정: React + Tailwind CSS + 오프라인(PWA)
export default defineConfig({
  plugins: [react(), tailwindcss(), offlineServiceWorker()],
})
