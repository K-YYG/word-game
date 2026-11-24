import { motion } from 'framer-motion'

// VOCA CAT 그림들 (public/img). 경로는 배포 주소(/word-game/)에 맞춰 BASE_URL 기준
const img = (name: string) => `${import.meta.env.BASE_URL}img/${name}.webp`

// 게임 이름 로고: 휴대폰은 화면 폭의 약 80%, PC는 최대 520px. 살짝 둥실거림
export function Logo({ className = '' }: { className?: string }) {
  return (
    <motion.img
      src={img('logo')} alt="VOCA CAT" data-testid="logo" draggable={false}
      initial={{ y: -16, opacity: 0, scale: 0.9 }}
      animate={{ y: [0, -6, 0], opacity: 1, scale: 1 }}
      transition={{ y: { duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }, opacity: { duration: 0.4 }, scale: { duration: 0.4 } }}
      className={`mx-auto w-[80%] max-w-[520px] select-none ${className}`}
    />
  )
}

// 시작화면 풀밭 + 고양이 7마리. 위치·크기는 장면 폭에 대한 비율(%)이라 화면 크기에 맞춰 줄고 늘어남
// 뒤쪽(위)에 앉은 고양이, 앞쪽(아래)에 누운·자는 고양이
const CATS: { n: number; left: number; bottom: number; width: number; z: number }[] = [
  { n: 1, left: 4, bottom: 34, width: 16, z: 1 },   // 삼색 앉은 고양이
  { n: 3, left: 81, bottom: 33, width: 14, z: 1 },  // 치즈 앉은 고양이
  { n: 7, left: 39, bottom: 38, width: 25, z: 1 },  // 회색 장모 누운 고양이
  { n: 6, left: 17, bottom: 13, width: 24, z: 2 },  // 치즈 엎드린 고양이
  { n: 5, left: 60, bottom: 12, width: 19, z: 2 },  // 웅크려 자는 흰 고양이
  { n: 2, left: 0, bottom: 2, width: 24, z: 3 },    // 누워 자는 흰 고양이
  { n: 4, left: 73, bottom: 0, width: 26, z: 3 },   // 배 보이고 누운 치즈 고양이
]

// 양옆 끝은 부드럽게 흐려지게
const FADE = 'linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)'

export function GrassScene() {
  return (
    <div className="relative mx-auto aspect-[16/9] w-full select-none" data-testid="grass-scene" aria-hidden="true"
      style={{ WebkitMaskImage: FADE, maskImage: FADE }}>
      <Grass />
      {CATS.map((c, i) => (
        <motion.img
          key={c.n} src={img(`cat${c.n}`)} alt="" draggable={false} loading="eager"
          initial={{ y: 30, opacity: 0, scale: 0.85 }} animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.15 + i * 0.12 }}
          style={{ left: `${c.left}%`, bottom: `${c.bottom}%`, width: `${c.width}%`, zIndex: c.z }}
          className="absolute h-auto"
        />
      ))}
    </div>
  )
}

// 풀밭 배경(그림): 뒤 언덕 + 앞 언덕 + 풀잎
function Grass() {
  const blades = Array.from({ length: 46 }, (_, i) => {
    const x = (i * 37) % 640 + ((i * 13) % 9)
    const h = 10 + ((i * 7) % 12)
    const front = i % 2 === 0
    return { x, h, y: front ? 360 : 250 + ((i * 11) % 30), c: front ? '#4d9e3a' : '#6cbf4d' }
  })
  return (
    <svg viewBox="0 0 640 360" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b8e68f" /><stop offset="1" stopColor="#8fd16a" /></linearGradient>
        <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8fd16a" /><stop offset="1" stopColor="#62b247" /></linearGradient>
      </defs>
      <path d="M0 210 C 120 150, 260 175, 360 185 S 560 150, 640 190 L 640 360 L 0 360 Z" fill="url(#g1)" />
      <path d="M0 290 C 140 245, 300 270, 420 262 S 580 250, 640 270 L 640 360 L 0 360 Z" fill="url(#g2)" />
      {blades.map((b, i) => (
        <path key={i} d={`M${b.x} ${b.y} q 3 ${-b.h / 2} ${i % 3 - 1} ${-b.h} M${b.x + 4} ${b.y} q -2 ${-b.h / 2} 2 ${-b.h * 0.8}`}
          stroke={b.c} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      ))}
    </svg>
  )
}

// 게임 단계마다 위쪽 구석에 작게 나오는 고양이 (휴대폰 80px, PC 110px)
const STAGE_IMG: Record<number, string> = { 1: 'stage1', 2: 'stage2', 3: 'stage3', 4: 'stage2' }
export function StageCat({ stage }: { stage: number }) {
  const name = STAGE_IMG[stage]
  return (
    <motion.img
      key={name} src={img(name)} alt="" aria-hidden="true" draggable={false} data-testid={`stage-cat-${stage}`}
      initial={{ y: 20, opacity: 0, rotate: -6 }}
      animate={stage === 2 || stage === 4 ? { y: 0, opacity: 1, rotate: [-4, 4, -4] } : { y: 0, opacity: 1, rotate: 0 }}
      transition={stage === 2 || stage === 4 ? { rotate: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }, y: { type: 'spring', stiffness: 300, damping: 15 } } : { type: 'spring', stiffness: 300, damping: 15 }}
      className="pc-stage-cat h-auto w-[80px] shrink-0 select-none"
    />
  )
}

// 최종 결과 고양이: 틀린 단어 5개 이하면 응원, 6개 이상이면 실망
export function ResultCat({ wrong }: { wrong: number }) {
  const cheer = wrong <= 5
  return (
    <div className="flex flex-col items-center">
      <motion.img
        src={img(cheer ? 'cheer' : 'sad')} alt={cheer ? '응원하는 고양이' : '실망한 고양이'} draggable={false}
        data-testid={cheer ? 'result-cheer' : 'result-sad'}
        initial={{ scale: 0.3, opacity: 0, y: 40 }}
        animate={cheer ? { scale: 1, opacity: 1, y: [0, -10, 0] } : { scale: 1, opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }}
        transition={cheer
          ? { scale: { type: 'spring', stiffness: 220, damping: 12 }, y: { duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 } }
          : { scale: { type: 'spring', stiffness: 220, damping: 14 }, x: { duration: 0.6, delay: 0.5 } }}
        className={`h-auto select-none ${cheer ? 'w-[62%] max-w-[300px]' : 'w-[78%] max-w-[380px] rounded-2xl'}`}
      />
    </div>
  )
}
