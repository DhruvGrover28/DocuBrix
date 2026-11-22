import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchDocumentById, fetchSearchStatus, saveReview, askDocument } from '../api/client'
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, Textarea } from '../components/ui'
import { AlertCircle, Bot, CheckCircle2, Loader2, Send, Sliders } from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatDate, safeFloat } from '../lib/utils'
import { categoryColors, statusColors } from '../lib/constants'
import PageHeader from '../components/PageHeader'
import ClassificationBadge from '../components/ClassificationBadge'

function DocumentQAPanel({ documentId, filename, searchStatus }) {
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [qaResult, setQaResult] = useState(null)
  const [qaError, setQaError] = useState(null)
  const [errorStatus, setErrorStatus] = useState(null)

  const handleAsk = async (e) => {
    if (e) e.preventDefault()
    const trimmed = question.trim()
    if (!trimmed) {
      toast.error('Please enter a question to ask the document.')
      return
    }

    setAsking(true)
    setQaError(null)
    setErrorStatus(null)

    try {
      const response = await askDocument(documentId, trimmed)
      setQaResult(response)
    } catch (err) {
      const status = err.response?.status
      setErrorStatus(status)
      const detail = err.response?.data?.detail || err.message || 'An unexpected error occurred.'

      if (status === 503) {
        setQaError(detail || 'Grounded Q&A is unavailable because GEMINI_API_KEY is not configured on the backend.')
      } else if (status === 401) {
        setQaError('Authentication session expired. Please sign in again.')
      } else if (status === 403) {
        setQaError('You do not have permission to query this document.')
      } else if (status === 404) {
        setQaError('Document was not found or has been removed.')
      } else {
        setQaError(detail)
      }
    } finally {
      setAsking(false)
    }
  }

  return (
    <Card className="mt-8 border-blue-100 bg-white shadow-soft">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Grounded Document Q&A</CardTitle>
              <p className="text-xs text-slate-500">Ask questions answered strictly from this document's indexed content.</p>
            </div>
          </div>
          {searchStatus && (
            <div>
              {searchStatus.llm_qa?.available ? (
                <Badge variant="success" className="gap-1 text-[11px]">
                  <CheckCircle2 className="h-3 w-3" /> Grounded Q&A Ready
                </Badge>
              ) : (
                <Badge variant="muted" className="gap-1 text-[11px] bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertCircle className="h-3 w-3 text-amber-600" /> API Unconfigured
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAsk} className="space-y-3">
          <div>
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What is the total invoice amount and payment deadline? Who is the vendor?"
              className="min-h-[85px] text-sm"
              disabled={asking}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Answers are strictly synthesized from retrieved document chunks.
            </span>
            <Button
              type="submit"
              disabled={asking || !question.trim()}
              className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
            >
              {asking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing document...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Ask Document
                </>
              )}
            </Button>
          </div>
        </form>

        {qaError && (
          <div
            className={cn(
              'rounded-xl border p-4 text-sm',
              errorStatus === 503
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-red-200 bg-red-50 text-red-900',
            )}
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className={cn('h-5 w-5 shrink-0 mt-0.5', errorStatus === 503 ? 'text-amber-600' : 'text-red-600')} />
              <div className="space-y-1">
                <div className="font-semibold">
                  {errorStatus === 503
                    ? 'Grounded Q&A Service Unavailable'
                    : errorStatus === 401
                    ? 'Authentication Required'
                    : errorStatus === 404
                    ? 'Document Not Found'
                    : 'Query Failed'}
                </div>
                <div className="text-xs leading-relaxed text-slate-700">{qaError}</div>
                {errorStatus === 503 && (
                  <p className="mt-1 text-xs text-amber-800">
                    Dense semantic retrieval and Gemini LLM synthesis require <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">GEMINI_API_KEY</code> on the backend.
                    Keyword search and structured extraction remain operational.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {qaResult && (
          <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-700">Grounded Answer</div>
              <div className="rounded-lg bg-white p-4 text-sm leading-relaxed text-slate-800 shadow-sm border border-slate-200/80 whitespace-pre-wrap">
                {qaResult.answer}
              </div>
            </div>

            {qaResult.sources && qaResult.sources.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <span>Citations & Retrieved Sources ({qaResult.sources.length})</span>
                  <span className="text-[11px] font-normal text-slate-400">Ranked by relevance</span>
                </div>
                <div className="space-y-2">
                  {qaResult.sources.map((src, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-sm">
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1 text-slate-500">
                        <span className="font-semibold text-slate-700">
                          Source {idx + 1}: Chunk #{src.chunk_index} ({src.filename})
                        </span>
                        <div className="flex items-center gap-1.5">
                          {src.retrieval_method === 'semantic' ? (
                            <Badge variant="default" className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px]">
                              Semantic (Score: {src.relevance_score})
                            </Badge>
                          ) : (
                            <Badge variant="muted" className="text-[10px]">
                              Keyword (Matches: {src.relevance_score})
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="rounded bg-slate-50 p-2 font-mono text-[11px] leading-relaxed text-slate-700 border border-slate-100 whitespace-pre-wrap">
                        {src.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function DocumentDetailPage() {
  const { documentId } = useParams()
  const [document, setDocument] = useState(null)
  const [corrections, setCorrections] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchStatus, setSearchStatus] = useState(null)

  useEffect(() => {
    fetchSearchStatus().then(setSearchStatus).catch(() => {})
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchDocumentById(documentId)
        setDocument(data)
        setCorrections(data.final_values || data.extracted_fields || {})
      } catch (error) {
        toast.error(error.message || 'Unable to load document details.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [documentId])

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading document details...</div>
  if (!document) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Document not found.</div>

  const handleSaveCorrections = async () => {
    try {
      setSaving(true)
      const response = await saveReview(documentId, corrections)
      setDocument((current) => ({ ...current, status: response.status, final_values: { ...corrections } }))
      toast.success('Review corrections saved successfully.')
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Unable to save corrections.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Document Details"
        subtitle={document.filename || 'Document overview'}
        actions={
          <div className="flex items-center gap-2">
            <Link
              className="link-chip flex items-center gap-1.5 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
              to={`/chat?document_id=${document.document_id}`}
            >
              <Bot className="h-3.5 w-3.5" />
              Chat about document
            </Link>
            <Link className="link-chip" to="/library">Back to library</Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span>Extracted fields</span>
              <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full border', categoryColors[document.category || (document.extracted_fields || {}).category || 'General'] || categoryColors.General)}>
                {document.category || (document.extracted_fields || {}).category || 'General'}
              </span>
            </CardTitle>
            <ClassificationBadge classification={document.classification} documentType={document.document_type} />
          </CardHeader>
          <CardContent>
            <div className="field-grid">
              {Object.entries(document.extracted_fields || {})
                .filter(([key]) => key !== 'document_type' && key !== 'category')
                .map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-slate-300 transition-colors">
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{key.replace(/_/g, ' ')}</div>
                    <div className="mt-1.5 text-sm font-semibold text-slate-900 break-words">
                      {Array.isArray(value)
                        ? (value.length > 0 ? value.join(', ') : <span className="text-slate-400 font-normal italic">Not available</span>)
                        : (value || <span className="text-slate-400 font-normal italic">Not available</span>)}
                    </div>
                  </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metadata & Classification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="flex justify-between items-center">
              <span>Domain category</span>
              <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold', categoryColors[document.category || (document.extracted_fields || {}).category || 'General'] || categoryColors.General)}>
                {document.category || (document.extracted_fields || {}).category || 'General'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Document type</span>
              <span className="font-semibold text-slate-900 capitalize">{(document.document_type || 'unknown').replace(/_/g, ' ')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Classification</span>
              <ClassificationBadge classification={document.classification} documentType={document.document_type} />
            </div>
            <div className="flex justify-between items-center">
              <span>Model engine</span>
              <span className="font-mono text-xs text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                {document.classification?.model || 'tfidf-logistic-regression:1.0.0'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Model confidence</span>
              <span className="font-semibold text-indigo-700">
                {typeof document.classification?.confidence === 'number'
                  ? `${(document.classification.confidence * 100).toFixed(1)}%`
                  : 'N/A (Heuristic)'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Status</span>
              <Badge variant={statusColors[document.status] || 'muted'}>{(document.status || 'unknown').replace(/_/g, ' ')}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Uploaded</span>
              <span className="font-medium text-slate-900">{formatDate(document.upload_time)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Quality score</span>
              <span className="font-medium text-emerald-700">{safeFloat((document.confidence || {}).overall)?.toFixed(2) || 'N/A'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {document.workflow && (
        <Card className="mt-6">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sliders className="h-4 w-4 text-blue-600" />
              <span>Automated Workflow Evaluation</span>
            </CardTitle>
            <Badge variant={statusColors[document.workflow.final_status] || 'default'}>
              Workflow Status: {(document.workflow.final_status || document.status || '').replace(/_/g, ' ')}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {document.workflow.triggered_rules && document.workflow.triggered_rules.length > 0 ? (
              <div className="space-y-2">
                {document.workflow.triggered_rules.map((rule, idx) => (
                  <div key={idx} className="flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div>
                      <div className="font-semibold text-slate-800">{rule.name || rule.rule_id}</div>
                      <div className="text-slate-500 mt-0.5">{rule.description || 'Workflow rule condition evaluated successfully.'}</div>
                    </div>
                    <Badge variant="warning" className="shrink-0 text-[10px]">
                      {(rule.target_status || 'flagged').replace(/_/g, ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 py-1">No special risk thresholds triggered; automated standard path applied.</div>
            )}
          </CardContent>
        </Card>
      )}

      <DocumentQAPanel documentId={documentId} filename={document.filename} searchStatus={searchStatus} />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Human review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="field-grid">
            {Object.entries(corrections)
              .filter(([key]) => key !== 'document_type' && key !== 'category')
              .map(([key, value]) => (
                <div key={key}>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">{key.replace(/_/g, ' ')}</label>
                  <Input value={value || ''} onChange={(event) => setCorrections((current) => ({ ...current, [key]: event.target.value }))} />
                </div>
            ))}
          </div>
          <Button onClick={handleSaveCorrections} disabled={saving}>{saving ? 'Saving...' : 'Save corrections'}</Button>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Parsed text</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={document.raw_text || ''} readOnly className="min-h-[220px]" />
        </CardContent>
      </Card>
    </>
  )
}
