'use client'

export function ArabicText({ children, className = '', size = 'md' }: { children: React.ReactNode; className?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizeClass = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  }[size]
  return (
    <span dir="rtl" className={`font-arabic ${sizeClass} ${className}`} style={{ fontFamily: 'var(--font-amiri), Amiri, serif' }}>
      {children}
    </span>
  )
}

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'gold'

export function Badge({ children, variant = 'default', className = '' }: { children: React.ReactNode; variant?: BadgeVariant; className?: string }) {
  const styles: Record<BadgeVariant, string> = {
    default: 'bg-gray-100 text-gray-700',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
    purple: 'bg-violet-100 text-violet-700',
    gold: 'bg-amber-100 text-amber-800',
  }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[variant]} ${className}`}>{children}</span>
}

export function StatCard({
  label, value, sub, icon, variant = 'default', trend,
}: {
  label: string
  value: string | number
  sub?: string
  icon?: React.ReactNode
  variant?: 'default' | 'dark' | 'amber' | 'blue' | 'violet'
  trend?: { value: string; up: boolean }
}) {
  const bgClass = {
    default: 'bg-white border border-gray-200',
    dark: 'bg-stat-emerald border-0',
    amber: 'bg-stat-amber border-0',
    blue: 'bg-stat-blue border-0',
    violet: 'bg-stat-violet border-0',
  }[variant]

  const isDark = variant === 'dark'
  const textClass = isDark ? 'text-white' : 'text-gray-900'
  const labelClass = isDark ? 'text-white/70' : 'text-gray-500'
  const subClass = isDark ? 'text-white/60' : 'text-gray-400'

  return (
    <div className={`${bgClass} rounded-2xl p-5 shadow-soft relative overflow-hidden`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-xs font-semibold uppercase tracking-wide ${labelClass}`}>{label}</p>
          <p className={`text-3xl font-bold mt-1 ${textClass}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
          {sub && <p className={`text-xs mt-1 ${subClass}`}>{sub}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.up ? (isDark ? 'text-emerald-200' : 'text-emerald-600') : (isDark ? 'text-rose-200' : 'text-rose-600')}`}>
              <span>{trend.up ? '↑' : '↓'}</span>
              <span>{trend.value}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            isDark ? 'bg-white/15' : 'bg-black/5'
          }`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
        </svg>
      </div>
      <p className="text-gray-500 text-lg font-semibold">{title}</p>
      {description && <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
        <p className="text-gray-500 text-sm font-medium">Memuat...</p>
      </div>
    </div>
  )
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>
      {action}
    </div>
  )
}
