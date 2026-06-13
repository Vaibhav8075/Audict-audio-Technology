

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mic, Eye, EyeOff, ArrowRight, Lock, Mail } from 'lucide-react'
import useAuthStore from './authStore'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { login, isLoading, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please fill in all fields')
      return
    }
    const result = await login(email, password)
    if (result.success) {
      toast.success('Welcome back!')
      navigate('/dashboard')
    } else {
      toast.error(result.error || 'Login failed')
    }
  }

  
  const fillDemo = (role) => {
    if (role === 'admin') {
      setEmail('admin@dcm.com')
      setPassword('Admin@123')
    } else {
      setEmail('employee@dcm.com')
      setPassword('Employee@123')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'var(--surface-bg)' }}
    >
      <div className="w-full max-w-md relative z-10">
        {}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center mx-auto mb-4 shadow-orange-glow"
          >
            <Mic size={28} className="text-white" />
          </motion.div>
          <h1 className="font-display font-bold text-3xl text-white">DCM</h1>
          <p className="text-white/40 text-sm mt-1">Audit Intelligence Platform</p>
        </div>

        {}
        <div
          className="rounded-2xl p-8 border"
          style={{
            background: 'rgba(37,28,26,0.8)',
            backdropFilter: 'blur(20px)',
            borderColor: 'rgba(203, 185, 164, 0.08)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)'
          }}
        >
          <h2 className="font-display font-semibold text-xl text-white mb-1">Sign in</h2>
          <p className="text-white/40 text-sm mb-6">Access your audit dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Email address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="input-field pl-10"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10 pr-10"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full justify-center mt-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                <>Sign in <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          {}
          <div className="mt-6 pt-5 border-t border-white/[0.06]">
            <p className="text-center text-xs text-white/30 mb-3">Demo credentials</p>
            <div className="flex gap-2">
              <button
                onClick={() => fillDemo('admin')}
                type="button"
                className="flex-1 px-3 py-2 rounded-lg text-xs border border-brand-500/30 text-brand-400 hover:bg-brand-500/10 transition-all"
              >
                Admin demo
              </button>
              <button
                onClick={() => fillDemo('employee')}
                type="button"
                className="flex-1 px-3 py-2 rounded-lg text-xs border border-white/10 text-white/40 hover:bg-white/[0.04] transition-all"
              >
                Employee demo
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          © 2024 DCM · Audit Intelligence Platform · v1.0
        </p>
      </div>
    </div>
  )
}
