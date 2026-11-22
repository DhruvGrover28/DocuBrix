import React, { useEffect, useState } from 'react'
import {
  claimAdminRole, createWorkflowRule, deleteWorkflowRule, executeQueueAction,
  fetchWorkflowLogs, fetchWorkflowQueue, fetchWorkflowRules, updateWorkflowRule,
} from '../api/client'
import {
  Card, CardContent, CardHeader, CardTitle, Badge, Button, Input,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '../components/ui'
import {
  AlertCircle, Check, CheckCheck, CheckCircle2, Clock, Download, FileText,
  Loader2, Plus, RefreshCw, ShieldCheck, Sliders, ToggleLeft, ToggleRight,
  Trash2, X, Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { cn, formatDate, safeFloat } from '../lib/utils'
import { categoryColors, statusColors } from '../lib/constants'
import PageHeader from '../components/PageHeader'

export default function WorkflowAutomationPage({ user, onUserUpdated }) {
  const [activeTab, setActiveTab] = useState('rules')
  const [rules, setRules] = useState([])
  const [queue, setQueue] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [newRuleModalOpen, setNewRuleModalOpen] = useState(false)
  const isAdmin = user?.role === 'admin'
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    rule_type: 'auto_approval',
    min_confidence: '0.80',
    min_amount: '',
    target_status: 'approved',
  })

  const handleClaimAdmin = async () => {
    try {
      const updated = await claimAdminRole()
      if (onUserUpdated) onUserUpdated(updated)
      toast.success('Your account is now an Administrator! You can now manage workflow rules.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Unable to claim administrator privileges.')
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [rulesData, queueData, logsData] = await Promise.all([
        fetchWorkflowRules(),
        fetchWorkflowQueue(),
        fetchWorkflowLogs(50),
      ])
      setRules(rulesData)
      setQueue(queueData)
      setLogs(logsData)
    } catch (err) {
      toast.error(err.message || 'Failed to load workflow automation data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleExportAuditLogs = () => {
    if (!logs || logs.length === 0) {
      toast.info('No audit logs available to export yet.')
      return
    }
    const headers = ['Log ID', 'Document ID', 'Filename', 'Rule Name', 'Action Triggered', 'Previous Status', 'New Status', 'Timestamp']
    const rows = logs.map((log) => [
      log.id || '',
      log.document_id || '',
      `"${(log.details?.filename || log.document_filename || 'document').replace(/"/g, '""')}"`,
      `"${(log.rule_name || '').replace(/"/g, '""')}"`,
      `"${(log.action_taken || '').replace(/"/g, '""')}"`,
      log.previous_status || '',
      log.new_status || '',
      log.created_at || new Date().toISOString(),
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `DocuBrix_Workflow_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Workflow audit trail exported to CSV!')
  }

  const handleToggleRule = async (rule) => {
    if (!isAdmin) {
      toast.error('Administrator privileges are required to modify workflow rules.')
      return
    }
    try {
      const updated = await updateWorkflowRule(rule.id, { enabled: !rule.enabled })
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)))
      toast.success(`Rule "${rule.name}" is now ${!rule.enabled ? 'Enabled' : 'Disabled'}.`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update rule status.')
    }
  }

  const handleDeleteRule = async (ruleId) => {
    if (!isAdmin) {
      toast.error('Administrator privileges are required to delete workflow rules.')
      return
    }
    try {
      await deleteWorkflowRule(ruleId)
      setRules((prev) => prev.filter((r) => r.id !== ruleId))
      toast.success('Workflow rule removed.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete rule.')
    }
  }

  const handleCreateRule = async (e) => {
    e.preventDefault()
    if (!isAdmin) {
      toast.error('Administrator privileges are required to create workflow rules.')
      return
    }
    if (!newRule.name.trim()) {
      toast.error('Please enter a rule name.')
      return
    }
    try {
      const conditions = {}
      if (newRule.min_confidence) {
        conditions.min_confidence = parseFloat(newRule.min_confidence)
      }
      if (newRule.min_amount) {
        conditions.min_amount = parseFloat(newRule.min_amount)
      }
      const payload = {
        name: newRule.name.trim(),
        description: newRule.description.trim() || 'Custom automated workflow policy',
        rule_type: newRule.rule_type,
        conditions,
        action: {
          target_status: newRule.target_status,
          tag: 'custom_rule_action',
          notification: `Rule '${newRule.name.trim()}' executed successfully.`,
        },
      }
      const created = await createWorkflowRule(payload)
      setRules((prev) => [...prev, created])
      setNewRuleModalOpen(false)
      setNewRule({
        name: '',
        description: '',
        rule_type: 'auto_approval',
        min_confidence: '0.80',
        min_amount: '',
        target_status: 'approved',
      })
      toast.success('Custom workflow rule created.')
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Failed to create rule.')
    }
  }

  const handleQueueAction = async (docId, action) => {
    try {
      await executeQueueAction(docId, action, `Action ${action} executed from workflow console`)
      toast.success(`Document marked as ${action}d.`)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Failed to update queue item.')
    }
  }

  const activeCount = rules.filter((r) => r.enabled).length
  const queueCount = queue.length
  const autoApprovedCount = logs.filter((l) => l.resulting_status === 'approved').length
  const flaggedCount = logs.filter((l) => l.resulting_status === 'pending_approval' || l.resulting_status === 'in_compliance_review' || l.resulting_status === 'needs_review').length

  return (
    <>
      <PageHeader
        title="Workflow Automation"
        subtitle="Manage rules, routing policies, automated quality gates, and review queues across all document categories."
      />

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="border-l-4 border-l-blue-600">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">Active Rules</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{activeCount} / {rules.length}</div>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Zap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">Pending In Queue</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{queueCount}</div>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">Auto-Approved</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{autoApprovedCount}</div>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-600">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">Policy Triggered</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{flaggedCount}</div>
            </div>
            <div className="h-10 w-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
              <Sliders className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList className="bg-slate-200/80 p-1">
            <TabsTrigger value="rules" className="text-xs gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Active Rules ({rules.length})
            </TabsTrigger>
            <TabsTrigger value="queue" className="text-xs gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Review Queue ({queueCount})
            </TabsTrigger>
            <TabsTrigger value="logs" className="text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Audit Logs ({logs.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExportAuditLogs} className="gap-1.5 text-xs text-slate-700 hover:text-slate-900 border-slate-300">
              <Download className="h-3.5 w-3.5" /> Export Audit Trail (CSV)
            </Button>
            <Button size="sm" variant="outline" onClick={loadData} className="gap-1.5 text-xs">
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setNewRuleModalOpen(true)} className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-3.5 w-3.5" /> Add Rule
            </Button>
          </div>
        </div>

        {/* Tab 1: Rules Engine */}
        <TabsContent value="rules" className="space-y-4">
          {!isAdmin && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-900">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span>You are viewing workflow policies in read-only mode. Administrator privileges are required to toggle or configure automation rules.</span>
              </div>
              <Button size="sm" variant="outline" className="text-xs h-7 bg-white text-blue-700 border-blue-300 hover:bg-blue-50 shrink-0" onClick={handleClaimAdmin}>
                Claim Admin Privileges
              </Button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rules.map((rule) => {
              const typeBadgeColors = {
                auto_approval: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                confidence_gate: 'bg-amber-50 text-amber-700 border-amber-200',
                alert_trigger: 'bg-rose-50 text-rose-700 border-rose-200',
                routing_tag: 'bg-blue-50 text-blue-700 border-blue-200',
              }

              return (
                <Card key={rule.id} className={cn('border transition-all', rule.enabled ? 'border-slate-200 shadow-sm' : 'border-slate-200/60 opacity-60 bg-slate-50/50')}>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', typeBadgeColors[rule.rule_type] || 'bg-slate-100 text-slate-700 border-slate-200')}>
                          {rule.rule_type?.replace(/_/g, ' ')}
                        </span>
                        <CardTitle className="text-sm font-semibold text-slate-900 mt-1.5">{rule.name}</CardTitle>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleRule(rule)}
                        className="text-slate-400 hover:text-blue-600 transition"
                        title={rule.enabled ? 'Click to disable rule' : 'Click to enable rule'}
                      >
                        {rule.enabled ? (
                          <ToggleRight className="h-6 w-6 text-blue-600" />
                        ) : (
                          <ToggleLeft className="h-6 w-6 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-1 space-y-3">
                    <p className="text-xs text-slate-600 leading-relaxed">{rule.description}</p>
                    
                    <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] space-y-1 border border-slate-100">
                      <div className="font-medium text-slate-700">Trigger Conditions:</div>
                      <div className="text-slate-500 font-mono text-[10px]">
                        {rule.conditions?.min_confidence && `• Confidence >= ${(rule.conditions.min_confidence * 100).toFixed(0)}% `}
                        {rule.conditions?.max_confidence && `• Confidence < ${(rule.conditions.max_confidence * 100).toFixed(0)}% `}
                        {rule.conditions?.min_amount && `• Amount >= $${rule.conditions.min_amount} `}
                        {rule.conditions?.categories && `• Category: ${rule.conditions.categories.join(', ')} `}
                        {rule.conditions?.document_type && `• Doc Type: ${rule.conditions.document_type} `}
                      </div>
                      <div className="pt-1 flex items-center justify-between text-slate-600">
                        <span>Target Status:</span>
                        <Badge variant={statusColors[rule.action?.target_status] || 'default'} className="text-[10px] py-0 px-1.5">
                          {rule.action?.target_status || 'processed'}
                        </Badge>
                      </div>
                    </div>

                    {rule.id.startsWith('rule-') && !['rule-auto-approval', 'rule-confidence-gate', 'rule-high-value-invoice', 'rule-academic-verification', 'rule-legal-compliance', 'rule-medical-phi'].includes(rule.id) && (
                      <div className="pt-1 flex justify-end">
                        <Button size="sm" variant="ghost" className="h-6 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2" onClick={() => handleDeleteRule(rule.id)}>
                          <Trash2 className="h-3 w-3 mr-1" /> Remove
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Tab 2: Review Queue */}
        <TabsContent value="queue">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                  <CheckCircle2 className="mb-2 h-10 w-10 text-emerald-500" />
                  <div className="text-base font-medium text-slate-800">Queue is clear!</div>
                  <div className="text-xs text-slate-500">No documents are currently pending manual review or approval.</div>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Document</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Triggered Alert / Rule</th>
                      <th className="px-4 py-3">Confidence</th>
                      <th className="px-4 py-3">Current Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {queue.map((item) => {
                      const cat = item.category || (item.extracted_fields || {}).category || 'General'
                      const alerts = (item.workflow || {}).alerts || []
                      return (
                        <tr key={item.document_id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            <Link to={`/documents/${item.document_id}`} className="text-blue-700 hover:underline">
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
                              <span className="text-xs text-slate-500">Review required</span>
                            )}
                          </td>
                          <td className="px-4 py-3">{safeFloat((item.confidence || {}).overall)?.toFixed(2) || 'N/A'}</td>
                          <td className="px-4 py-3">
                            <Badge variant={statusColors[item.status] || 'warning'}>{item.status?.replace(/_/g, ' ') || 'review'}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs px-2.5 gap-1" onClick={() => handleQueueAction(item.document_id, 'approve')}>
                                <Check className="h-3 w-3" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 h-7 text-xs px-2 gap-1" onClick={() => handleQueueAction(item.document_id, 'flag')}>
                                <AlertCircle className="h-3 w-3" /> Flag
                              </Button>
                              <Button size="sm" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50 h-7 text-xs px-2 gap-1" onClick={() => handleQueueAction(item.document_id, 'reject')}>
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
        </TabsContent>

        {/* Tab 3: Execution Audit Logs */}
        <TabsContent value="logs">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No automation logs recorded yet. Upload a document to trigger the workflow engine.</div>
              ) : (
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Document</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Triggered Policy</th>
                      <th className="px-4 py-3">Resulting Status</th>
                      <th className="px-4 py-3">Tags Applied</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 font-mono text-xs">
                        <td className="px-4 py-3 text-slate-500">{formatDate(log.timestamp)}</td>
                        <td className="px-4 py-3 font-sans font-medium text-slate-900">{log.filename}</td>
                        <td className="px-4 py-3 font-sans">
                          <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', categoryColors[log.category] || categoryColors.General)}>
                            {log.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-sans text-slate-700">
                          {log.triggered_rules?.length > 0 ? (
                            <span className="text-blue-700 font-medium">{log.triggered_rules.join(', ')}</span>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-sans">
                          <Badge variant={statusColors[log.resulting_status] || 'default'} className="text-[11px]">
                            {log.resulting_status?.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {log.tags?.length > 0 ? log.tags.map((t) => (
                            <span key={t} className="inline-block bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] mr-1">
                              #{t}
                            </span>
                          )) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Custom Rule Dialog */}
      {newRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="text-base font-semibold text-slate-900">Create Workflow Automation Rule</div>
              <button type="button" onClick={() => setNewRuleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="mt-4 space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Rule Name</label>
                <Input
                  placeholder="e.g. Auto-Approve Verified Academic Marksheets"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <Input
                  placeholder="e.g. Automatically approve transcripts with confidence over 80%"
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Rule Type</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newRule.rule_type}
                    onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value })}
                  >
                    <option value="auto_approval">Auto Approval</option>
                    <option value="confidence_gate">Confidence Gate</option>
                    <option value="alert_trigger">Alert Trigger</option>
                    <option value="routing_tag">Routing Policy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Target Status</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newRule.target_status}
                    onChange={(e) => setNewRule({ ...newRule, target_status: e.target.value })}
                  >
                    <option value="approved">Approved</option>
                    <option value="needs_review">Needs Review</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="verified">Verified</option>
                    <option value="flagged">Flagged</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Min Confidence (0-1)</label>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    placeholder="0.80"
                    value={newRule.min_confidence}
                    onChange={(e) => setNewRule({ ...newRule, min_confidence: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Min Amount ($ optional)</label>
                  <Input
                    type="number"
                    placeholder="1000"
                    value={newRule.min_amount}
                    onChange={(e) => setNewRule({ ...newRule, min_amount: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setNewRuleModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                  Save Rule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
