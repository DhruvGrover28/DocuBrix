export const statusColors = {
  processed: 'success',
  reviewed: 'success',
  approved: 'success',
  verified: 'success',
  secure_archived: 'success',
  pending: 'muted',
  pending_approval: 'warning',
  needs_review: 'warning',
  in_compliance_review: 'warning',
  flagged: 'warning',
  rejected: 'danger',
  failed: 'danger',
  unknown: 'muted',
}

export const categoryColors = {
  // Current 8-category taxonomy
  Financial: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Professional & Career': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Academic & Research': 'bg-blue-50 text-blue-700 border-blue-200',
  Legal: 'bg-purple-50 text-purple-700 border-purple-200',
  'Medical & Healthcare': 'bg-rose-50 text-rose-700 border-rose-200',
  'Business & Commercial': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Administrative & Identity': 'bg-amber-50 text-amber-700 border-amber-200',
  'General & Miscellaneous': 'bg-slate-50 text-slate-700 border-slate-200',
  // Legacy aliases for backward compatibility with existing stored documents
  Academic: 'bg-blue-50 text-blue-700 border-blue-200',
  Medical: 'bg-rose-50 text-rose-700 border-rose-200',
  Administrative: 'bg-amber-50 text-amber-700 border-amber-200',
  General: 'bg-slate-50 text-slate-700 border-slate-200',
}
