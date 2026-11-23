// 홈 화면의 숫자 카드 하나
interface Props { label: string; value: string | number }

export default function StatCard({ label, value }: Props) {
  return (
    <div className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-200">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-bold text-slate-800">{value}</div>
    </div>
  )
}
