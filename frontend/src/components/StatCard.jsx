import React from 'react'
import { Card, CardContent } from './ui'
import { cn } from '../lib/utils'

export default function StatCard({ label, value, hint, accent }) {
  const accentMap = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  }

  return (
    <Card className="h-full min-w-0 overflow-hidden">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 truncate">{label}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold shrink-0', accentMap[accent] || accentMap.slate)}>{hint}</span>
        </div>
        <div
          className="text-xl font-semibold tracking-tight text-slate-900 truncate"
          title={typeof value === 'string' ? value : undefined}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
