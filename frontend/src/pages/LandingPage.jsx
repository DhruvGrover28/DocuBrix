import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Database,
  FileCheck2,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Lock,
  Moon,
  Receipt,
  ScanText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  Workflow,
  Zap,
} from 'lucide-react'
import { Button } from '../components/ui'

const DOMAIN_SAMPLES = {
  financial: {
    name: 'Commercial Tax Invoice #INV-2026-9810',
    domain: 'Financial Operations',
    tag: 'AP & Invoicing',
    color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    ruleBadge: 'Auto-Routed: High Spend Gate (> ₹1,00,000 threshold)',
    ruleColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    confidence: '98.8%',
    summary: 'Commercial cloud infrastructure invoice from Apex Cloud Systems India Pvt. Ltd. (Connaught Place, New Delhi).',
    fields: [
      { label: 'Invoice No.', value: 'INV-2026-9810' },
      { label: 'Vendor Name', value: 'Apex Cloud Systems India Pvt. Ltd.' },
      { label: 'Total Amount', value: '₹3,45,000.00' },
      { label: 'Tax (18% IGST)', value: '₹52,627.00' },
      { label: 'Vendor GSTIN', value: '07AAACD1234A1Z5' },
      { label: 'Payment Due', value: 'Dec 15, 2026' },
    ],
    aiQuestion: 'What is the total payable and why was it flagged?',
    aiAnswer: 'Total payable is ₹3,45,000.00 INR due Dec 15, 2026. DocuBrix evaluated your spend safeguard policy: amounts exceeding ₹1,00,000 automatically require finance lead sign-off in the Review Queue [Page 1, Line 18].',
  },
  academic: {
    name: 'Verified University Transcript & Grade Card',
    domain: 'Higher Education',
    tag: 'Admissions & Records',
    color: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    ruleBadge: 'Auto-Approved: Registrar Seal & Grade Threshold Validated',
    ruleColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    confidence: '99.4%',
    summary: 'Undergraduate academic grade card and verified cumulative performance transcript from National Institute of Technology, New Delhi.',
    fields: [
      { label: 'Student Name', value: 'Alex Morgan' },
      { label: 'Enrollment No.', value: 'ENR-2024-88410' },
      { label: 'Degree Programme', value: 'B.Tech. Computer Science (Semester VII)' },
      { label: 'Cumulative CGPA', value: '9.15 / 10.0' },
      { label: 'Issuing Body', value: 'National Institute of Technology, Delhi' },
      { label: 'Seal Verification', value: 'Tamper-Proof & Valid' },
    ],
    aiQuestion: 'What is the student\'s CGPA and is their record authentic?',
    aiAnswer: 'Student Alex Morgan holds a 9.15/10.0 CGPA in B.Tech CSE. The university seal and formatting match institutional templates with 99.4% confidence [Page 1, Table 2].',
  },
  medical: {
    name: 'Clinical Prescription & Specialist Lab Order',
    domain: 'Healthcare & Pharma',
    tag: 'Clinical Compliance',
    color: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
    ruleBadge: 'PHI Vault Active: Patient Identity Redacted',
    ruleColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    confidence: '98.1%',
    summary: 'Outpatient clinical diagnosis, vitals, and prescribed pharmaceutical regimen from Apollo Specialty Hospital, New Delhi.',
    fields: [
      { label: 'Attending Physician', value: 'Dr. A. K. Sharma, MD' },
      { label: 'Council Registration', value: 'DMC-REG-2018-9941 (Delhi)' },
      { label: 'Rx Reference', value: 'RX-2026-7741' },
      { label: 'Primary Medication', value: 'Amoxicillin 500mg (TID x 7d)' },
      { label: 'Patient Identifiers', value: '[REDACTED - HIPAA Guard]' },
      { label: 'Facility', value: 'Sarita Vihar, New Delhi - 110076' },
    ],
    aiQuestion: 'What drug was ordered and are patient identifiers secure?',
    aiAnswer: 'Prescription RX-2026-7741 orders Amoxicillin 500mg (3 times daily for 7 days). Patient PII has been automatically redacted by DocuBrix HIPAA safety guardrails [Page 1, Box B].',
  },
  legal: {
    name: 'Bilateral Mutual Non-Disclosure Agreement',
    domain: 'Legal Operations',
    tag: 'Contracts & Clauses',
    color: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    ruleBadge: 'Action Required: Pending Counter-Party Signature',
    ruleColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    confidence: '97.2%',
    summary: 'Bilateral confidentiality and intellectual property agreement governing proprietary software disclosures in Delhi-NCR.',
    fields: [
      { label: 'Agreement Type', value: 'Bilateral Mutual NDA' },
      { label: 'Disclosing Party', value: 'DocuBrix Technologies Pvt. Ltd.' },
      { label: 'Receiving Party', value: 'Enterprise Infotech India Pvt. Ltd.' },
      { label: 'Non-Disclosure Term', value: '36 Months from Execution' },
      { label: 'Jurisdiction', value: 'High Court of Delhi, New Delhi' },
      { label: 'Execution Status', value: '1 of 2 Signatures Present' },
    ],
    aiQuestion: 'What is the term length and governing law?',
    aiAnswer: 'The NDA defines a 36-month confidentiality obligation governed exclusively by the High Court of Delhi, India. Flagged for legal review due to missing counter-signature [Page 3, Section 8].',
  },
  administrative: {
    name: 'Executive Office Circular #ADM-2026-108',
    domain: 'Public & Enterprise',
    tag: 'Gov & Policy',
    color: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
    ruleBadge: 'Auto-Indexed to Enterprise Knowledge Base',
    ruleColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    confidence: '99.0%',
    summary: 'Executive operational circular regarding department compliance standards, review schedules, and formatting from Central Secretariat, New Delhi.',
    fields: [
      { label: 'Circular Ref', value: 'ADM/2026/CIR-108' },
      { label: 'Issuing Body', value: 'Central Administrative Secretariat' },
      { label: 'Target Audience', value: 'Department Heads & Operational Units' },
      { label: 'Policy Subject', value: 'Operational Evaluation Protocol' },
      { label: 'Effective Date', value: 'Immediate Effect (Nov 2026)' },
      { label: 'Action Mandate', value: 'Mandatory Compliance Review' },
    ],
    aiQuestion: 'Who issued this circular and what is required?',
    aiAnswer: 'Circular ADM/2026/CIR-108 was issued by the Central Administrative Secretariat, mandating operational compliance audits across all operating divisions [Page 1, Item 4].',
  },
}

export default function LandingPage({ user, theme, toggleTheme }) {
  const navigate = useNavigate()
  const [activeDomain, setActiveDomain] = useState('financial')
  const curSample = DOMAIN_SAMPLES[activeDomain]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* ── Top Navbar ── */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <img src="/docubrix-logo.png" alt="DocuBrix" className="h-9 w-auto object-contain rounded-lg bg-white/95 px-2.5 py-1 shadow-sm" />
            </Link>
            <span className="hidden sm:inline-flex rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-400 border border-blue-500/20">
              Document Intelligence Platform
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              type="button"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-300" />}
            </button>

            {user ? (
              <Button onClick={() => navigate('/dashboard')} className="bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-600/20">
                Open Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/login')} className="text-slate-300 hover:text-white hover:bg-slate-900 text-sm">
                  Sign In
                </Button>
                <Button onClick={() => navigate('/login')} className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm shadow-lg shadow-blue-600/20 active:scale-95 transition-transform">
                  Start Free <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1">
        {/* 1. Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-16 px-6 max-w-7xl mx-auto text-center">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[360px] bg-gradient-to-tr from-blue-600/20 to-indigo-600/15 blur-[140px] rounded-full pointer-events-none" />

          {/* Social Proof Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-400 mb-6 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-blue-300 animate-pulse" />
            <span>Turn Any Document Into Structured, Actionable Data in Seconds</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.1] mb-6">
            Stop Typing What Your Documents <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
              Can Already Tell You.
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-xl text-slate-300 mb-10 leading-relaxed font-normal">
            DocuBrix automatically classifies 19 document types, extracts key fields with 98.6% calibrated precision, enforces custom approval policies, and lets you ask questions with zero hallucinations.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button
              size="lg"
              onClick={() => navigate(user ? '/dashboard' : '/login')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-semibold shadow-xl shadow-blue-600/30 flex items-center gap-2 text-base active:scale-95 transition-transform"
            >
              Get Started Free <ArrowRight className="h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                const el = document.getElementById('interactive-demo')
                if (el) el.scrollIntoView({ behavior: 'smooth' })
              }}
              className="border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 px-7 py-4 rounded-xl font-medium text-base"
            >
              Watch It In Action
            </Button>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { val: '19', label: 'Document Classes', sub: 'Invoices, Rx, Contracts & more' },
              { val: '98.6%', label: 'Extraction Precision', sub: 'Multi-signal calibrated AI' },
              { val: '10x Faster', label: 'Processing Velocity', sub: 'Instant OCR & categorization' },
              { val: '100% Citation', label: 'Zero Hallucinations', sub: 'Exact page & line references' },
            ].map((stat, i) => (
              <div key={i} className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur text-center hover:border-slate-700 transition">
                <div className="text-3xl font-extrabold bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent mb-1">
                  {stat.val}
                </div>
                <div className="text-xs font-semibold text-blue-400">{stat.label}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{stat.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 2. Before vs After: The Problem We Solve */}
        <section className="py-20 border-t border-slate-800/60 bg-slate-900/30">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">The Modern Workflow</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">Manual Chaos vs. DocuBrix Clarity</h2>
              <p className="text-slate-400 text-sm mt-2">See what happens when you eliminate manual copy-pasting and human data-entry bottlenecks.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Old way */}
              <div className="p-8 rounded-3xl border border-red-500/20 bg-red-950/10 backdrop-blur">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">Manual Document Handling</h3>
                    <p className="text-xs text-red-400 font-medium">Error-prone, slow, ungrounded</p>
                  </div>
                </div>
                <ul className="space-y-4 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <span className="h-5 w-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5 text-xs">✕</span>
                    <span>Hours wasted retyping totals, vendor names, and student grades into spreadsheets</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="h-5 w-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5 text-xs">✕</span>
                    <span>High-value invoices slip through without manager approval or spend gate checks</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="h-5 w-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5 text-xs">✕</span>
                    <span>Sensitive medical and patient data left exposed with no automated redaction</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="h-5 w-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5 text-xs">✕</span>
                    <span>Generic AI hallucinating facts when asked questions about legal documents</span>
                  </li>
                </ul>
              </div>

              {/* New way: DocuBrix */}
              <div className="p-8 rounded-3xl border border-emerald-500/30 bg-emerald-950/10 backdrop-blur relative overflow-hidden">
                <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-bl-xl border-l border-b border-emerald-500/30">
                  DOCUBRIX SOLUTION
                </div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">With DocuBrix Intelligence</h3>
                    <p className="text-xs text-emerald-400 font-medium">Autonomous, auditable, safe</p>
                  </div>
                </div>
                <ul className="space-y-4 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Instant extraction of tables, line items, and metadata with 98.6% calibrated confidence</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Configurable workflow rules automatically gate high spend and flag edge cases for review</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Automated PHI vault keeps patient IDs private with automated HIPAA guardrails</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Grounded RAG answers questions with exact page and paragraph citations</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Interactive Live Demo Section */}
        <section id="interactive-demo" className="py-20 border-t border-slate-800/60 bg-slate-950">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold mb-3 border border-blue-500/20">
                <FileText className="h-3.5 w-3.5" />
                <span>Live Interactive Sandbox</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">See How DocuBrix Decodes Any Document</h2>
              <p className="text-sm text-slate-400">Click any document archetype below to inspect live entity extraction, policy evaluation, and citation-backed Q&amp;A.</p>
            </div>

            {/* Domain Selector Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
              {[
                { id: 'financial', label: 'Finance & Invoices', icon: '🧾' },
                { id: 'academic', label: 'Academic Transcripts', icon: '🎓' },
                { id: 'medical', label: 'Medical & Rx Records', icon: '🩺' },
                { id: 'legal', label: 'NDAs & Legal Contracts', icon: '⚖️' },
                { id: 'administrative', label: 'Admin Circulars', icon: '🏛️' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setActiveDomain(d.id)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 active:scale-95 ${
                    activeDomain === d.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 border border-blue-500 font-semibold'
                      : 'bg-slate-900/70 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span>{d.icon}</span>
                  <span>{d.label}</span>
                </button>
              ))}
            </div>

            {/* Interactive Document Preview Card */}
            <div className="border border-slate-800 bg-slate-900/60 backdrop-blur rounded-3xl p-6 sm:p-8 shadow-2xl">
              <div className="flex flex-col md:flex-row items-start justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${curSample.color}`}>
                      {curSample.domain}
                    </span>
                    <span className="text-xs text-slate-400">Calibrated Confidence: <strong className="text-emerald-400 font-bold">{curSample.confidence}</strong></span>
                  </div>
                  <h3 className="text-xl font-bold text-white">{curSample.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">{curSample.summary}</p>
                </div>
                <div className={`px-4 py-2.5 rounded-xl text-xs font-semibold border flex items-center gap-2 shrink-0 ${curSample.ruleColor}`}>
                  <Zap className="h-4 w-4 shrink-0" />
                  <span>{curSample.ruleBadge}</span>
                </div>
              </div>

              {/* Parsed Fields Grid */}
              <div className="mt-6">
                <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
                  <span>Extracted Key-Value Entities (Zero-Shot)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {curSample.fields.map((f, i) => (
                    <div key={i} className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 hover:border-slate-700 transition">
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
                  <span>Interactive Grounded AI Assistant (With Page Evidence)</span>
                </div>
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs">
                    <span className="font-bold text-slate-400 shrink-0">You:</span>
                    <span className="text-slate-300 italic">&ldquo;{curSample.aiQuestion}&rdquo;</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs bg-purple-950/20 border border-purple-500/20 rounded-xl p-3.5">
                    <span className="font-bold text-purple-400 shrink-0">DocuBrix:</span>
                    <span className="text-slate-200 leading-relaxed">{curSample.aiAnswer}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Complete Feature Suite */}
        <section className="py-20 border-t border-slate-800/60 bg-slate-900/20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Enterprise Capabilities</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">Engineered for Complete Document Governance</h2>
              <p className="text-sm text-slate-400 mt-2">Every tool your team needs to capture, audit, approve, and extract value from your records.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: ScanText,
                  color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                  title: 'Multi-Format OCR & Ingestion',
                  desc: 'Ingest scanned PDFs, images, and camera snapshots. DocuBrix cleans up noise, straightens rotation, and extracts high-resolution text.',
                },
                {
                  icon: Workflow,
                  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                  title: 'Autonomous Workflow Engine',
                  desc: 'Create spend rules, low-confidence review thresholds, and approval chains. Documents route automatically based on extracted criteria.',
                },
                {
                  icon: Bot,
                  color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
                  title: 'Citation-Backed Q&A',
                  desc: 'Ask questions across individual documents or entire libraries. Every single answer is grounded with direct page citations.',
                },
                {
                  icon: ShieldCheck,
                  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                  title: 'PHI & PII Safeguards',
                  desc: 'Automated redaction for sensitive health and identity fields to ensure compliance with HIPAA, GDPR, and enterprise privacy standards.',
                },
                {
                  icon: FileSpreadsheet,
                  color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
                  title: 'One-Click Audit CSV Export',
                  desc: 'Export complete audit trails with timestamps, reviewer decisions, and metadata for internal auditors or financial controllers.',
                },
                {
                  icon: Database,
                  color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
                  title: 'Multi-Tenant Isolation',
                  desc: 'Encrypted document stores with strict user workspace boundaries, ensuring your files are never exposed across teams or third parties.',
                },
              ].map((feat, i) => {
                const Icon = feat.icon
                return (
                  <div key={i} className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition flex flex-col justify-between">
                    <div>
                      <div className={`h-11 w-11 rounded-xl flex items-center justify-center mb-4 border ${feat.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="font-semibold text-lg text-white mb-2">{feat.title}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* 5. Compact Technical Architecture Section */}
        <section className="py-16 border-t border-slate-800/60 bg-slate-950">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Enterprise Stack</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2 mb-8">Production Architecture</h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
              <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/30">
                <div className="text-xs font-bold text-blue-400 mb-1">Frontend</div>
                <div className="font-semibold text-white text-sm">React 18 + Vite</div>
                <p className="text-[11px] text-slate-400 mt-1">Tailwind CSS, Lucide Icons, responsive workspace</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/30">
                <div className="text-xs font-bold text-emerald-400 mb-1">Backend</div>
                <div className="font-semibold text-white text-sm">FastAPI + Python 3.11</div>
                <p className="text-[11px] text-slate-400 mt-1">SQLAlchemy ORM, 90/90 Pytest test suites</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/30">
                <div className="text-xs font-bold text-purple-400 mb-1">AI &amp; Vectors</div>
                <div className="font-semibold text-white text-sm">ChromaDB + Gemini 2.5</div>
                <p className="text-[11px] text-slate-400 mt-1">Dense embeddings, grounded citation generation</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/30">
                <div className="text-xs font-bold text-amber-400 mb-1">Infrastructure</div>
                <div className="font-semibold text-white text-sm">Render PaaS Cloud</div>
                <p className="text-[11px] text-slate-400 mt-1">Multi-tenant isolation, PBKDF2 encryption</p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. CTA Banner */}
        <section className="py-20 border-t border-slate-800/60 bg-gradient-to-b from-slate-950 via-blue-950/20 to-slate-950 text-center px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-4">
              Ready to Modernize Your Document Pipeline?
            </h2>
            <p className="text-slate-300 text-sm sm:text-base mb-8 max-w-xl mx-auto">
              Join teams streamlining invoice processing, compliance checks, and knowledge discovery.
            </p>
            <Button
              size="lg"
              onClick={() => navigate(user ? '/dashboard' : '/login')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-9 py-4 rounded-xl font-semibold shadow-xl shadow-blue-600/30 text-base active:scale-95 transition-transform"
            >
              Launch Workspace Now <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </section>
      </main>

      {/* ── 7. Personal Branding & Product Footer ── */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-6 text-center">
          {/* Logo & description */}
          <div className="flex items-center gap-2">
            <img src="/docubrix-logo.png" alt="DocuBrix" className="h-6 w-auto object-contain rounded bg-white/95 px-1.5 py-0.5" />
            <span className="font-bold text-white text-sm">DocuBrix</span>
            <span className="text-slate-600">|</span>
            <span className="text-xs text-slate-400">Intelligent Document Processing &amp; Workflow Automation</span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <a href="#interactive-demo" className="hover:text-slate-200 transition-colors">Interactive Demo</a>
            <span>•</span>
            <span className="hover:text-slate-200 transition-colors">19 Document Archetypes</span>
            <span>•</span>
            <span className="hover:text-slate-200 transition-colors">PHI &amp; Spend Safeguards</span>
            <span>•</span>
            <span className="hover:text-slate-200 transition-colors">Grounded RAG Assistant</span>
          </div>

          {/* Dhruv Grover Personal Branding */}
          <div className="border-t border-slate-800/80 w-full pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <p>&copy; 2026 DocuBrix. All rights reserved.</p>
            <div className="flex items-center gap-3">
              <span>Built by <strong className="text-white font-semibold">Dhruv Grover</strong></span>
              <span>•</span>
              <a
                href="https://github.com/DhruvGrover28"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors underline-offset-4 hover:underline"
              >
                GitHub
              </a>
              <span>•</span>
              <a
                href="https://www.linkedin.com/in/dhruv-grover28/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors underline-offset-4 hover:underline"
              >
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
