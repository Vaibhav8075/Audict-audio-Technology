/**
 * API Service Layer
 * Centralized Axios instance with JWT interceptors and all API calls
 */

import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

// ─── Request Interceptor: Attach JWT token ──────────────────────────────────
api.interceptors.request.use(
  (config) => {
    // Import store inline to avoid circular dependency
    const stored = localStorage.getItem('dcm-auth')
    if (stored) {
      try {
        const { state } = JSON.parse(stored)
        if (state?.accessToken) {
          config.headers.Authorization = `Bearer ${state.accessToken}`
        }
      } catch {
        // Ignore malformed persisted auth state.
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ─── Response Interceptor: Handle 401, token refresh ───────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      try {
        const stored = localStorage.getItem('dcm-auth')
        if (stored) {
          const { state } = JSON.parse(stored)
          if (state?.refreshToken) {
            const res = await axios.post(`${BASE_URL}/api/auth/refresh`, {
              refresh_token: state.refreshToken
            })

            // Update stored tokens
            const newState = { ...state, accessToken: res.data.access_token }
            localStorage.setItem('dcm-auth', JSON.stringify({ state: newState }))

            original.headers.Authorization = `Bearer ${res.data.access_token}`
            return api(original)
          }
        }
      } catch {
        // Refresh failed - clear session
        localStorage.removeItem('dcm-auth')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// ─── Auth API ────────────────────────────────────────────────────────────────
export const authAPI = {
  login: async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password })
    return res.data
  },
  register: async (data) => {
    const res = await api.post('/api/auth/register', data)
    return res.data
  },
  refresh: async (refreshToken) => {
    const res = await api.post('/api/auth/refresh', { refresh_token: refreshToken })
    return res.data
  },
  me: async () => {
    const res = await api.get('/api/auth/me')
    return res.data
  },
  logout: async () => {
    await api.post('/api/auth/logout')
  }
}

// ─── Audits API ──────────────────────────────────────────────────────────────
export const auditsAPI = {
  getAll: async (params = {}) => {
    const res = await api.get('/api/audits/', { params })
    return res.data
  },
  getPublicList: async () => {
    const res = await api.get('/api/audits/public-list')
    return res.data
  },
  getOne: async (id) => {
    const res = await api.get(`/api/audits/${id}`)
    return res.data
  },
  create: async (data) => {
    const res = await api.post('/api/audits/', data)
    return res.data
  },
  update: async (id, data) => {
    const res = await api.put(`/api/audits/${id}`, data)
    return res.data
  },
  delete: async (id) => {
    const res = await api.delete(`/api/audits/${id}`)
    return res.data
  },
  getStats: async () => {
    const res = await api.get('/api/audits/stats/summary')
    return res.data
  }
}

// ─── Recordings API ──────────────────────────────────────────────────────────
export const recordingsAPI = {
  upload: async (auditId, file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post(`/api/recordings/upload/${auditId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress) onProgress(Math.round((e.loaded * 100) / e.total))
      }
    })
    return res.data
  },
  // Returns stream URL - never exposes actual file path
  getStreamUrl: (auditId) => `${BASE_URL}/api/recordings/stream/${auditId}`,
  getStreamUrlWithToken: (auditId) => {
    const stored = localStorage.getItem('dcm-auth')
    let token = ''
    if (stored) {
      try {
        const { state } = JSON.parse(stored)
        token = state?.accessToken || ''
      } catch {
        // Ignore malformed persisted auth state.
      }
    }
    return { url: `${BASE_URL}/api/recordings/stream/${auditId}`, token }
  },
  getInfo: async (auditId) => {
    const res = await api.get(`/api/recordings/info/${auditId}`)
    return res.data
  },
  delete: async (recordingId) => {
    const res = await api.delete(`/api/recordings/${recordingId}`)
    return res.data
  }
}

// ─── Feedback API ─────────────────────────────────────────────────────────────
export const feedbackAPI = {
  getForms: async () => {
    const res = await api.get('/api/feedback/forms')
    return res.data
  },
  getForm: async (formId) => {
    const res = await api.get(`/api/feedback/forms/${formId}`)
    return res.data
  },
  createForm: async (data) => {
    const res = await api.post('/api/feedback/forms', data)
    return res.data
  },
  submit: async (data) => {
    const res = await api.post('/api/feedback/submit', data)
    return res.data
  },
  getMySubmissions: async () => {
    const res = await api.get('/api/feedback/my-submissions')
    return res.data
  },
  getAllSubmissions: async (params = {}) => {
    const res = await api.get('/api/feedback/all-submissions', { params })
    return res.data
  },
  checkSubmission: async (auditId, formId) => {
    const res = await api.get(`/api/feedback/check/${auditId}/${formId}`)
    return res.data
  }
}

// ─── AI API ──────────────────────────────────────────────────────────────────
export const aiAPI = {
  triggerAnalysis: async (auditId) => {
    const res = await api.post(`/api/ai/analyze/${auditId}`)
    return res.data
  },
  getAnalysis: async (auditId) => {
    const res = await api.get(`/api/ai/analysis/${auditId}`)
    return res.data
  },
  getDashboardStats: async () => {
    const res = await api.get('/api/ai/dashboard-stats')
    return res.data
  },
  getSuggestions: async (auditId) => {
    const res = await api.post(`/api/ai/generate-suggestions/${auditId}`)
    return res.data
  }
}

// ─── Admin API ────────────────────────────────────────────────────────────────
export const adminAPI = {
  getUsers: async (params = {}) => {
    const res = await api.get('/api/admin/users', { params })
    return res.data
  },
  createUser: async (data) => {
    const res = await api.post('/api/admin/users', data)
    return res.data
  },
  updateUser: async (id, data) => {
    const res = await api.put(`/api/admin/users/${id}`, data)
    return res.data
  },
  deactivateUser: async (id) => {
    const res = await api.delete(`/api/admin/users/${id}`)
    return res.data
  },
  getAnalytics: async () => {
    const res = await api.get('/api/admin/analytics/overview')
    return res.data
  },
  getLogs: async (params = {}) => {
    const res = await api.get('/api/admin/logs', { params })
    return res.data
  },
  exportFeedbackCSV: async () => {
    const res = await api.get('/api/admin/export/feedback-csv', { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `feedback_export_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }
}

// ─── Users API ────────────────────────────────────────────────────────────────
export const usersAPI = {
  getProfile: async () => {
    const res = await api.get('/api/users/profile')
    return res.data
  },
  updateProfile: async (data) => {
    const res = await api.put('/api/users/profile', data)
    return res.data
  },
  changePassword: async (data) => {
    const res = await api.post('/api/users/change-password', data)
    return res.data
  }
}

export default api
