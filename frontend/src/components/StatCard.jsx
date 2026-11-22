import React from 'react'
import { Card, CardContent } from './ui'
import { cn } from '../lib/utils'

export default function StatCard({ label, value, hint, accent }) {
  const accentMap = {
    blue: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40',
    green: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40',
    amber: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/40',
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
  }

  return (
    <Card className="h-full min-w-0 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 truncate">{label}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold shrink-0', accentMap[accent] || accentMap.slate)}>{hint}</span>
        </div>
        <div
          className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 truncate count-up"
          title={typeof value === 'string' ? value : undefined}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
