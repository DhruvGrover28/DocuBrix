import React from 'react'
import { Card, CardContent } from './ui'
import { cn } from '../lib/utils'

export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Overview</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}
