import React, { useEffect, useState } from 'react'
import { fetchHealth, fetchAdminOverview } from '../api/client'
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui'
import { toast } from 'sonner'
import PageHeader from '../components/PageHeader'

export default function SystemStatusPage() {
  const [health, setHealth] = useState(null)
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [data, adminData] = await Promise.all([fetchHealth(), fetchAdminOverview()])
        setHealth(data)
        setOverview(adminData)
      } catch (error) {
        toast.error(error.message || 'Unable to load system status.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <>
      <PageHeader title="System Status" subtitle="Live health and service availability for the DocuBrix platform." />
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Checking service status...</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>API health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge variant={health?.status === 'ok' ? 'success' : 'danger'}>{health?.status || 'unknown'}</Badge>
              <div className="text-sm text-slate-600">Service: {health?.service || 'DocuBrix'}</div>
              <div className="text-sm text-slate-600">Version: {health?.version || 'unavailable'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Database</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge variant={(health?.database?.status || '').includes('ok') ? 'success' : 'warning'}>{health?.database?.status || 'unknown'}</Badge>
              <div className="text-sm text-slate-600">URL: {health?.database?.url || 'n/a'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Environment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge variant="secondary">{health?.environment || 'unknown'}</Badge>
              <div className="text-sm text-slate-600">OCR status: available when the backend runtime includes Tesseract.</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div>Users: {overview?.user_count ?? 'n/a'}</div>
              <div>Documents: {overview?.document_count ?? 'n/a'}</div>
              <div>Processed: {overview?.processed_count ?? 'n/a'}</div>
              <div>Failed: {overview?.failed_count ?? 'n/a'}</div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
