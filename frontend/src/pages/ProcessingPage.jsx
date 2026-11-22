import React, { useState } from 'react'
import { uploadDocument, saveReview } from '../api/client'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Textarea, Badge } from '../components/ui'
import { Loader2, UploadCloud, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn, safeFloat } from '../lib/utils'
import { categoryColors } from '../lib/constants'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import ClassificationBadge from '../components/ClassificationBadge'
import { DEMO_PRESETS } from '../data/demoPresets'

export default function ProcessingPage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [documentResult, setDocumentResult] = useState(null)
  const [manualFields, setManualFields] = useState({})
  const [reviewSaving, setReviewSaving] = useState(false)

  const processFile = async (file) => {
    if (!file) return
    try {
      setUploading(true)
      const response = await uploadDocument(file)
      setDocumentResult(response)
      const fields = response.extracted_fields || {}
      setManualFields(Object.fromEntries(Object.entries(fields).filter(([key]) => key !== 'document_type')))
      toast.success(`Successfully analyzed ${file.name}`)
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Processing failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file or choose a demo preset.')
      return
    }
    await processFile(selectedFile)
  }

  const handleSelectPreset = async (preset, autoProcess = true) => {
    const file = new File([preset.text], preset.filename, { type: 'text/plain' })
    setSelectedFile(file)
    if (autoProcess) {
      toast.info(`Processing ${preset.label}...`)
      await processFile(file)
    } else {
      toast.info(`Selected ${preset.label}. Click "Process document" to run.`)
    }
  }

  const handleReviewSave = async () => {
    if (!documentResult || !documentResult.document_id) {
      toast.error('No processed document is available for review.')
      return
    }

    try {
      setReviewSaving(true)
      const response = await saveReview(documentResult.document_id, manualFields)
      toast.success('Review corrections saved successfully.')
      setDocumentResult((current) => ({ ...current, review_json: response }))
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Review save failed.')
    } finally {
      setReviewSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Intelligent Document Processing"
        subtitle="Upload or test documents across Financial, Academic, Medical, Legal, or Administrative domains with automated OCR, ML classification, field extraction, and workflow validation."
      />

      {/* 1-Click Demo Presets */}
      <Card className="mb-6 border-slate-200 shadow-sm bg-gradient-to-r from-slate-50 via-white to-blue-50/30">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                Live Viva / Demo Presets
              </span>
              <h3 className="text-sm font-semibold text-slate-800 mt-1">1-Click Multi-Domain Test Documents</h3>
            </div>
            <span className="text-xs text-slate-500">Click any preset to test end-to-end OCR and workflow triggers</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {DEMO_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset, true)}
                disabled={uploading}
                className="flex flex-col items-start p-3 rounded-xl border border-slate-200/90 bg-white hover:border-blue-400 hover:shadow-md transition-all text-left group disabled:opacity-60"
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <span className="text-xl">{preset.icon}</span>
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', preset.badgeClass)}>
                    {preset.badge}
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {preset.label}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono truncate w-full">
                  {preset.filename}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">Upload document for intelligent analysis</div>
                  <div className="text-sm text-slate-500">PDF, PNG, JPG, JPEG, TXT (Up to 25MB)</div>
                </div>
              </div>
              <input
                type="file"
                className="mt-4 block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                accept=".pdf,.png,.jpg,.jpeg,.txt"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              />
            </div>
            <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
              {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing Document...</> : 'Process document'}
            </Button>
          </div>

          {selectedFile && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span className="font-medium">{selectedFile.name}</span>
              <span>{Math.round((selectedFile.size || 0) / 1024)} KB</span>
            </div>
          )}
        </CardContent>
      </Card>

      {documentResult && (
        <div className="mt-8 space-y-8">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Filename" value={documentResult.filename || '—'} hint="Document" accent="blue" />
            <StatCard
              label="Type"
              value={documentResult.document_type || 'unknown'}
              hint={documentResult.category || (documentResult.classification && documentResult.classification.category) || 'Domain'}
              accent="green"
            />
            <StatCard label="Status" value={documentResult.status || 'processed'} hint="Workflow" accent="slate" />
            <StatCard
              label="Confidence"
              value={typeof documentResult.classification?.confidence === 'number' ? `${(documentResult.classification.confidence * 100).toFixed(0)}%` : (safeFloat((documentResult.confidence || {}).overall) ? `${safeFloat((documentResult.confidence || {}).overall).toFixed(2)}` : 'N/A')}
              hint={documentResult.classification?.method === 'ml' ? 'ML Model' : 'Overall Quality'}
              accent="amber"
            />
          </div>

          <div className="grid gap-8 xl:grid-cols-[1.3fr_0.7fr]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <span>Extracted information</span>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', categoryColors[documentResult.category || (documentResult.extracted_fields || {}).category || 'General'] || categoryColors.General)}>
                    {documentResult.category || (documentResult.extracted_fields || {}).category || 'General'}
                  </span>
                </CardTitle>
                <ClassificationBadge classification={documentResult.classification} documentType={documentResult.document_type} />
              </CardHeader>
              <CardContent>
                <div className="field-grid">
                  {Object.entries(documentResult.extracted_fields || {})
                    .filter(([key]) => key !== 'document_type' && key !== 'category')
                    .map(([key, value]) => (
                      <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{key.replace(/_/g, ' ')}</div>
                        <div className="mt-2 text-sm font-medium text-slate-900 break-words">
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
                <CardTitle>Validation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant={documentResult.validation?.is_valid === false ? 'danger' : 'success'}>
                  {documentResult.validation?.is_valid === false ? 'Needs review' : 'Valid'}
                </Badge>
                {(documentResult.validation?.errors || []).map((item) => (
                  <div key={item} className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{item}</div>
                ))}
                {(documentResult.validation?.warnings || []).map((item) => (
                  <div key={item} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{item}</div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Confidence signals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries((documentResult.confidence || {}).signals || {}).map(([key, value]) => (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="text-slate-500">{safeFloat(value)?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-200">
                      <div className="h-2.5 rounded-full bg-blue-600" style={{ width: `${Math.min(100, (safeFloat(value) || 0) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Human review</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(manualFields).map(([key, value]) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 capitalize">{key.replace(/_/g, ' ')}</label>
                    <Input value={value || ''} onChange={(event) => setManualFields((current) => ({ ...current, [key]: event.target.value }))} />
                  </div>
                ))}
                <Button type="button" variant="secondary" onClick={handleReviewSave} disabled={reviewSaving}>
                  {reviewSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save corrections'}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Extracted text</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea value={documentResult.raw_text || ''} readOnly className="min-h-[180px]" />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
