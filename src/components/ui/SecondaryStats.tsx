interface SecondaryStatsProps {
  stats: { label: string; value: string | number }[]
}

export function SecondaryStats({ stats }: SecondaryStatsProps) {
  if (!stats.length) return null

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-5 py-3 flex items-center gap-6 flex-wrap">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={i < stats.length - 1 ? 'border-r border-slate-100 dark:border-slate-700 pr-6' : ''}
        >
          <span className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</span>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 ml-2">{stat.value}</span>
        </div>
      ))}
    </div>
  )
}
