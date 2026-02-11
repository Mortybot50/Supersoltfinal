import { cn } from "@/lib/utils"

export interface StatCardItem {
  label: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: React.ReactNode
}

interface StatCardsProps {
  stats: StatCardItem[]
  columns?: 2 | 3 | 4 | 5 | 6
}

const GRID_COLS = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-6',
} as const

export function StatCards({ stats, columns = 4 }: StatCardsProps) {
  return (
    <div className={cn('grid gap-4', GRID_COLS[columns])}>
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
              {stat.label}
            </span>
            {stat.icon && <span className="text-slate-400">{stat.icon}</span>}
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {stat.value}
          </div>
          {stat.subtitle && (
            <div
              className={cn(
                'text-sm mt-0.5',
                stat.trend === 'up' && 'text-emerald-600',
                stat.trend === 'down' && 'text-red-500',
                (!stat.trend || stat.trend === 'neutral') && 'text-slate-500 dark:text-slate-400'
              )}
            >
              {stat.subtitle}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
