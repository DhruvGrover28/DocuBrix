import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDocuments, fetchSearchStatus, searchDocuments, searchSemanticDocuments } from '../api/client'
import { Card, CardContent, Badge, Input, Select, SelectItem } from '../components/ui'
import { AlertCircle, Bot, CheckCircle2, CircleDashed, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatDate, safeFloat } from '../lib/utils'
import { categoryColors, statusColors } from '../lib/constants'
import PageHeader from '../components/PageHeader'
import ClassificationBadge from '../components/ClassificationBadge'

export default function LibraryPage() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState('keyword')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchStatus, setSearchStatus] = useState(null)

  useEffect(() => {
    fetchSearchStatus()
      .then(setSearchStatus)
      .catch(() => {})
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchDocuments()
        setDocuments(data)
      } catch (error) {
        toast.error(error.message || 'Unable to load documents.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) {
      fetchDocuments().then(setDocuments).catch(() => {})
      return undefined
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true)
        if (searchMode === 'semantic') {
          if (!searchStatus?.semantic_search?.available) {
            toast.error('Semantic search is currently unavailable on the backend.')
            setDocuments([])
            return
          }
          const results = await searchSemanticDocuments(searchQuery, 10)
          setDocuments(results)
        } else {
          const results = await searchDocuments(searchQuery, typeFilter, statusFilter)
          setDocuments(results)
        }
      } catch (error) {
        toast.error(error.response?.data?.detail || error.message || 'Unable to search documents.')
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery, searchMode, typeFilter, statusFilter, searchStatus])

  const filteredDocuments = documents.filter((item) => {
    const itemCat = item.category || (item.extracted_fields || {}).category || (item.classification && item.classification.category) || 'General'
    const catMatch = categoryFilter === 'all' || itemCat === categoryFilter
    const typeMatch = typeFilter === 'all' || (item.document_type || 'unknown') === typeFilter
    const statusMatch = statusFilter === 'all' || (item.status || 'unknown') === statusFilter
    return catMatch && typeMatch && statusMatch
  })

  const uniqueTypes = ['all', ...new Set(documents.map((item) => item.document_type || 'unknown'))]
  const uniqueStatuses = ['all', ...new Set(documents.map((item) => item.status || 'unknown'))]
  const uniqueCategories = ['all', 'Financial', 'Academic', 'Legal', 'Medical', 'Administrative', 'General']

  return (
    <>
      <PageHeader title="Document Library" subtitle="Search, filter, and inspect the full document corpus across all domains." />

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-soft">
        <span className="font-semibold text-slate-700">Capabilities:</span>
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-3 w-3" /> Keyword Search (Active)
        </span>
        {searchStatus?.semantic_search?.available ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700 border border-blue-200">
            <Sparkles className="h-3 w-3" /> Semantic Search ({searchStatus.semantic_search.provider || 'Active'})
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-500 border border-slate-200"
            title={searchStatus?.semantic_search?.reason || 'Dense embedding provider not configured'}
          >
            <CircleDashed className="h-3 w-3" /> Semantic Vector: Offline
          </span>
        )}
        {searchStatus?.llm_qa?.available ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 font-medium text-purple-700 border border-purple-200">
            <Bot className="h-3 w-3" /> Grounded Q&A ({searchStatus.llm_qa.model || 'Active'})
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-500 border border-slate-200"
            title={searchStatus?.llm_qa?.reason || 'GEMINI_API_KEY not configured'}
          >
            <CircleDashed className="h-3 w-3" /> Grounded Q&A: Offline
          </span>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Search documents</label>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSearchMode('keyword')}
                className={cn(
                  'rounded-md px-2.5 py-1 font-medium transition-colors',
                  searchMode === 'keyword'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                Keyword Match
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!searchStatus?.semantic_search?.available) {
                    toast.info('Semantic search is unavailable until an embedding provider is configured.')
                  }
                  setSearchMode('semantic')
                }}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors',
                  searchMode === 'semantic'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900',
                  searchStatus && !searchStatus.semantic_search?.available && 'opacity-70',
                )}
              >
                <Sparkles className="h-3 w-3" />
                Semantic Vector
              </button>
            </div>
          </div>
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={
              searchMode === 'semantic'
                ? 'Enter natural language search (e.g. invoice total and tax amount)...'
                : 'Search filenames, text, or document type...'
            }
          />
          {searchMode === 'semantic' && searchStatus && !searchStatus.semantic_search?.available && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <div className="font-semibold">Semantic vector search is unavailable</div>
                <div className="mt-0.5">{searchStatus.semantic_search.reason || 'Embedding provider is not configured. Keyword search remains fully operational.'}</div>
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Domain category</label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter} placeholder="Filter by domain">
            {uniqueCategories.map((item) => (
              <SelectItem key={item} value={item}>{item === 'all' ? 'All domains' : item}</SelectItem>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Document type</label>
          <Select value={typeFilter} onValueChange={setTypeFilter} placeholder="Filter by type">
            {uniqueTypes.map((item) => (
              <SelectItem key={item} value={item}>{item === 'all' ? 'All types' : item.replace(/_/g, ' ')}</SelectItem>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Workflow status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter} placeholder="Filter by status">
            {uniqueStatuses.map((item) => (
              <SelectItem key={item} value={item}>{item === 'all' ? 'All statuses' : item.replace(/_/g, ' ')}</SelectItem>
            ))}
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading documents...</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              {searchQuery.trim() ? 'No documents matched your query.' : 'No documents found.'}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Filename</th>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Classification</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">
                    {searchMode === 'semantic' ? 'Similarity / Conf' : 'Confidence'}
                  </th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredDocuments.map((document) => {
                  const docCat = document.category || (document.extracted_fields || {}).category || (document.classification && document.classification.category) || 'General'
                  return (
                    <tr key={document.document_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div>{document.filename}</div>
                        {document.excerpts && document.excerpts.length > 0 && (
                          <div
                            className="mt-1 text-xs font-normal text-slate-500 max-w-md line-clamp-2 [&>mark]:bg-amber-100 [&>mark]:text-amber-900 [&>mark]:rounded [&>mark]:px-0.5"
                            dangerouslySetInnerHTML={{ __html: document.excerpts[0] }}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold', categoryColors[docCat] || categoryColors.General)}>
                          {docCat}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ClassificationBadge classification={document.classification} documentType={document.document_type} />
                      </td>
                      <td className="px-4 py-3"><Badge variant={statusColors[document.status] || 'muted'}>{(document.status || 'unknown').replace(/_/g, ' ')}</Badge></td>
                      <td className="px-4 py-3">
                        {typeof document.similarity === 'number' ? (
                          <Badge variant="default" className="bg-purple-50 text-purple-700 border border-purple-200">
                            Sim: {(document.similarity * 100).toFixed(1)}%
                          </Badge>
                        ) : (
                          <span>{safeFloat((document.confidence || {}).overall)?.toFixed(2) || 'N/A'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{formatDate(document.upload_time)}</td>
                      <td className="px-4 py-3"><Link className="font-medium text-blue-700 hover:underline" to={`/documents/${document.document_id}`}>Open</Link></td>
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
