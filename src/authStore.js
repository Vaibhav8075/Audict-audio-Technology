

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authAPI } from './api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      isAuthenticated: false,

      
      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const data = await authAPI.login(email, password)
          set({
            user: data.user,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            isAuthenticated: true,
            isLoading: false
          })
          return { success: true }
        } catch (error) {
          set({ isLoading: false })
          const message = error.response?.data?.detail || 'Login failed'
          return { success: false, error: message }
        }
      },

      
      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false
        })
      },

      
      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) {
          get().logout()
          return false
        }
        try {
          const data = await authAPI.refresh(refreshToken)
          set({
            user: data.user,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
          })
          return true
        } catch {
          get().logout()
          return false
        }
      },

      
      updateUser: (updates) => {
        set(state => ({
          user: { ...state.user, ...updates }
        }))
      },

      
      isAdmin: () => get().user?.role === 'admin',
      isEmployee: () => get().user?.role === 'employee',
    }),
    {
      name: 'dcm-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)

export default useAuthStore
