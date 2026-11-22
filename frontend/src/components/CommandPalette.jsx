import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart2,
  Bot,
  FileText,
  FolderOpen,
  Home,
  LayoutDashboard,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  UploadCloud,
  User,
  X,
  Zap,
} from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Dashboard',         path: '/dashboard',  icon: LayoutDashboard, group: 'Navigate' },
  { label: 'Upload Documents',  path: '/processing', icon: UploadCloud,     group: 'Navigate' },
  { label: 'Document Library',  path: '/library',    icon: FolderOpen,      group: 'Navigate' },
  { label: 'AI Chat',           path: '/chat',       icon: Bot,             group: 'Navigate' },
  { label: 'Review Queue',      path: '/review',     icon: ShieldCheck,     group: 'Navigate' },
  { label: 'Workflow Automation',path: '/automation', icon: Zap,            group: 'Navigate' },
  { label: 'Analytics',         path: '/analytics',  icon: BarChart2,       group: 'Navigate' },
  { label: 'Profile',           path: '/profile',    icon: User,            group: 'Navigate' },
  { label: 'Settings',          path: '/settings',   icon: Settings,        group: 'Navigate' },
]

export default function CommandPalette({ open, onClose, onToggleTheme, theme }) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const actions = [
    {
      label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      icon: theme === 'dark' ? Sun : Moon,
      group: 'Actions',
      action: () => { onToggleTheme(); onClose() },
    },
  ]

  const allItems = [...NAV_ITEMS, ...actions]

  const filtered = query.trim()
    ? allItems.filter(item => item.label.toLowerCase().includes(query.toLowerCase()))
    : allItems

  const groups = [...new Set(filtered.map(i => i.group))]

  const flatFiltered = groups.flatMap(g => filtered.filter(i => i.group === g))

  const handleSelect = (item) => {
    if (item.action) { item.action(); return }
    navigate(item.path)
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { setSelected(s => Math.min(s + 1, flatFiltered.length - 1)); e.preventDefault() }
      if (e.key === 'ArrowUp')   { setSelected(s => Math.max(s - 1, 0)); e.preventDefault() }
      if (e.key === 'Enter' && flatFiltered[selected]) { handleSelect(flatFiltered[selected]) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, selected, flatFiltered])

  if (!open) return null

  let idx = -1

  return (
    <div className="cmd-backdrop fixed inset-0 z-[200] flex items-start justify-center pt-24 px-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="cmd-panel w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            placeholder="Search pages or actions…"
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none"
          />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {flatFiltered.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-400">No results found.</div>
          ) : (
            groups.map(group => {
              const groupItems = filtered.filter(i => i.group === group)
              return (
                <div key={group}>
                  <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group}</div>
                  {groupItems.map(item => {
                    idx++
                    const thisIdx = idx
                    const Icon = item.icon
                    return (
                      <button
                        key={item.label}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setSelected(thisIdx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                          selected === thisIdx
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                          selected === thisIdx
                            ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                        }`}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2 flex items-center gap-4 text-[10px] text-slate-400">
          <span><kbd className="bg-slate-100 dark:bg-slate-800 px-1 rounded">↑↓</kbd> navigate</span>
          <span><kbd className="bg-slate-100 dark:bg-slate-800 px-1 rounded">↵</kbd> select</span>
          <span><kbd className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
