import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'https://docubrix-api.onrender.com'

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
})

export async function fetchHealth() {
  const response = await api.get('/health')
  return response.data
}

export async function fetchDocuments() {
  const response = await api.get('/documents')
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
