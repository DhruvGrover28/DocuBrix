import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDocuments, executeQueueAction } from '../api/client'
import { Card, CardContent, Badge, Button } from '../components/ui'
import { AlertCircle, Check, CheckCircle2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn, safeFloat } from '../lib/utils'
import { categoryColors, statusColors } from '../lib/constants'
import PageHeader from '../components/PageHeader'

export default function ReviewQueuePage({ user }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const data = await fetchDocuments()
      setDocuments(
        data.filter(
          (item) =>
            item.status === 'needs_review' ||
            item.status === 'pending_approval' ||
            item.status === 'in_compliance_review' ||
            item.status === 'flagged' ||
            item.validation?.is_valid === false ||
            !!(item.review_json && item.review_json.manual_corrections)
        )
      )
    } catch (error) {
      toast.error(error.message || 'Unable to load review queue.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleAction = async (docId, action) => {
    try {
      await executeQueueAction(docId, action, `Action ${action} executed by reviewer`)
      toast.success(`Document updated to ${action}d.`)
      load()
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to update document status.'
      toast.error(detail)
    }
  }

  return (
    <>
      <PageHeader
        title="Review & Approval Queue"
        subtitle="Documents flagged by workflow rules or quality checks requiring manual inspection and decision."
      />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading review queue...</div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
              <CheckCircle2 className="mb-2 h-10 w-10 text-emerald-500" />
              <div className="text-base font-medium text-slate-800">Review queue is empty</div>
              <div className="text-xs text-slate-500">All documents have been processed and approved.</div>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Reason / Alerts</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Decision Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {documents.map((item) => {
                  const cat = item.category || (item.extracted_fields || {}).category || 'General'
                  const alerts = (item.workflow || {}).alerts || []
                  const isRestricted = ['pending_approval', 'in_compliance_review', 'secure_archived'].includes(item.status)
                  const isAdmin = user?.role === 'admin'
                  return (
                    <tr key={item.document_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <Link className="text-blue-700 hover:underline" to={`/documents/${item.document_id}`}>
                          {item.filename}
                        </Link>
                        <div className="text-xs text-slate-400 capitalize">{item.document_type?.replace(/_/g, ' ')}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', categoryColors[cat] || categoryColors.General)}>
                          {cat}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {alerts.length > 0 ? (
                          <div className="text-xs text-amber-700 font-medium">{alerts[0]}</div>
                        ) : item.validation?.is_valid === false ? (
                          <span className="text-xs text-rose-600 font-medium">Validation failed</span>
                        ) : (
                          <span className="text-xs text-slate-500">Pending review</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{safeFloat((item.confidence || {}).overall)?.toFixed(2) || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusColors[item.status] || 'warning'}>{item.status?.replace(/_/g, ' ') || 'review'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="default"
                            disabled={isRestricted && !isAdmin}
                            className={cn('h-7 text-xs px-2.5 gap-1', isRestricted && !isAdmin ? 'bg-slate-200 text-slate-400 cursor-not-allowed hover:bg-slate-200' : 'bg-emerald-600 hover:bg-emerald-700')}
                            onClick={() => handleAction(item.document_id, 'approve')}
                            title={isRestricted && !isAdmin ? 'Administrator approval required for restricted policy gates.' : 'Approve document'}
                          >
                            <Check className="h-3 w-3" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 h-7 text-xs px-2 gap-1" onClick={() => handleAction(item.document_id, 'flag')}>
                            <AlertCircle className="h-3 w-3" /> Flag
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isRestricted && !isAdmin}
                            className={cn('h-7 text-xs px-2 gap-1', isRestricted && !isAdmin ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-rose-300 text-rose-700 hover:bg-rose-50')}
                            onClick={() => handleAction(item.document_id, 'reject')}
                            title={isRestricted && !isAdmin ? 'Administrator decision required for restricted policy gates.' : 'Reject document'}
                          >
                            <X className="h-3 w-3" /> Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
