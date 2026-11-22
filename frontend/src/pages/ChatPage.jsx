import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  createConversation, deleteConversation, fetchConversation, fetchConversations,
  fetchDocumentById, fetchSearchStatus, sendChatMessage, updateConversation,
} from '../api/client'
import { Card, CardContent, Badge, Button, Input } from '../components/ui'
import {
  AlertCircle, ArrowRight, Bot, CheckCircle2, Edit3, FileText, Loader2,
  MessageSquare, Plus, Send, Sparkles, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '../lib/utils'
import PageHeader from '../components/PageHeader'

export default function ChatPage() {
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
