import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Bot,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock,
  Download,
  Edit3,
  FileText,
  Filter,
  FolderOpen,
  HelpCircle,
  Home,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UploadCloud,
  User,
  X,
  XCircle,
  Zap,
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

import {
  AUTH_TOKEN_KEY,
  askDocument,
  claimAdminRole,
  createConversation,
  createWorkflowRule,
  deleteConversation,
  deleteWorkflowRule,
  evaluateDocumentWorkflow,
  executeQueueAction,
  fetchAdminOverview,
  fetchConversation,
  fetchConversations,
  fetchCurrentUser,
  fetchDocumentById,
  fetchDocumentSummary,
  fetchDocuments,
  fetchHealth,
  fetchSearchStatus,
  fetchWorkflowLogs,
  fetchWorkflowQueue,
  fetchWorkflowRules,
  loginUser,
  logoutUser,
  registerUser,
  saveReview,
  searchDocuments,
  searchSemanticDocuments,
  sendChatMessage,
  updateConversation,
  updateCurrentUser,
  updateWorkflowRule,
  uploadDocument,
} from './api/client'
import { appShellNav, defaultStats } from './data/mockData'
import { Avatar, Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, Input, Select, SelectItem, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from './components/ui'
import { cn, formatDate, safeFloat } from './lib/utils'
import { statusColors, categoryColors } from './lib/constants'
import PageHeader from './components/PageHeader'
import StatCard from './components/StatCard'
import ClassificationBadge from './components/ClassificationBadge'
import ProcessingPage from './pages/ProcessingPage'
import LibraryPage from './pages/LibraryPage'
import ChatPage from './pages/ChatPage'
import DocumentDetailPage from './pages/DocumentDetailPage'
import ReviewQueuePage from './pages/ReviewQueuePage'
import AnalyticsPage from './pages/AnalyticsPage'
import WorkflowAutomationPage from './pages/WorkflowAutomationPage'
import SystemStatusPage from './pages/SystemStatusPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import LandingPage from './pages/LandingPage'
import CommandPalette from './components/CommandPalette'

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('docubrix_theme')
      if (saved) return saved
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    try {
      localStorage.setItem('docubrix_theme', theme)
    } catch {}
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

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
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-900 text-sm text-slate-500 dark:text-slate-400">Loading your workspace...</div>
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage user={user} theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage mode="login" setUser={setUser} />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage mode="register" setUser={setUser} />} />
      <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
      <Route path="/reset-password" element={<Navigate to="/login" replace />} />
      <Route
        path="*"
        element={
          user ? (
            <ProtectedLayout user={user} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme}>
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/processing" element={<ProcessingPage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/chat/:conversationId" element={<ChatPage />} />
                <Route path="/documents/:documentId" element={<DocumentDetailPage />} />
                <Route path="/review" element={<ReviewQueuePage user={user} />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                {user.role === 'admin' && <Route path="/status" element={<SystemStatusPage />} />}
                <Route path="/profile" element={<ProfilePage user={user} onUserUpdated={setUser} />} />
                <Route path="/settings" element={<SettingsPage user={user} />} />
                <Route path="/team" element={<ComingSoonPage title="Team management" />} />
                <Route path="/automation" element={<WorkflowAutomationPage user={user} onUserUpdated={setUser} />} />
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

function NotificationMenu({ align = 'right' }) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(3)
  const [items, setItems] = useState([
    {
      id: 1,
      title: '14-Class ML Classifier Online',
      desc: 'TF-IDF + Logistic Regression model active with calibrated probability scoring.',
      time: 'Just now',
      unread: true,
      tag: 'ML Model',
      tagColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    {
      id: 2,
      title: 'Spend Gate Policy Active',
      desc: 'High-value spend gate guarding invoices exceeding ₹1,000 threshold.',
      time: '15m ago',
      unread: true,
      tag: 'Workflow',
      tagColor: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      id: 3,
      title: 'PHI Shield Guarding Records',
      desc: 'HIPAA confidentiality policy active for prescriptions and clinical lab reports.',
      time: '1h ago',
      unread: true,
      tag: 'Security',
      tagColor: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    {
      id: 4,
      title: 'Production Schema Synchronized',
      desc: 'Database connection verified with Singapore regional routing.',
      time: '3h ago',
      unread: false,
      tag: 'System',
      tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
  ])

  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const markAllRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, unread: false })))
    setUnread(0)
  }

  return (
    <div className="relative inline-block" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
        onClick={() => setOpen((prev) => !prev)}
        title="Notifications"
        type="button"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
        )}
      </Button>

      {open && (
        <div
          className={cn(
            'absolute top-full mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100',
            align === 'left' ? 'left-0' : 'right-0'
          )}
        >
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800 px-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">Notifications</span>
              {unread > 0 && (
                <span className="rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 px-2 py-0.5 text-[10px] font-bold">
                  {unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium cursor-pointer"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'p-2.5 rounded-xl transition-colors text-left border',
                  item.unread ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40' : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', item.tagColor)}>
                    {item.tag}
                  </span>
                  <span className="text-[10px] text-slate-400">{item.time}</span>
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{item.title}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>

          <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800 text-center">
            <span className="text-[10px] text-slate-400">All systems active • Region: Singapore</span>
          </div>
        </div>
      )}
    </div>
  )
}

function ProtectedLayout({ user, children, mobileOpen, setMobileOpen, onLogout, theme, toggleTheme }) {
  const location = useLocation()
  const currentTitle = appShellNav.find((item) => item.path === location.pathname)?.label || 'Dashboard'
  const visibleNav = appShellNav.filter((item) => item.path !== '/status' || user.role === 'admin')
  const [cmdOpen, setCmdOpen] = useState(false)

  // Custom user avatar if set in localStorage
  const customAvatar = localStorage.getItem(`docubrix_avatar_${user.id || user.email}`)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} theme={theme} onToggleTheme={toggleTheme} />
      <div className="mx-auto flex max-w-[1600px]">
        <aside className={cn('fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 p-4 transition-transform lg:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full', 'lg:static')}>
          <div className="mb-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
            <Link to="/dashboard" className="flex items-center">
              <img src="/docubrix-logo.png" alt="DocuBrix" className="h-8 w-auto object-contain rounded bg-white px-1.5 py-0.5" />
            </Link>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Document intelligence</div>
          </div>

          <nav className="space-y-1">
            {visibleNav.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  'group flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'sidebar-item active border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : 'border-transparent text-slate-700 dark:text-slate-300 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
                onClick={() => setMobileOpen(false)}
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-sm border border-slate-100 dark:border-slate-700">
                    {item.path === '/dashboard' ? <LayoutDashboard className="h-3.5 w-3.5" /> : item.path === '/chat' ? <Bot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> : item.path === '/automation' ? <Zap className="h-3.5 w-3.5 text-amber-500" /> : item.comingSoon ? <Sparkles className="h-3.5 w-3.5" /> : <FolderOpen className="h-3.5 w-3.5" />}
                  </span>
                  {item.label}
                </span>
                {item.comingSoon && <Badge variant="muted">Soon</Badge>}
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-soft">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Workspace</div>
            <div className="flex items-center justify-between gap-3">
              <Link to="/profile" className="flex items-center gap-2 group">
                {customAvatar ? (
                  <img src={customAvatar} alt="avatar" className="h-9 w-9 rounded-full object-cover ring-2 ring-blue-500/40" />
                ) : (
                  <Avatar initials={user.name.slice(0, 2).toUpperCase()} className="h-9 w-9 bg-gradient-to-br from-blue-600 to-indigo-400" />
                )}
                <div className="truncate">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{user.name}</div>
                  <div className="text-xs capitalize text-slate-500 dark:text-slate-400">{user.role}</div>
                </div>
              </Link>
              <NotificationMenu align="left" />
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
            <div className="flex items-center justify-between px-4 py-3 lg:px-8">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden text-slate-700 dark:text-slate-300"
                  onClick={() => setMobileOpen((value) => !value)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <Link to="/dashboard" className="flex items-center lg:hidden">
                  <img src="/docubrix-logo.png" alt="DocuBrix" className="h-6 w-auto object-contain rounded bg-white px-1 py-0.5" />
                </Link>
                <div className="hidden lg:block">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Workspace</div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{currentTitle}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Clickable search button opening Command Palette */}
                <button
                  onClick={() => setCmdOpen(true)}
                  className="hidden items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:border-blue-400 transition cursor-pointer md:flex"
                  type="button"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span className="w-28 text-left text-slate-400">Quick jump…</span>
                  <kbd className="rounded bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                    ⌘K
                  </kbd>
                </button>

                {/* Theme Toggle Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="h-8 w-8 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
                </Button>

                <NotificationMenu align="right" />

                <Link to="/profile" className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 hover:border-blue-400 transition">
                  {customAvatar ? (
                    <img src={customAvatar} alt="avatar" className="h-8 w-8 rounded-full object-cover ring-2 ring-blue-500/40" />
                  ) : (
                    <Avatar initials={user.name.slice(0, 2).toUpperCase()} className="h-8 w-8 bg-gradient-to-br from-blue-600 to-indigo-400 text-xs" />
                  )}
                  <div className="hidden text-left text-sm md:block">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">{user.name}</div>
                    <div className="text-xs capitalize text-slate-500 dark:text-slate-400">{user.role}</div>
                  </div>
                </Link>

                <Button variant="ghost" size="icon" onClick={onLogout} className="text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          <main className="px-4 py-6 lg:px-8 page-enter">{children}</main>
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
  }

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()

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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950 px-4 py-10 transition-colors">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-soft sm:p-8">
        <div className="mb-6">
          <Link to="/" className="inline-block">
            <img src="/docubrix-logo.png" alt="DocuBrix" className="h-10 w-auto object-contain rounded bg-white px-2 py-0.5" />
          </Link>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Document intelligence workspace</div>
        </div>

        <div className="mb-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Authentication</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{titleMap[mode]}</h1>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          {mode === 'register' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Full name</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" required />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Email address</label>
            <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="name@company.com" required />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
            <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="At least 8 characters" required />
          </div>

          <Button type="submit" className="w-full active:scale-95 transition-transform" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          {mode === 'login' ? (
            <div>
              Don&apos;t have an account?{' '}
              <Link to="/register" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 hover:underline">
                Create an account
              </Link>
            </div>
          ) : (
            <div>
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 hover:underline">
                Sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
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
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              <thead>
                <tr className="text-left text-slate-600 dark:text-slate-400">
                  <th className="py-2 pr-4">Filename</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Confidence</th>
                  <th className="py-2 pr-4">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(summary.recent_documents || []).map((item) => (
                  <tr key={item.document_id || item.filename} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">{item.filename}</td>
                    <td className="py-3 pr-4"><ClassificationBadge classification={item.classification} documentType={item.document_type} /></td>
                    <td className="py-3 pr-4"><Badge variant={statusColors[item.status] || 'muted'}>{item.status || 'unknown'}</Badge></td>
                    <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">{safeFloat((item.confidence || {}).overall)?.toFixed(2) || 'N/A'}</td>
                    <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">{formatDate(item.upload_time)}</td>
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
