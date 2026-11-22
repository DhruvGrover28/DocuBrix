import React, { useEffect, useState } from 'react'
import { fetchDocumentSummary, fetchDocuments } from '../api/client'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui'
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { safeFloat } from '../lib/utils'
import { defaultStats } from '../data/mockData'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'

export default function AnalyticsPage() {
  const [summary, setSummary] = useState(defaultStats)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [docSummary, docList] = await Promise.all([fetchDocumentSummary(), fetchDocuments()])
        setSummary(docSummary)
        setDocuments(docList)
      } catch (error) {
        toast.error(error.message || 'Unable to load analytics.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const confidenceValues = documents
    .map((document) => safeFloat((document.confidence || {}).overall))
    .filter((value) => value !== null)

  const confidenceDistribution = [
    { name: 'High', value: confidenceValues.filter((value) => value >= 0.75).length },
    { name: 'Medium', value: confidenceValues.filter((value) => value >= 0.45 && value < 0.75).length },
    { name: 'Low', value: confidenceValues.filter((value) => value < 0.45).length },
  ]

  const documentTypeData = Object.entries(summary.document_type_distribution || {}).map(([key, value]) => ({ name: key, value }))

  return (
    <>
      <PageHeader title="Analytics" subtitle="Operational performance and document extraction quality metrics." />

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading analytics...</div>
      ) : (
        <>
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <StatCard label="Total docs" value={summary.total_documents || 0} hint="All" accent="blue" />
            <StatCard label="Valid" value={documents.filter((item) => item.validation?.is_valid === true).length} hint="Passed" accent="green" />
            <StatCard label="Needs review" value={documents.filter((item) => item.validation?.is_valid === false).length} hint="Flagged" accent="amber" />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Document type distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={documentTypeData}>
                      <CartesianGrid vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Confidence distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={confidenceDistribution} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
                        {confidenceDistribution.map((entry, index) => (
                          <Cell key={entry.name} fill={['#22c55e', '#f59e0b', '#ef4444'][index]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  )
}
