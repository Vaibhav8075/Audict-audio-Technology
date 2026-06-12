import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'light', 

      toggleTheme: () => {
        const newTheme = get().theme === 'dark' ? 'light' : 'dark'
        set({ theme: newTheme })
        document.documentElement.classList.toggle('dark', newTheme === 'dark')
        document.documentElement.classList.toggle('light', newTheme === 'light')
      },

      initTheme: () => {
        const theme = get().theme
        document.documentElement.classList.toggle('dark', theme === 'dark')
        document.documentElement.classList.toggle('light', theme === 'light')
      }
    }),
    { name: 'dcm-theme' }
  )
)

export default useThemeStore
