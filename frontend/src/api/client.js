import axios from 'axios'

const isLocalHost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '0.0.0.0' ||
  window.location.hostname === '::1'
)
let rawApiUrl = import.meta.env.VITE_API_URL || (isLocalHost ? 'http://localhost:8000' : 'https://docubrix-api.onrender.com')
if (rawApiUrl && !rawApiUrl.startsWith('http://') && !rawApiUrl.startsWith('https://')) {
  rawApiUrl = `https://${rawApiUrl}`
}
export const API_URL = rawApiUrl
export const AUTH_TOKEN_KEY = 'docubrix-access-token'

export const api = axios.create({
  baseURL: API_URL,
  timeout: 90000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      if (
        typeof window !== 'undefined' &&
        window.location &&
        !window.location.pathname.includes('/login') &&
        !window.location.pathname.includes('/register')
      ) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

async function authenticate(path, payload) {
  const response = await api.post(path, payload)
  localStorage.setItem(AUTH_TOKEN_KEY, response.data.access_token)
  return response.data.user
}

export function registerUser(payload) {
  return authenticate('/auth/register', payload)
}

export function loginUser(payload) {
  return authenticate('/auth/login', payload)
}

export async function fetchCurrentUser() {
  const response = await api.get('/auth/me')
  return response.data.user
}

export async function logoutUser() {
  try {
    await api.post('/auth/logout')
  } finally {
    localStorage.removeItem(AUTH_TOKEN_KEY)
  }
}

export async function updateCurrentUser(payload) {
  const response = await api.patch('/auth/me', payload)
  return response.data.user
}

export async function claimAdminRole() {
  const response = await api.post('/auth/claim-admin')
  if (response.data.access_token) {
    localStorage.setItem(AUTH_TOKEN_KEY, response.data.access_token)
  }
  return response.data.user
}

export async function fetchHealth() {
  const response = await api.get('/health')
  return response.data
}

export async function fetchAdminOverview() {
  const response = await api.get('/admin/overview')
  return response.data
}

export async function fetchDocuments() {
  const response = await api.get('/documents')
  return response.data.documents || []
}

export async function searchDocuments(query, documentType, status) {
  const response = await api.get('/documents/search', {
    params: {
      q: query,
      document_type: documentType === 'all' ? undefined : documentType,
      status: status === 'all' ? undefined : status,
    },
  })
  return response.data.documents || []
}

export async function searchSemanticDocuments(query, topK = 5) {
  const response = await api.get('/documents/search/semantic', {
    params: {
      q: query,
      top_k: topK,
    },
  })
  return response.data.documents || []
}

export async function askDocument(documentId, question) {
  const response = await api.post(`/documents/${documentId}/ask`, {
    question,
  })
  return response.data
}

export async function fetchSearchStatus() {
  const response = await api.get('/documents/search/status')
  return response.data
}

export async function fetchDocumentChunks(documentId) {
  const response = await api.get(`/documents/${documentId}/chunks`)
  return response.data
}

export async function fetchDocumentSummary() {
  const response = await api.get('/documents/summary')
  return response.data
}

export async function fetchDocumentById(documentId) {
  const response = await api.get(`/documents/${documentId}`)
  return response.data
}

export async function uploadDocument(file) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export async function saveReview(documentId, corrections) {
  const response = await api.post(`/documents/${documentId}/review`, {
    manual_corrections: corrections,
  })
  return response.data
}

export async function deleteDocument(documentId) {
  const response = await api.delete(`/documents/${documentId}`)
  return response.data
}

export async function fetchConversations() {
  const response = await api.get('/conversations')
  return response.data.conversations || []
}

export async function createConversation(payload = {}) {
  const response = await api.post('/conversations', payload)
  return response.data
}

export async function fetchConversation(conversationId) {
  const response = await api.get(`/conversations/${conversationId}`)
  return response.data
}

export async function updateConversation(conversationId, payload) {
  const response = await api.patch(`/conversations/${conversationId}`, payload)
  return response.data
}

export async function deleteConversation(conversationId) {
  const response = await api.delete(`/conversations/${conversationId}`)
  return response.data
}

export async function sendChatMessage(conversationId, content) {
  const response = await api.post(`/conversations/${conversationId}/messages`, {
    content,
  })
  return response.data
}

export async function fetchWorkflowRules() {
  const response = await api.get('/workflows/rules')
  return response.data.rules || []
}

export async function createWorkflowRule(payload) {
  const response = await api.post('/workflows/rules', payload)
  return response.data.rule
}

export async function updateWorkflowRule(ruleId, payload) {
  const response = await api.patch(`/workflows/rules/${ruleId}`, payload)
  return response.data.rule
}

export async function deleteWorkflowRule(ruleId) {
  const response = await api.delete(`/workflows/rules/${ruleId}`)
  return response.data
}

export async function fetchWorkflowLogs(limit = 50) {
  const response = await api.get('/workflows/logs', { params: { limit } })
  return response.data.logs || []
}

export async function fetchWorkflowQueue() {
  const response = await api.get('/workflows/queue')
  return response.data.queue || []
}

export async function executeQueueAction(documentId, action, note = '') {
  const response = await api.post(`/workflows/queue/${documentId}/action`, {
    action,
    note,
  })
  return response.data
}

export async function evaluateDocumentWorkflow(documentId) {
  const response = await api.post(`/workflows/evaluate/${documentId}`)
  return response.data
}
