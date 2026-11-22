import React from 'react'
import { Badge, Card, CardContent } from './ui'
import { Sparkles } from 'lucide-react'
import { cn } from '../lib/utils'

export default function ClassificationBadge({ classification, documentType, showType = true, className }) {
  const method = classification?.method || 'heuristic_fallback'
  const confidence = classification?.confidence
  const model = classification?.model
  const category = classification?.category || 'General'
  const typeText = documentType || 'unknown'

  return (
    <div className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      {category && category !== 'General' && (
        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide')}>
          {category}
        </span>
      )}
      {method === 'ml' ? (
        <Badge
          variant="default"
          className="bg-indigo-50 text-indigo-700 border border-indigo-200 gap-1 text-[11px] font-medium"
          title={model ? `Model: ${model}` : 'Machine Learning Classifier'}
        >
          <Sparkles className="h-3 w-3 text-indigo-500" />
          <span>{showType ? typeText.replace(/_/g, ' ') : 'ML'}</span>
          {typeof confidence === 'number' && (
            <span className="ml-0.5 rounded bg-indigo-100/80 px-1 py-0.2 text-[10px] font-semibold text-indigo-900">
              {(confidence * 100).toFixed(0)}%
            </span>
          )}
        </Badge>
      ) : (
        <Badge
          variant="muted"
          className="bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium capitalize"
          title="Rule-based pattern matching"
        >
          <span>{showType ? typeText.replace(/_/g, ' ') : 'Rule-based'}</span>
        </Badge>
      )}
    </div>
  )
}
