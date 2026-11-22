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
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
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

const statusColors = {
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

const categoryColors = {
  Financial: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Academic: 'bg-blue-50 text-blue-700 border-blue-200',
  Legal: 'bg-purple-50 text-purple-700 border-purple-200',
  Medical: 'bg-rose-50 text-rose-700 border-rose-200',
  Administrative: 'bg-amber-50 text-amber-700 border-amber-200',
  General: 'bg-slate-50 text-slate-700 border-slate-200',
}

function ClassificationBadge({ classification, documentType, showType = true, className }) {
  const method = classification?.method || 'heuristic_fallback'
  const confidence = classification?.confidence
  const model = classification?.model
  const category = classification?.category || 'General'
  const typeText = documentType || 'unknown'

  return (
    <div className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      {category && category !== 'General' && (
        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide', categoryColors[category] || categoryColors.General)}>
          {category}
        </span>
      )}
      {method === 'ml' ? (
        <Badge
          variant="default"
          className="bg-indigo-50 text-indigo-700 border border-indigo-200 gap-1 text-[11px] font-medium"
          title={model ? `Model: ${model}` : 'Machine Learning Classifier'}
        >
          <Sparkles className="h-3 w-3 text-indigo-500" />
          <span>{showType ? typeText.replace(/_/g, ' ') : 'ML'}</span>
          {typeof confidence === 'number' && (
            <span className="ml-0.5 rounded bg-indigo-100/80 px-1 py-0.2 text-[10px] font-semibold text-indigo-900">
              {(confidence * 100).toFixed(0)}%
            </span>
          )}
        </Badge>
      ) : (
        <Badge
          variant="muted"
          className="bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium capitalize"
          title="Rule-based pattern matching"
        >
          <span>{showType ? typeText.replace(/_/g, ' ') : 'Rule-based'}</span>
        </Badge>
      )}
    </div>
  )
}

function LandingPage({ user }) {
  const navigate = useNavigate()
  const [activeDomain, setActiveDomain] = useState('financial')

  const domainSamples = {
    financial: {
      name: 'Tax Invoice #INV-2026-9810',
      domain: 'Financial',
      color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
      accent: 'emerald',
      ruleBadge: 'Requires Financial Sign-Off (> ₹1,00,000 threshold)',
      ruleColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      confidence: '98.2%',
      summary: 'Commercial cloud infrastructure invoice from Apex Cloud Systems India Pvt. Ltd. (Connaught Place, New Delhi).',
      fields: [
        { label: 'Invoice No.', value: 'INV-2026-9810' },
        { label: 'Vendor Name', value: 'Apex Cloud Systems India Pvt. Ltd.' },
        { label: 'Total Amount', value: '₹3,45,000.00' },
        { label: 'GST (18% IGST)', value: '₹52,627.00' },
        { label: 'GSTIN (Delhi)', value: '07AAACD1234A1Z5' },
        { label: 'Due Date', value: 'December 15, 2026' },
      ],
      aiQuestion: 'What is the total due and does this require manual approval?',
      aiAnswer: 'The total invoice amount is ₹3,45,000.00 INR due on Dec 15, 2026. Because this exceeds the ₹1,00,000 spend threshold rule, DocuBrix has routed it to the Review Queue for financial supervisor sign-off [Page 1, Line 18].',
    },
    academic: {
      name: 'Official Academic Transcript & Grade Report',
      domain: 'Academic',
      color: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
      accent: 'blue',
      ruleBadge: 'Auto-Verified (University Registrar Seal Validated)',
      ruleColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      confidence: '99.1%',
      summary: 'Undergraduate academic grade card and verified cumulative performance transcript from National Institute of Technology, New Delhi.',
      fields: [
        { label: 'Student Name', value: 'Alex Morgan' },
        { label: 'Enrollment No.', value: 'ENR-2024-88410' },
        { label: 'Programme', value: 'B.Tech. Computer Science (Semester VII)' },
        { label: 'Cumulative CGPA', value: '9.15 / 10.0' },
        { label: 'Institution', value: 'National Institute of Technology, Delhi' },
        { label: 'Registrar Seal', value: 'Cryptographically Verified' },
      ],
      aiQuestion: 'What is the student\'s CGPA and enrollment status?',
      aiAnswer: 'Student Alex Morgan (Enrollment ENR-2024-88410) has a cumulative CGPA of 9.15/10.0 in B.Tech Computer Science Semester VII. The official seal was validated with 99.1% confidence [Page 1, Table 2].',
    },
    medical: {
      name: 'Specialist Clinical Prescription & Lab Rx',
      domain: 'Medical',
      color: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
      accent: 'purple',
      ruleBadge: 'Active PHI Shield (Patient Identifiers Redacted)',
      ruleColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      confidence: '97.8%',
      summary: 'Outpatient clinical diagnosis, vitals, and prescribed pharmaceutical regimen from Apollo Specialty Hospital, Sarita Vihar, New Delhi.',
      fields: [
        { label: 'Prescribing Physician', value: 'Dr. A. K. Sharma, MD' },
        { label: 'Medical Council Reg.', value: 'DMC-REG-2018-9941 (Delhi)' },
        { label: 'Prescription Code', value: 'RX-2026-7741' },
        { label: 'Medication', value: 'Amoxicillin 500mg (TID x 7d)' },
        { label: 'Patient Identity', value: '[REDACTED - HIPAA Guard]' },
        { label: 'Hospital Facility', value: 'Sarita Vihar, New Delhi - 110076' },
      ],
      aiQuestion: 'What medication is prescribed and are patient details safe?',
      aiAnswer: 'Prescription RX-2026-7741 authorizes Amoxicillin 500mg, 1 tablet TID for 7 days. All patient PII has been automatically redacted and stored under HIPAA vault rules [Page 1, Box B].',
    },
    legal: {
      name: 'Mutual Non-Disclosure Agreement (NDA)',
      domain: 'Legal',
      color: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
      accent: 'amber',
      ruleBadge: 'Flagged: Pending Legal Counsel Counter-Signature',
      ruleColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      confidence: '96.5%',
      summary: 'Bilateral confidentiality and intellectual property agreement governing proprietary software disclosures in Delhi-NCR.',
      fields: [
        { label: 'Document Type', value: 'Bilateral Mutual NDA' },
        { label: 'Disclosing Party', value: 'DocuBrix Technologies Pvt. Ltd., New Delhi' },
        { label: 'Receiving Party', value: 'Enterprise Infotech India Pvt. Ltd., Gurugram' },
        { label: 'Confidentiality Term', value: '36 Months from Execution' },
        { label: 'Governing Law', value: 'High Court of Delhi, New Delhi, India' },
        { label: 'Signature Audit', value: 'Party 1 Signed, Party 2 Pending' },
      ],
      aiQuestion: 'What is the confidentiality term and governing law?',
      aiAnswer: 'The NDA defines a 3-year (36 months) non-disclosure obligation under the exclusive jurisdiction of the High Court of Delhi, India. Counter-signature by Receiving Party is pending review [Page 3, Section 8].',
    },
    administrative: {
      name: 'Executive Office Circular #ADM-2026-108',
      domain: 'Administrative',
      color: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
      accent: 'sky',
      ruleBadge: 'Auto-Indexed to Knowledge Base & Broadcast',
      ruleColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
      confidence: '98.7%',
      summary: 'Executive operational circular regarding department compliance standards, review schedules, and formatting from Central Secretariat, New Delhi.',
      fields: [
        { label: 'Circular Ref', value: 'ADM/2026/CIR-108' },
        { label: 'Issuing Authority', value: 'Central Administrative Secretariat, New Delhi' },
        { label: 'Target Audience', value: 'Department Heads & Operational Units' },
        { label: 'Subject Matter', value: 'Operational Evaluation Protocol' },
        { label: 'Effective Date', value: 'Immediate Effect (Nov 2026)' },
        { label: 'Distribution', value: 'Delhi-NCR Departmental Broadcast' },
      ],
      aiQuestion: 'Who issued this circular and what are the main deadlines?',
      aiAnswer: 'Circular ADM/2026/CIR-108 was issued by the Central Administrative Secretariat, New Delhi, mandating operational compliance standards and review timetables [Page 1, Item 4].',
    },
  }

  const curSample = domainSamples[activeDomain]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <img src="/docubrix-logo.png" alt="DocuBrix" className="h-9 w-auto object-contain rounded-lg bg-white/95 px-2.5 py-1 shadow-sm" />
            </Link>
            <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-400 border border-blue-500/20">
              AI Lifecycle &amp; Workflows
            </span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Button onClick={() => navigate('/dashboard')} className="bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-600/20">
                Go to Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/login')} className="text-slate-300 hover:text-white hover:bg-slate-900 text-sm">
                  Sign In
                </Button>
                <Button onClick={() => navigate('/login')} className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm shadow-lg shadow-blue-600/20">
                  Launch Workspace <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* 1. Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-20 px-6 max-w-7xl mx-auto text-center">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[320px] bg-blue-600/15 blur-[130px] rounded-full pointer-events-none" />
          
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-400 mb-6 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-blue-300" />
            <span>Effortless Multi-Domain Document Understanding &amp; Governance</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-none mb-6">
            Intelligent Document Automation. <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
              Made Effortless for Everyone.
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-300 mb-10 leading-relaxed font-normal">
            Stop drowning in invoices, transcripts, medical slips, and contracts. DocuBrix reads messy documents, extracts key fields with 98%+ precision, triggers automated compliance checks, and lets you ask questions with zero hallucinations.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <Button size="lg" onClick={() => navigate(user ? '/dashboard' : '/login')} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-xl font-semibold shadow-xl shadow-blue-600/25 flex items-center gap-2 text-base">
              Launch Workspace Free <ArrowRight className="h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => {
              const el = document.getElementById('interactive-demo')
              if (el) el.scrollIntoView({ behavior: 'smooth' })
            }} className="border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 px-7 py-3.5 rounded-xl font-medium text-base">
              See Live Interactive Demo
            </Button>
          </div>

          {/* User Value Metric Sentinel Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto border border-slate-800/80 bg-slate-900/40 backdrop-blur rounded-2xl p-4 text-left">
            <div className="p-3 border-r border-slate-800/60">
              <div className="text-2xl font-bold text-white">5 Domains</div>
              <div className="text-xs text-slate-400">Financial, Academic, Medical, Legal, Admin</div>
            </div>
            <div className="p-3 border-r border-slate-800/60">
              <div className="text-2xl font-bold text-emerald-400">98.6% Accuracy</div>
              <div className="text-xs text-slate-400">Multi-Signal Confidence Scoring</div>
            </div>
            <div className="p-3 border-r border-slate-800/60">
              <div className="text-2xl font-bold text-amber-400">Automated Gates</div>
              <div className="text-xs text-slate-400">Spend Limits, PHI Vault &amp; Approvals</div>
            </div>
            <div className="p-3">
              <div className="text-2xl font-bold text-purple-400">Grounded RAG</div>
              <div className="text-xs text-slate-400">Exact Page &amp; Line Citations</div>
            </div>
          </div>
        </section>

        {/* 2. Interactive Product Feature Showcase (HomePilot Style) */}
        <section id="interactive-demo" className="py-16 border-t border-slate-800/60 bg-slate-900/20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold mb-3 border border-blue-500/20">
                <FileText className="h-3.5 w-3.5" />
                <span>Interactive Live Demo</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">See How DocuBrix Understands Any Document</h2>
              <p className="text-sm text-slate-400">Select any document type below to see how DocuBrix extracts structured data, runs rule checks, and answers questions in real-time.</p>
            </div>

            {/* Domain Selector Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
              {[
                { id: 'financial', label: 'Financial (Invoices)', icon: '🧾' },
                { id: 'academic', label: 'Academic (Transcripts)', icon: '🎓' },
                { id: 'medical', label: 'Medical (Prescriptions)', icon: '🩺' },
                { id: 'legal', label: 'Legal (NDAs / Contracts)', icon: '⚖️' },
                { id: 'administrative', label: 'Administrative (Notices)', icon: '🏛️' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setActiveDomain(d.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                    activeDomain === d.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 border border-blue-500'
                      : 'bg-slate-900/70 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span>{d.icon}</span>
                  <span>{d.label}</span>
                </button>
              ))}
            </div>

            {/* Interactive Document Preview Card */}
            <div className="border border-slate-800 bg-slate-900/60 backdrop-blur rounded-2xl p-6 sm:p-8 shadow-2xl">
              <div className="flex flex-col md:flex-row items-start justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${curSample.color}`}>
                      {curSample.domain}
                    </span>
                    <span className="text-xs text-slate-400">Confidence: <strong className="text-emerald-400">{curSample.confidence}</strong></span>
                  </div>
                  <h3 className="text-xl font-bold text-white">{curSample.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">{curSample.summary}</p>
                </div>
                <div className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 ${curSample.ruleColor}`}>
                  <Zap className="h-4 w-4 shrink-0" />
                  <span>{curSample.ruleBadge}</span>
                </div>
              </div>

              {/* Parsed Fields Grid */}
              <div className="mt-6">
                <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
                  <span>Extracted Structured Key-Value Entities</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {curSample.fields.map((f, i) => (
                    <div key={i} className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                      <div className="text-[11px] text-slate-400 font-medium">{f.label}</div>
                      <div className="text-sm font-semibold text-slate-100 mt-0.5 truncate">{f.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conversational Grounded AI Dialogue Preview */}
              <div className="mt-6 pt-6 border-t border-slate-800/80">
                <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <Bot className="h-3.5 w-3.5 text-purple-400" />
                  <span>Grounded AI Assistant Q&amp;A (Zero Hallucination with Citations)</span>
                </div>
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs">
                    <span className="font-bold text-slate-400 shrink-0">User:</span>
                    <span className="text-slate-300 italic">&ldquo;{curSample.aiQuestion}&rdquo;</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs bg-purple-950/20 border border-purple-500/20 rounded-lg p-3">
                    <span className="font-bold text-purple-400 shrink-0">DocuBrix:</span>
                    <span className="text-slate-200">{curSample.aiAnswer}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. "How It Works" 3-Step Visual Process */}
        <section className="py-20 border-t border-slate-800/60 bg-slate-950">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">How DocuBrix Works for You</h2>
              <p className="text-sm text-slate-400">From raw messy file to fully verified actions in three automated steps.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 relative">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-base mb-4 border border-blue-500/20">
                  1
                </div>
                <h3 className="font-semibold text-lg text-white mb-2">Drop Any File</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Upload invoices, student transcripts, medical slips, or contracts in PDF, PNG, or JPG formats. DocuBrix cleans up noise and runs optical character recognition automatically.
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 relative">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-base mb-4 border border-amber-500/20">
                  2
                </div>
                <h3 className="font-semibold text-lg text-white mb-2">Instant Understanding &amp; Rules</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Multi-signal heuristics classify your document, extract entities, compute confidence scores, and evaluate active workflow rules like spend limits and HIPAA privacy safeguards.
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 relative">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-base mb-4 border border-purple-500/20">
                  3
                </div>
                <h3 className="font-semibold text-lg text-white mb-2">Review, Export &amp; Chat</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Approve flagged files in the Review Queue, export clean CSV audit trails for compliance auditors, or query your document corpus with our citation-grounded AI assistant.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Core User Benefits Grid */}
        <section className="py-20 border-t border-slate-800/60 bg-slate-900/30">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Core User Capabilities</h2>
              <p className="text-sm text-slate-400">Everything modern businesses, educational institutes, and healthcare organizations need in one clean workspace.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-base text-white mb-2">Zero-Manual Data Entry</h3>
                <p className="text-xs text-slate-400 leading-relaxed">Instantly parses complex tables, totals, invoice IDs, and signatures with multi-signal confidence metrics.</p>
              </div>

              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
                  <Zap className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-base text-white mb-2">Automated Policy Rules</h3>
                <p className="text-xs text-slate-400 leading-relaxed">Set custom rules: flag high-value spend, enforce low-confidence human review, and protect confidential records.</p>
              </div>

              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4">
                  <Bot className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-base text-white mb-2">Grounded AI Chat</h3>
                <p className="text-xs text-slate-400 leading-relaxed">Interrogate your document repository in plain English. Every response includes page and paragraph evidence citations.</p>
              </div>

              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-base text-white mb-2">Audit-Ready Trail (CSV)</h3>
                <p className="text-xs text-slate-400 leading-relaxed">Track every review decision, timestamp, and status change. Export full CSV audit logs in a single click.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Enterprise Architecture & Tech Stack (Placed below features, as Dhruv recommended) */}
        <section className="py-20 border-t border-slate-800/60 bg-slate-950">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold mb-3 border border-slate-700">
                <Sliders className="h-3.5 w-3.5 text-blue-400" />
                <span>Under the Hood</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Enterprise-Grade Technical Architecture</h2>
              <p className="text-sm text-slate-400">Engineered with modern decoupled services, sub-second latency, cryptographic user tenancy, and scalable cloud hosting.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
                <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Frontend Layer</div>
                <div className="font-semibold text-white text-sm mb-1">React 18 + Tailwind CSS</div>
                <p className="text-xs text-slate-400">Vite-powered SPA, Lucide UI icons, responsive multi-view workspace with live telemetry charts.</p>
              </div>
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">API &amp; Backend</div>
                <div className="font-semibold text-white text-sm mb-1">FastAPI + Python 3.11</div>
                <p className="text-xs text-slate-400">Asynchronous REST endpoints, SQLAlchemy ORM, deterministic rule engine, and Pytest coverage (90/90 tests).</p>
              </div>
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
                <div className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-1">AI &amp; Vector Index</div>
                <div className="font-semibold text-white text-sm mb-1">ChromaDB + Gemini 2.5</div>
                <p className="text-xs text-slate-400">Dense sentence embeddings, chunk-level vector search with fail-safe fallback and verbatim citations.</p>
              </div>
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">Cloud Infrastructure</div>
                <div className="font-semibold text-white text-sm mb-1">Render PaaS Cloud Deploy</div>
                <p className="text-xs text-slate-400">Automated Git deployment pipelines, PBKDF2-HMAC password encryption, and multi-tenant isolation.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. CTA Banner */}
        <section className="py-16 border-t border-slate-800/60 bg-gradient-to-b from-slate-950 to-blue-950/30 text-center px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Ready to Automate Your Document Workflow?</h2>
            <p className="text-slate-300 text-sm sm:text-base mb-8 max-w-xl mx-auto">Experience the full power of autonomous document classification, spend safeguard rules, and citation-grounded AI.</p>
            <Button size="lg" onClick={() => navigate(user ? '/dashboard' : '/login')} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-xl font-semibold shadow-xl shadow-blue-600/30 text-base">
              Launch Workspace Now <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </section>
      </main>

      {/* 7. Product Footer */}
      <footer className="border-t border-slate-800/80 py-8 px-6 text-xs text-slate-500 bg-slate-950">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/docubrix-logo.png" alt="DocuBrix" className="h-6 w-auto object-contain rounded bg-white/95 px-1.5 py-0.5" />
            <span className="font-semibold text-slate-300">DocuBrix</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Intelligent Document Processing &amp; Workflow Automation</span>
          </div>
          <div className="flex items-center gap-6 text-slate-400">
            <a href="#interactive-demo" className="hover:text-slate-200 transition-colors">Features</a>
            <span>&bull;</span>
            <span className="hover:text-slate-200 transition-colors">Security &amp; PHI Shield</span>
            <span>&bull;</span>
            <span className="hover:text-slate-200 transition-colors">API Architecture</span>
          </div>
          <p className="text-slate-500">&copy; 2026 DocuBrix Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
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
      <Route path="/" element={<LandingPage user={user} />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage mode="login" setUser={setUser} />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage mode="register" setUser={setUser} />} />
      <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
      <Route path="/reset-password" element={<Navigate to="/login" replace />} />
      <Route
        path="*"
        element={
          user ? (
            <ProtectedLayout user={user} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} onLogout={handleLogout}>
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/processing" element={<ProcessingPage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/chat/:conversationId" element={<ChatPage />} />
                <Route path="/documents/:documentId" element={<DocumentDetailPage />} />
                <Route path="/review" element={<ReviewQueuePage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                {user.role === 'admin' && <Route path="/status" element={<SystemStatusPage />} />}
                <Route path="/profile" element={<ProfilePage user={user} onUserUpdated={setUser} />} />
                <Route path="/settings" element={<SettingsPage user={user} />} />
                <Route path="/team" element={<ComingSoonPage title="Team management" />} />
                <Route path="/automation" element={<WorkflowAutomationPage />} />
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
        className="relative h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
        onClick={() => setOpen((prev) => !prev)}
        title="Notifications"
        type="button"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </Button>

      {open && (
        <div
          className={cn(
            'absolute top-full mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100',
            align === 'left' ? 'left-0' : 'right-0'
          )}
        >
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 px-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-900">Notifications</span>
              {unread > 0 && (
                <span className="rounded-full bg-red-50 text-red-600 px-2 py-0.5 text-[10px] font-bold">
                  {unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
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
                  item.unread ? 'bg-blue-50/40 border-blue-100' : 'bg-slate-50/50 border-slate-100'
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', item.tagColor)}>
                    {item.tag}
                  </span>
                  <span className="text-[10px] text-slate-400">{item.time}</span>
                </div>
                <div className="text-xs font-semibold text-slate-800">{item.title}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>

          <div className="pt-2.5 mt-2.5 border-t border-slate-100 text-center">
            <span className="text-[10px] text-slate-400">All systems active • Region: Singapore</span>
          </div>
        </div>
      )}
    </div>
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
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
            <Link to="/dashboard" className="flex items-center">
              <img src="/docubrix-logo.png" alt="DocuBrix" className="h-8 w-auto object-contain" />
            </Link>
            <div className="mt-1 text-xs text-slate-500">Document intelligence</div>
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
                    {item.path === '/dashboard' ? <LayoutDashboard className="h-3.5 w-3.5" /> : item.path === '/chat' ? <Bot className="h-3.5 w-3.5 text-blue-600" /> : item.path === '/automation' ? <Zap className="h-3.5 w-3.5 text-amber-500" /> : item.comingSoon ? <Sparkles className="h-3.5 w-3.5" /> : <FolderOpen className="h-3.5 w-3.5" />}
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
              <NotificationMenu align="left" />
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
                <Link to="/dashboard" className="flex items-center lg:hidden">
                  <img src="/docubrix-logo.png" alt="DocuBrix" className="h-6 w-auto object-contain" />
                </Link>
                <div className="hidden lg:block">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Workspace</div>
                  <div className="text-lg font-semibold text-slate-900">{currentTitle}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
                  <Search className="h-4 w-4 text-slate-500" />
                  <input className="w-40 border-0 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none" placeholder="Search" />
                </div>
                <NotificationMenu align="right" />
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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <div className="mb-6">
          <Link to="/" className="inline-block">
            <img src="/docubrix-logo.png" alt="DocuBrix" className="h-10 w-auto object-contain" />
          </Link>
          <div className="mt-1 text-sm text-slate-500">Document intelligence workspace</div>
        </div>

        <div className="mb-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Authentication</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{titleMap[mode]}</h1>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          {mode === 'register' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Full name</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" required />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
            <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="name@company.com" required />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
            <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="At least 8 characters" required />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          {mode === 'login' ? (
            <div>
              Don&apos;t have an account?{' '}
              <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-500 hover:underline">
                Create an account
              </Link>
            </div>
          ) : (
            <div>
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-500 hover:underline">
                Sign in
              </Link>
            </div>
          )}
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
    <Card className="h-full min-w-0 overflow-hidden">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 truncate">{label}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold shrink-0', accentMap[accent] || accentMap.slate)}>{hint}</span>
        </div>
        <div
          className="text-xl font-semibold tracking-tight text-slate-900 truncate"
          title={typeof value === 'string' ? value : undefined}
        >
          {value}
        </div>
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
                    <td className="py-3 pr-4"><ClassificationBadge classification={item.classification} documentType={item.document_type} /></td>
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

const DEMO_PRESETS = [
  {
    id: 'financial',
    label: 'Sample Tax Invoice (₹4,59,000)',
    icon: '📄',
    badge: 'Financial',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    filename: 'Sample_Invoice_INV2026.txt',
    text: `TAX INVOICE
TechCorp Solutions India Pvt. Ltd.
DLF Cyber City, Building 10, Tower B, Gurugram, Delhi-NCR - 122002
Invoice No: INV-2026-9041
Invoice Date: 2026-11-18
Due Date: 2026-12-18
Bill To: Global Logistics India Pvt. Ltd., Okhla Phase III, New Delhi - 110020

Description: Cloud Infrastructure & AI Pipeline Hosting Services
Amount: ₹4,25,000.00
Tax Due: ₹34,000.00
Total Due: ₹4,59,000.00
Payment Terms: Net 30
Vendor Contact: accounts@techcorp-solutions.in
GSTIN: 07AAAAA0000A1Z5`,
  },
  {
    id: 'academic',
    label: 'Academic Transcript',
    icon: '🎓',
    badge: 'Academic',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    filename: 'Sample_Academic_Transcript.txt',
    text: `NATIONAL INSTITUTE OF TECHNOLOGY, DELHI
CAMPUS REGISTRAR & ACADEMIC EVALUATION DIVISION
Narela Sub-City, Delhi - 110040
ACADEMIC TRANSCRIPT / GRADE REPORT
Date: 2026-11-15

Candidate Name: Alex Morgan
Enrollment No: 02219051720
University: National Institute of Technology, Delhi
Course: Bachelor of Technology (B.Tech) - Computer Science
Semester: VII (Academic Year 2026)

Course Code | Course Title | Credits | Grade
CS-401      | Deep Learning & Neural Architectures | 4 | A+
CS-403      | Natural Language Processing & LLMs   | 4 | O
CS-405      | Cloud Computing & Microservices      | 3 | A+
CS-407      | Document AI & Workflow Automation    | 4 | O
CS-451      | Autonomous Systems Capstone          | 4 | O

Semester SGPA: 9.20
Cumulative CGPA: 9.15
Result: Passed with Distinction`,
  },
  {
    id: 'medical',
    label: 'Medical Prescription (Apollo)',
    icon: '🏥',
    badge: 'Medical',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    filename: 'Sample_Prescription_Apollo.txt',
    text: `APOLLO HOSPITALS ENTERPRISE LTD.
Hospital: Apollo Specialty Hospital, Sarita Vihar, Delhi Mathura Road, New Delhi - 110076
Date: 2026-11-15
PRESCRIPTION & CLINICAL SUMMARY

Patient Name: Rajesh Sharma
Age: 52 years / Male
Patient ID: MED-2026-77821
Doctor: Dr. Arvind Mehra, MD (Cardiology) - DMC Reg. No. 48821

Diagnosis: Primary Hypertension & Mild Dyslipidemia
Vitals: BP: 142/90 mmHg | Pulse: 78 bpm | SpO2: 98%

Rx:
1. Tab. Telmisartan 40mg - 1 tab once daily in morning (30 days)
2. Tab. Atorvastatin 10mg - 1 tab once daily at bedtime (30 days)

Special Instructions: Low sodium diet, 30 min daily walking.
CONFIDENTIAL MEDICAL RECORD - PROTECTED HEALTH INFORMATION (PHI)`,
  },
  {
    id: 'legal',
    label: 'Mutual NDA Agreement',
    icon: '⚖️',
    badge: 'Legal',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    filename: 'Sample_Mutual_NDA_Legal.txt',
    text: `MUTUAL NON-DISCLOSURE AND CONFIDENTIALITY AGREEMENT
Effective Date: 2026-11-10

This Mutual Non-Disclosure Agreement is entered into on 2026-11-10, between:
Disclosing Party: DocuBrix Technologies Pvt. Ltd., Barakhamba Road, Connaught Place, New Delhi - 110001
Receiving Party: Horizon Ventures India Pvt. Ltd., Cyber City, Gurugram, Delhi-NCR - 122002

1. Purpose: Strategic evaluation of document intelligence and workflow automation systems.
2. Confidential Information: Technical designs, algorithms, architectures, and proprietary models.
Term: The non-disclosure obligations shall survive for three (3) years from the Effective Date.
Governing Law: This Agreement shall be governed by and construed in accordance with the laws of India, and the parties submit to the exclusive jurisdiction of the Courts at New Delhi.

Signed for Disclosing Party: Alex Morgan, Lead Engineer
Signed for Receiving Party: Marcus Vance, Managing Partner`,
  },
  {
    id: 'administrative',
    label: 'Official Executive Notice',
    icon: '📋',
    badge: 'Administrative',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    filename: 'Sample_Official_Notice.txt',
    text: `CENTRAL REGISTRATION & ADMINISTRATIVE SECRETARIAT
OFFICE OF THE REGISTRAR / GENERAL ADMINISTRATION
Sector 4, Business District, New Delhi - 110001
OFFICE MEMORANDUM / OFFICIAL NOTICE

Reference No: ADM/GA/2026/NOT-881
Date: 2026-09-08
Subject: Autonomous Examination Scheduling & Project Review Timetable

To: All Department Directors, Senior Leads, and Operational Managers
In accordance with executive operational guidelines, the Administrative Council has approved the updated scheduling timetable and operational review guidelines. All departments shall comply with immediate effect.
By Order of the Competent Authority
Registrar / Joint Secretary`,
  },
  {
    id: 'general',
    label: 'Candidate Software Resume',
    icon: '💼',
    badge: 'General',
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
    filename: 'Sample_Candidate_Resume.txt',
    text: `ALEX MORGAN
Location: New Delhi, India | Email: alex.morgan@example.com | Phone: +91 98101 23456
GitHub: github.com/alexmorgan-dev | LinkedIn: linkedin.com/in/alexmorgan

PROFESSIONAL SUMMARY
Full Stack Software Engineer with expertise in building FastAPI microservices, React single-page applications, and document intelligence workflows.

TECHNICAL SKILLS
Languages: Python, JavaScript, TypeScript, SQL
Frameworks & Tools: FastAPI, React 18, Vite, TailwindCSS, PyTorch, Scikit-learn, PostgreSQL, Docker

WORK EXPERIENCE
Software Engineering Intern — Cloud Automation Labs (2025 - Present)
• Built intelligent document extraction services handling multi-format inputs.
• Implemented JWT token security with role-based access control.

EDUCATION
Bachelor of Technology in Computer Science & Automation, New Delhi
CGPA: 8.85 / 10.0 (2022 - 2026)`,
  },
]

function ProcessingPage() {
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
                        <div className="mt-2 text-sm font-medium text-slate-900 break-words">{value || <span className="text-slate-400 font-normal italic">Not available</span>}</div>
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

function LibraryPage() {
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

function ChatPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { conversationId: routeConvId } = useParams()
  const scopedDocId = searchParams.get('document_id')

  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(routeConvId || null)
  const [activeConv, setActiveConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [loadingChat, setLoadingChat] = useState(false)
  const [sending, setSending] = useState(false)
  const [searchStatus, setSearchStatus] = useState(null)
  const [editingTitleId, setEditingTitleId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [chatError, setChatError] = useState(null)
  const [scopedDoc, setScopedDoc] = useState(null)

  const messagesEndRef = useRef(null)

  useEffect(() => {
    fetchSearchStatus().then(setSearchStatus).catch(() => {})
  }, [])

  useEffect(() => {
    if (scopedDocId) {
      fetchDocumentById(scopedDocId)
        .then(setScopedDoc)
        .catch(() => setScopedDoc(null))
    } else {
      setScopedDoc(null)
    }
  }, [scopedDocId])

  // Load conversations list
  useEffect(() => {
    const loadConvs = async () => {
      try {
        setLoadingList(true)
        const list = await fetchConversations()
        setConversations(list)

        if (routeConvId) {
          setActiveConvId(routeConvId)
        } else if (scopedDocId) {
          const existing = list.find((c) => c.document_id === scopedDocId)
          if (existing) {
            setActiveConvId(existing.id)
          } else {
            const created = await createConversation({ document_id: scopedDocId })
            setConversations([created, ...list])
            setActiveConvId(created.id)
          }
        } else if (list.length > 0) {
          setActiveConvId(list[0].id)
        } else {
          const created = await createConversation()
          setConversations([created])
          setActiveConvId(created.id)
        }
      } catch (err) {
        toast.error('Unable to load conversations.')
      } finally {
        setLoadingList(false)
      }
    }

    loadConvs()
  }, [routeConvId, scopedDocId])

  // Load active conversation messages
  useEffect(() => {
    if (!activeConvId) {
      setActiveConv(null)
      setMessages([])
      return
    }

    const loadChat = async () => {
      try {
        setLoadingChat(true)
        setChatError(null)
        const data = await fetchConversation(activeConvId)
        setActiveConv(data)
        setMessages(data.messages || [])
      } catch (err) {
        toast.error('Unable to load conversation messages.')
      } finally {
        setLoadingChat(false)
      }
    }

    loadChat()
  }, [activeConvId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const handleNewChat = async (docId = null) => {
    try {
      const created = await createConversation({ document_id: docId })
      setConversations((prev) => [created, ...prev])
      setActiveConvId(created.id)
      navigate(`/chat/${created.id}`)
      toast.success('New conversation started.')
    } catch (err) {
      toast.error('Unable to create new conversation.')
    }
  }

  const handleDeleteConv = async (e, convId) => {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this conversation?')) return
    try {
      await deleteConversation(convId)
      const remaining = conversations.filter((c) => c.id !== convId)
      setConversations(remaining)
      if (activeConvId === convId) {
        if (remaining.length > 0) {
          setActiveConvId(remaining[0].id)
          navigate(`/chat/${remaining[0].id}`)
        } else {
          handleNewChat()
        }
      }
      toast.success('Conversation deleted.')
    } catch (err) {
      toast.error('Unable to delete conversation.')
    }
  }

  const handleStartRename = (e, conv) => {
    e.stopPropagation()
    setEditingTitleId(conv.id)
    setEditingTitle(conv.title)
  }

  const handleSaveRename = async (e, convId) => {
    e.stopPropagation()
    const trimmed = editingTitle.trim()
    if (!trimmed) {
      setEditingTitleId(null)
      return
    }
    try {
      const updated = await updateConversation(convId, { title: trimmed })
      setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, title: updated.title } : c)))
      if (activeConv?.id === convId) {
        setActiveConv((prev) => ({ ...prev, title: updated.title }))
      }
      toast.success('Conversation renamed.')
    } catch (err) {
      toast.error('Unable to rename conversation.')
    } finally {
      setEditingTitleId(null)
    }
  }

  const handleSend = async (textToSend = null) => {
    const questionText = typeof textToSend === 'string' ? textToSend : input
    const trimmed = questionText.trim()
    if (!trimmed || !activeConvId || sending) return

    setInput('')
    setSending(true)
    setChatError(null)

    const optimisticUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUserMsg])

    try {
      const result = await sendChatMessage(activeConvId, trimmed)
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticUserMsg.id),
        result.user_message,
        result.assistant_message,
      ])
      if (result.conversation) {
        setActiveConv(result.conversation)
        setConversations((prev) =>
          prev.map((c) => (c.id === result.conversation.id ? { ...c, ...result.conversation } : c)),
        )
      }
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail || err.message || 'An error occurred while communicating with DocuBrix AI.'
      if (status === 503 && (detail.toLowerCase().includes('not configured') || detail.toLowerCase().includes('gemini_api_key'))) {
        setChatError('DocuBrix AI Assistant is offline because GEMINI_API_KEY is not configured on the backend.')
      } else {
        setChatError(detail)
      }
      toast.error(detail)
    } finally {
      setSending(false)
    }
  }

  const suggestedQuestions = [
    'What are the total payment amounts across all my uploaded invoices?',
    'List any overdue or pending payment items found in the documents.',
    'Summarize the vendors, suppliers, and service providers mentioned.',
    'Are there any validation warnings or discrepancies flagged in my files?',
  ]

  return (
    <>
      <PageHeader
        title="DocuBrix AI Assistant"
        subtitle="Multi-turn, cross-document reasoning grounded strictly in your verified financial documents."
      />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Left column: Conversations sidebar */}
        <Card className="flex flex-col h-[750px] overflow-hidden border-slate-200">
          <div className="p-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-slate-900">Conversations</span>
            </div>
            <Button
              size="sm"
              onClick={() => handleNewChat()}
              className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white h-8 px-2.5"
            >
              <Plus className="h-3.5 w-3.5" />
              New Chat
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingList ? (
              <div className="p-4 text-xs text-slate-500 text-center flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                Loading chats...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-xs text-slate-400 text-center">
                No conversations yet. Click "+ New Chat" to begin.
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === activeConvId
                const isEditing = editingTitleId === conv.id
                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      if (!isEditing) {
                        setActiveConvId(conv.id)
                        navigate(`/chat/${conv.id}`)
                      }
                    }}
                    className={cn(
                      'group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-xs cursor-pointer transition-all border',
                      isActive
                        ? 'border-blue-200 bg-blue-50/80 text-blue-900 font-medium shadow-xs'
                        : 'border-transparent text-slate-700 hover:bg-slate-100 hover:border-slate-200',
                    )}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      {isEditing ? (
                        <input
                          autoFocus
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(e, conv.id)
                            if (e.key === 'Escape') setEditingTitleId(null)
                          }}
                          onBlur={(e) => handleSaveRename(e, conv.id)}
                          className="w-full rounded border border-blue-400 bg-white px-1.5 py-0.5 text-xs font-normal text-slate-900 focus:outline-none"
                        />
                      ) : (
                        <>
                          <div className="truncate font-medium">{conv.title}</div>
                          {conv.document_id && (
                            <div className="text-[10px] text-blue-600 truncate flex items-center gap-1 mt-0.5">
                              <FileText className="h-2.5 w-2.5" /> Scoped document
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(e, conv)}
                          className="p-1 hover:text-blue-600 rounded text-slate-400"
                          title="Rename"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteConv(e, conv.id)}
                          className="p-1 hover:text-red-600 rounded text-slate-400"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div className="p-2.5 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-600">Model:</span>
              <span className="font-mono text-slate-700">{searchStatus?.llm_qa?.model || 'gemini-2.5-flash'}</span>
            </div>
          </div>
        </Card>

        {/* Right column: Chat area */}
        <Card className="flex flex-col h-[750px] overflow-hidden border-slate-200 shadow-soft">
          {/* Chat Header */}
          <div className="px-5 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {activeConv?.title || 'DocuBrix AI Assistant'}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {activeConv?.document_id || scopedDoc ? (
                    <Badge variant="default" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 gap-1">
                      <FileText className="h-2.5 w-2.5" />
                      Scoped: {scopedDoc?.filename || 'Specific Document'}
                    </Badge>
                  ) : (
                    <Badge variant="muted" className="text-[10px] gap-1">
                      <Sparkles className="h-2.5 w-2.5 text-blue-500" />
                      Scope: All Workspace Documents (Cross-Document)
                    </Badge>
                  )}
                  <span>•</span>
                  <span>Strictly grounded</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {searchStatus && (
                searchStatus.llm_qa?.available ? (
                  <Badge variant="success" className="text-[11px] gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Grounded RAG Ready
                  </Badge>
                ) : (
                  <Badge variant="muted" className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 gap-1" title={searchStatus.llm_qa?.reason}>
                    <AlertCircle className="h-3 w-3 text-amber-600" /> Gemini Offline
                  </Badge>
                )
              )}
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/40">
            {loadingChat ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                Loading conversation...
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 mb-4 shadow-sm">
                  <Bot className="h-7 w-7" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">DocuBrix AI Assistant</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-sm">
                  Ask multi-turn questions grounded in your uploaded documents. I will retrieve verified chunks and cite exact sources.
                </p>

                <div className="mt-6 w-full space-y-2 text-left">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Suggested Questions</div>
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(q)}
                      className="w-full text-left rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 transition-all shadow-xs flex items-center justify-between"
                    >
                      <span>{q}</span>
                      <ArrowRight className="h-3.5 w-3.5 opacity-40 shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, index) => {
                  const isUser = msg.role === 'user'
                  return (
                    <div
                      key={msg.id || index}
                      className={cn(
                        'flex flex-col',
                        isUser ? 'items-end' : 'items-start',
                      )}
                    >
                      <div className="flex items-start gap-2.5 max-w-[85%]">
                        {!isUser && (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white text-xs shadow-xs mt-0.5">
                            <Bot className="h-4 w-4" />
                          </div>
                        )}
                        <div
                          className={cn(
                            'rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs whitespace-pre-wrap',
                            isUser
                              ? 'bg-blue-600 text-white rounded-br-xs'
                              : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs',
                          )}
                        >
                          {msg.content}
                        </div>
                      </div>

                      {!isUser && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2.5 ml-9 max-w-[85%] space-y-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3 text-blue-500" />
                            <span>Retrieved Sources & Citations ({msg.sources.length})</span>
                          </div>
                          <div className="grid gap-1.5">
                            {msg.sources.map((src, sIdx) => (
                              <div
                                key={sIdx}
                                className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs shadow-xs"
                              >
                                <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-slate-700 mb-1">
                                  <span>
                                    {sIdx + 1}. {src.filename} (Chunk #{src.chunk_index})
                                  </span>
                                  {src.retrieval_method === 'semantic' ? (
                                    <Badge variant="default" className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200">
                                      Semantic: {(src.relevance_score * 100).toFixed(0)}%
                                    </Badge>
                                  ) : (
                                    <Badge variant="muted" className="text-[10px]">
                                      Keyword match
                                    </Badge>
                                  )}
                                </div>
                                <div className="font-mono text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100 max-h-24 overflow-y-auto">
                                  {src.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {sending && (
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white text-xs mt-0.5">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-2xl rounded-bl-xs bg-white border border-slate-200 px-4 py-3 text-sm text-slate-500 flex items-center gap-2 shadow-xs">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span>DocuBrix is reasoning over your documents...</span>
                    </div>
                  </div>
                )}

                {chatError && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Assistant Notice</div>
                      <div className="mt-0.5 leading-relaxed">{chatError}</div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Chat Input area */}
          <div className="p-3 border-t border-slate-200 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  activeConv?.document_id
                    ? 'Ask questions about this specific document...'
                    : 'Ask across all your documents (e.g. Which invoices are overdue?)...'
                }
                disabled={sending}
                className="flex-1 text-sm bg-slate-50 focus:bg-white"
              />
              <Button
                type="submit"
                disabled={sending || !input.trim()}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shrink-0 px-4"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span>Send</span>
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </>
  )
}

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

function DocumentDetailPage() {
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
                    <div className="mt-1.5 text-sm font-semibold text-slate-900 break-words">{value || <span className="text-slate-400 font-normal italic">Not available</span>}</div>
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

function ReviewQueuePage() {
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
      toast.error(err.message || 'Failed to update document status.')
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
                          <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs px-2.5 gap-1" onClick={() => handleAction(item.document_id, 'approve')}>
                            <Check className="h-3 w-3" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 h-7 text-xs px-2 gap-1" onClick={() => handleAction(item.document_id, 'flag')}>
                            <AlertCircle className="h-3 w-3" /> Flag
                          </Button>
                          <Button size="sm" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50 h-7 text-xs px-2 gap-1" onClick={() => handleAction(item.document_id, 'reject')}>
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

function WorkflowAutomationPage() {
  const [activeTab, setActiveTab] = useState('rules')
  const [rules, setRules] = useState([])
  const [queue, setQueue] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [newRuleModalOpen, setNewRuleModalOpen] = useState(false)
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    rule_type: 'auto_approval',
    min_confidence: '0.80',
    min_amount: '',
    target_status: 'approved',
  })

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
    try {
      const updated = await updateWorkflowRule(rule.id, { enabled: !rule.enabled })
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)))
      toast.success(`Rule "${rule.name}" is now ${!rule.enabled ? 'Enabled' : 'Disabled'}.`)
    } catch (err) {
      toast.error('Failed to update rule status.')
    }
  }

  const handleDeleteRule = async (ruleId) => {
    try {
      await deleteWorkflowRule(ruleId)
      setRules((prev) => prev.filter((r) => r.id !== ruleId))
      toast.success('Workflow rule removed.')
    } catch (err) {
      toast.error('Failed to delete rule.')
    }
  }

  const handleCreateRule = async (e) => {
    e.preventDefault()
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
      toast.error(err.message || 'Failed to create rule.')
    }
  }

  const handleQueueAction = async (docId, action) => {
    try {
      await executeQueueAction(docId, action, `Action ${action} executed from workflow console`)
      toast.success(`Document marked as ${action}d.`)
      loadData()
    } catch (err) {
      toast.error(err.message || 'Failed to update queue item.')
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
