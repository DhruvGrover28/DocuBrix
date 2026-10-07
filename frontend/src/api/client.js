import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'https://docubrix-api.onrender.com'
export const AUTH_TOKEN_KEY = 'docubrix-access-token'

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) localStorage.removeItem(AUTH_TOKEN_KEY)
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

export async function searchDocuments(query, documentType) {
  const response = await api.get('/documents/search', {
    params: { q: query, document_type: documentType === 'all' ? undefined : documentType },
  })
  return response.data.documents || []
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
