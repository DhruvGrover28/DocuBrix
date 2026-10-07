import React, { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  FileText,
  Filter,
  FolderOpen,
  Home,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MoreHorizontal,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  User,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'

import { AUTH_TOKEN_KEY, fetchAdminOverview, fetchCurrentUser, fetchDocumentById, fetchDocumentSummary, fetchDocuments, fetchHealth, loginUser, logoutUser, registerUser, saveReview, updateCurrentUser, uploadDocument } from './api/client'
import { appShellNav, defaultStats } from './data/mockData'
import { Avatar, Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, Input, Select, SelectItem, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from './components/ui'
import { cn, formatDate, safeFloat } from './lib/utils'

const statusColors = {
  processed: 'success',
  reviewed: 'success',
  pending: 'muted',
  failed: 'danger',
  unknown: 'muted',
}

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(AUTH_TOKEN_KEY)) {
      setAuthLoading(false)
      return undefined
    }

    fetchCurrentUser()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_KEY)
        setUser(null)
      })
      .finally(() => setAuthLoading(false))
  }, [])

  const handleLogout = async () => {
    await logoutUser()
    setUser(null)
    setMobileOpen(false)
  }

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">Loading your workspace...</div>
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage mode="login" setUser={setUser} />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage mode="register" setUser={setUser} />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage mode="forgot" setUser={setUser} />} />
      <Route path="/reset-password" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage mode="reset" setUser={setUser} />} />
      <Route
        path="*"
        element={
          user ? (
            <ProtectedLayout user={user} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} onLogout={handleLogout}>
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/processing" element={<ProcessingPage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/documents/:documentId" element={<DocumentDetailPage />} />
                <Route path="/review" element={<ReviewQueuePage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                {user.role === 'admin' && <Route path="/status" element={<SystemStatusPage />} />}
                <Route path="/profile" element={<ProfilePage user={user} onUserUpdated={setUser} />} />
                <Route path="/settings" element={<SettingsPage user={user} />} />
                <Route path="/team" element={<ComingSoonPage title="Team management" />} />
                <Route path="/automation" element={<ComingSoonPage title="Workflow automation" />} />
                <Route path="/reports" element={<ComingSoonPage title="Exports & reports" />} />
                <Route path="/integrations" element={<ComingSoonPage title="Integrations" />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </ProtectedLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  )
}

function ProtectedLayout({ user, children, mobileOpen, setMobileOpen, onLogout }) {
  const location = useLocation()
  const currentTitle = appShellNav.find((item) => item.path === location.pathname)?.label || 'Dashboard'
  const visibleNav = appShellNav.filter((item) => item.path !== '/status' || user.role === 'admin')

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-[1600px]">
        <aside className={cn('fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-slate-50/95 p-4 transition-transform lg:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full', 'lg:static')}>
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">D</div>
            <div>
              <div className="text-base font-semibold">DocuBrix</div>
              <div className="text-xs text-slate-500">Document intelligence</div>
            </div>
          </div>

          <nav className="space-y-1">
            {visibleNav.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  'group flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'sidebar-item active border-blue-200 bg-blue-50 text-blue-700' : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-100',
                )}
                onClick={() => setMobileOpen(false)}
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-slate-500 shadow-sm">
                    {item.path === '/dashboard' ? <LayoutDashboard className="h-3.5 w-3.5" /> : item.comingSoon ? <Sparkles className="h-3.5 w-3.5" /> : <FolderOpen className="h-3.5 w-3.5" />}
                  </span>
                  {item.label}
                </span>
                {item.comingSoon && <Badge variant="muted">Soon</Badge>}
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-soft">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Workspace</div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Avatar initials={user.name.slice(0, 2).toUpperCase()} className="h-9 w-9 bg-gradient-to-br from-blue-600 to-indigo-400" />
                <div>
                  <div className="text-sm font-semibold">{user.name}</div>
                  <div className="text-xs capitalize text-slate-500">{user.role}</div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Bell className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex items-center justify-between px-4 py-3 lg:px-8">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setMobileOpen((value) => !value)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Workspace</div>
                  <div className="text-lg font-semibold text-slate-900">{currentTitle}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
                  <Search className="h-4 w-4 text-slate-500" />
                  <input className="w-40 border-0 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none" placeholder="Search" />
                </div>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
                </Button>
                <Link to="/profile" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <Avatar initials={user.name.slice(0, 2).toUpperCase()} className="h-8 w-8 bg-gradient-to-br from-blue-600 to-indigo-400 text-xs" />
                  <div className="hidden text-left text-sm md:block">
                    <div className="font-semibold">{user.name}</div>
                    <div className="text-xs capitalize text-slate-500">{user.role}</div>
                  </div>
                </Link>
                <Button variant="ghost" size="icon" onClick={onLogout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          <main className="px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  )
}

function AuthPage({ mode, setUser }) {
  const navigate = useNavigate()
  const titleMap = {
    login: 'Sign in to DocuBrix',
    register: 'Create your account',
    forgot: 'Reset your password',
    reset: 'Set a new password',
  }

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    if (mode === 'forgot' || mode === 'reset') {
      toast.error('Password reset is not enabled yet. Contact an administrator.')
      return
    }

    if (!email || !password || (mode === 'register' && !name)) {
      toast.error('Please complete the required fields to continue.')
      return
    }

    try {
      setSubmitting(true)
      const authenticatedUser = mode === 'login'
        ? await loginUser({ email, password })
        : await registerUser({ name, email, password })
      setUser(authenticatedUser)
      navigate('/dashboard')
      toast.success(mode === 'login' ? 'Welcome back. You are now signed in.' : 'Registration complete. Your workspace is ready.')
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Authentication failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white">D</div>
          <div>
            <div className="text-2xl font-bold">DocuBrix</div>
            <div className="text-sm text-slate-500">Document intelligence workspace</div>
          </div>
        </div>

        <div className="mb-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Authentication</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{titleMap[mode]}</h1>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          {mode === 'register' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Full name</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" />
            </div>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'forgot' || mode === 'reset') && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="name@company.com" />
            </div>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'reset') && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="********" />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Update password'}
          </Button>
        </form>

        <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
          <Link to="/register" className="font-medium text-blue-700 hover:underline">Create account</Link>
          <Link to="/forgot-password" className="font-medium text-blue-700 hover:underline">Forgot password</Link>
          <Link to="/login" className="font-medium text-blue-700 hover:underline">Back to login</Link>
        </div>
      </div>
    </div>
  )
}

function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Overview</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

function StatCard({ label, value, hint, accent }) {
  const accentMap = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  }

  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span>
          <span className={cn('rounded-full px-2 py-1 text-xs font-semibold', accentMap[accent] || accentMap.slate)}>{hint}</span>
        </div>
        <div className="text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
      </CardContent>
    </Card>
  )
}

function DashboardPage() {
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
        toast.error(error.message || 'Unable to load the dashboard data.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const chartData = useMemo(
    () => Object.entries(summary.document_type_distribution || {}).map(([name, value]) => ({ name, value })),
    [summary],
  )

  const statusData = useMemo(
    () => Object.entries(summary.status_distribution || {}).map(([name, value]) => ({ name, value })),
    [summary],
  )

  const averageConfidence = summary.average_confidence == null ? 'N/A' : `${Number(summary.average_confidence).toFixed(2)}`

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Operational overview for document extraction, validation, and review workflows." actions={<Link className="link-chip" to="/processing">Upload document <ChevronRight className="h-3.5 w-3.5" /></Link>} />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((index) => (
            <Card key={index} className="h-28 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total documents" value={summary.total_documents || 0} hint="Stored" accent="blue" />
          <StatCard label="Needs review" value={summary.documents_needing_review || 0} hint="Flags" accent="amber" />
          <StatCard label="Average confidence" value={averageConfidence} hint="Quality" accent="green" />
          <StatCard label="Successful" value={summary.successful_documents || 0} hint="Processed" accent="slate" />
        </div>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Document type distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processing status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Recent documents</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="py-2 pr-4">Filename</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Confidence</th>
                  <th className="py-2 pr-4">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(summary.recent_documents || []).map((item) => (
                  <tr key={item.document_id || item.filename} className="hover:bg-slate-50">
                    <td className="py-3 pr-4 font-medium text-slate-900">{item.filename}</td>
                    <td className="py-3 pr-4">{item.document_type || 'unknown'}</td>
                    <td className="py-3 pr-4"><Badge variant={statusColors[item.status] || 'muted'}>{item.status || 'unknown'}</Badge></td>
                    <td className="py-3 pr-4">{safeFloat((item.confidence || {}).overall)?.toFixed(2) || 'N/A'}</td>
                    <td className="py-3 pr-4">{formatDate(item.upload_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function ProcessingPage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [documentResult, setDocumentResult] = useState(null)
  const [manualFields, setManualFields] = useState({})
  const [reviewSaving, setReviewSaving] = useState(false)

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to upload.')
      return
    }

    try {
      setUploading(true)
      const response = await uploadDocument(selectedFile)
      setDocumentResult(response)
      const fields = response.extracted_fields || {}
      setManualFields(Object.fromEntries(Object.entries(fields).filter(([key]) => key !== 'document_type')))
      toast.success('Document processed successfully.')
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Upload failed.')
    } finally {
      setUploading(false)
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
      <PageHeader title="Document Processing" subtitle="Upload a PDF or image and review the extracted data before final approval." />

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">Upload financial document</div>
                  <div className="text-sm text-slate-500">PDF, PNG, JPG, JPEG</div>
                </div>
              </div>
              <input
                type="file"
                className="mt-4 block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              />
            </div>
            <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
              {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : 'Process document'}
            </Button>
          </div>

          {selectedFile && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span>{selectedFile.name}</span>
              <span>{Math.round((selectedFile.size || 0) / 1024)} KB</span>
            </div>
          )}
        </CardContent>
      </Card>

      {documentResult && (
        <div className="mt-8 space-y-8">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Filename" value={documentResult.filename || '—'} hint="Document" accent="blue" />
            <StatCard label="Type" value={documentResult.document_type || 'unknown'} hint="Classification" accent="green" />
            <StatCard label="Status" value={documentResult.status || 'processed'} hint="Workflow" accent="slate" />
            <StatCard label="Confidence" value={safeFloat((documentResult.confidence || {}).overall) ? `${safeFloat((documentResult.confidence || {}).overall).toFixed(2)}` : 'N/A'} hint="Overall" accent="amber" />
          </div>

          <div className="grid gap-8 xl:grid-cols-[1.3fr_0.7fr]">
            <Card>
              <CardHeader>
                <CardTitle>Extracted information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="field-grid">
                  {Object.entries(documentResult.extracted_fields || {}).filter(([key]) => key !== 'document_type').map(([key, value]) => (
                    <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{key.replace('_', ' ')}</div>
                      <div className="mt-2 text-sm font-medium text-slate-900">{value || 'Not available'}</div>
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
                      <span className="font-medium text-slate-700">{key.replace('_', ' ')}</span>
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
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">{key.replace('_', ' ')}</label>
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

function LibraryPage() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

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

  const filteredDocuments = documents.filter((item) => {
    const typeMatch = typeFilter === 'all' || (item.document_type || 'unknown') === typeFilter
    const statusMatch = statusFilter === 'all' || (item.status || 'unknown') === statusFilter
    return typeMatch && statusMatch
  })

  const uniqueTypes = ['all', ...new Set(documents.map((item) => item.document_type || 'unknown'))]
  const uniqueStatuses = ['all', ...new Set(documents.map((item) => item.status || 'unknown'))]

  return (
    <>
      <PageHeader title="Document Library" subtitle="Search, filter, and inspect the full document corpus." />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Document type</label>
          <Select value={typeFilter} onValueChange={setTypeFilter} placeholder="Filter by type">
            {uniqueTypes.map((item) => (
              <SelectItem key={item} value={item}>{item === 'all' ? 'All types' : item}</SelectItem>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter} placeholder="Filter by status">
            {uniqueStatuses.map((item) => (
              <SelectItem key={item} value={item}>{item === 'all' ? 'All statuses' : item}</SelectItem>
            ))}
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading documents...</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Filename</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredDocuments.map((document) => (
                  <tr key={document.document_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{document.filename}</td>
                    <td className="px-4 py-3">{document.document_type || 'unknown'}</td>
                    <td className="px-4 py-3"><Badge variant={statusColors[document.status] || 'muted'}>{document.status || 'unknown'}</Badge></td>
                    <td className="px-4 py-3">{safeFloat((document.confidence || {}).overall)?.toFixed(2) || 'N/A'}</td>
                    <td className="px-4 py-3">{formatDate(document.upload_time)}</td>
                    <td className="px-4 py-3"><Link className="font-medium text-blue-700 hover:underline" to={`/documents/${document.document_id}`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function DocumentDetailPage() {
  const { documentId } = useParams()
  const [document, setDocument] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchDocumentById(documentId)
        setDocument(data)
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

  return (
    <>
      <PageHeader title="Document Details" subtitle={document.filename || 'Document overview'} actions={<Link className="link-chip" to="/library">Back to library</Link>} />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader>
            <CardTitle>Extracted fields</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="field-grid">
              {Object.entries(document.extracted_fields || {}).filter(([key]) => key !== 'document_type').map(([key, value]) => (
                <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{key.replace('_', ' ')}</div>
                  <div className="mt-2 text-sm font-medium text-slate-900">{value || 'Not available'}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="flex justify-between"><span>Document type</span><span className="font-medium text-slate-900">{document.document_type || 'unknown'}</span></div>
            <div className="flex justify-between"><span>Status</span><span className="font-medium text-slate-900">{document.status || 'unknown'}</span></div>
            <div className="flex justify-between"><span>Uploaded</span><span className="font-medium text-slate-900">{formatDate(document.upload_time)}</span></div>
            <div className="flex justify-between"><span>Confidence</span><span className="font-medium text-slate-900">{safeFloat((document.confidence || {}).overall)?.toFixed(2) || 'N/A'}</span></div>
          </CardContent>
        </Card>
      </div>

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

function ReviewQueuePage() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchDocuments()
        setDocuments(data.filter((item) => item.validation?.is_valid === false || !!(item.review_json && item.review_json.manual_corrections)))
      } catch (error) {
        toast.error(error.message || 'Unable to load review queue.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <>
      <PageHeader title="Review Queue" subtitle="Items flagged for human review are surfaced here for approval or correction." />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading review queue...</div>
          ) : documents.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No documents currently require review.</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Filename</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {documents.map((item) => (
                  <tr key={item.document_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{item.filename}</td>
                    <td className="px-4 py-3">{item.validation?.is_valid === false ? 'Validation failed' : 'Manual corrections recorded'}</td>
                    <td className="px-4 py-3">{safeFloat((item.confidence || {}).overall)?.toFixed(2) || 'N/A'}</td>
                    <td className="px-4 py-3"><Badge variant={statusColors[item.status] || 'warning'}>{item.status || 'review'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function AnalyticsPage() {
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

function SystemStatusPage() {
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

function ProfilePage({ user, onUserUpdated }) {
  const [name, setName] = useState(user.name)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    try {
      setSaving(true)
      const updatedUser = await updateCurrentUser({ name })
      onUserUpdated(updatedUser)
      toast.success('Profile updated successfully.')
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Unable to update profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Profile" subtitle="Professional identity and workspace context." />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-400 text-2xl font-bold text-white">{name.slice(0, 2).toUpperCase()}</div>
            <div className="text-2xl font-semibold text-slate-900">{name}</div>
            <div className="mt-1 text-sm capitalize text-slate-600">{user.role}</div>
            <div className="mt-5 text-sm text-slate-600">{user.email}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <Input value={user.email} readOnly />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
              <Input value={user.role} readOnly />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Organization</label>
              <Input value="DocuBrix workspace" readOnly />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={handleSave} disabled={saving || name.trim().length < 2}>
                {saving ? 'Saving...' : 'Save profile'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function SettingsPage({ user }) {
  return (
    <>
      <PageHeader title="Settings" subtitle="Administrative controls for the DocuBrix workspace." />

      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="account" className="p-4">
            <TabsList>
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="privacy">Privacy & Data</TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="space-y-4 p-3">
              <Input value={user.name} readOnly />
              <Input value={user.email} readOnly />
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> <span className="text-sm capitalize text-slate-600">Role: {user.role}</span></div>
            </TabsContent>
            <TabsContent value="profile" className="space-y-4 p-3">
              <Input value="DocuBrix workspace" readOnly />
              <Input value={user.role} readOnly />
              <Textarea value="Your document intelligence workspace." readOnly />
            </TabsContent>
            <TabsContent value="preferences" className="space-y-4 p-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Enable smart alerts</span><Badge variant="success">On</Badge></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Show summaries on dashboard</span><Badge variant="success">On</Badge></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Auto-approve low-risk docs</span><Badge variant="warning">Pilot</Badge></div>
            </TabsContent>
            <TabsContent value="notifications" className="space-y-4 p-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Email notifications</span><Badge variant="success">Enabled</Badge></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Slack updates</span><Badge variant="muted">Disabled</Badge></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Weekly digest</span><Badge variant="success">Enabled</Badge></div>
            </TabsContent>
            <TabsContent value="appearance" className="space-y-4 p-3">
              <Input value="Light" readOnly />
              <Input value="60% density" readOnly />
            </TabsContent>
            <TabsContent value="security" className="space-y-4 p-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Session timeout</span><Badge variant="success">Enabled</Badge></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>API access review</span><Badge variant="warning">Pending</Badge></div>
            </TabsContent>
            <TabsContent value="privacy" className="space-y-4 p-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Retention policy</span><Badge variant="muted">90 days</Badge></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Export controls</span><Badge variant="warning">Restricted</Badge></div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  )
}

function ComingSoonPage({ title }) {
  return (
    <>
      <PageHeader title={title} subtitle="This capability is currently under development." />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Sparkles className="h-8 w-8" /></div>
          <div className="text-xl font-semibold text-slate-900">Coming soon</div>
          <div className="max-w-lg text-sm text-slate-600">This capability is intentionally left as a polished placeholder while future backend features are developed.</div>
        </CardContent>
      </Card>
    </>
  )
}

export default App
