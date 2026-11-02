'use client'

// Arabic grade scale (berdasarkan patokan yang diberikan user)
// ممتاز (A): ≥90%, جيد جداً (B): 80-89%, جيد (C): 65-79%, مقبول (D): 50-64%, راسب (F): <50%

export function getGrade(skorr: number): {
  letter: string
  arabic: string
  indo: string
  color: string
  bgClass: string
  isMumtaz: boolean
} {
  if (skorr >= 90) return {
    letter: 'A',
    arabic: 'ممتاز',
    indo: 'Mumtaz',
    color: 'text-emerald-700',
    bgClass: 'bg-emerald-100',
    isMumtaz: true,
  }
  if (skorr >= 80) return {
    letter: 'B',
    arabic: 'جيد جداً',
    indo: 'Jayy Jiddan',
    color: 'text-blue-700',
    bgClass: 'bg-blue-100',
    isMumtaz: false,
  }
  if (skorr >= 65) return {
    letter: 'C',
    arabic: 'جيد',
    indo: 'Jayy',
    color: 'text-amber-700',
    bgClass: 'bg-amber-100',
    isMumtaz: false,
  }
  if (skorr >= 50) return {
    letter: 'D',
    arabic: 'مقبول',
    indo: 'Maqbul',
    color: 'text-orange-700',
    bgClass: 'bg-orange-100',
    isMumtaz: false,
  }
  return {
    letter: 'F',
    arabic: 'ضعيف',
    indo: 'Daif',
    color: 'text-rose-700',
    bgClass: 'bg-rose-100',
    isMumtaz: false,
  }
}

export function GradeBadge({ skor }: { skor: number }) {
  const grade = getGrade(skor)
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${grade.bgClass} ${grade.color} font-semibold text-sm`}>
      <span className="font-arabic text-lg">{grade.arabic}</span>
      <span className="text-xs opacity-70">({grade.letter})</span>
    </div>
  )
}

// Celebration effect for Mumtaz (A grade, ≥90%)
export function MumtazCelebration({ show }: { show: boolean }) {
  if (!show) return null
  // Generate confetti pieces
  const colors = ['#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444', '#F97316']
  const pieces = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.5 + Math.random() * 1,
    color: colors[i % colors.length],
    rotation: Math.random() * 360,
  }))

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map(p => (
        <div
          key={p.id}
          className="absolute top-0 w-2 h-3 rounded-sm"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
