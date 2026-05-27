/**
 * DashboardLayout.jsx
 * Main shell: fixed sidebar + top navbar + scrollable content area
 */

import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Mic, MessageSquare, Brain, User,
  LogOut, ChevronRight, Menu, X, Sun, Moon,
  Shield, Users, BarChart3, FileText, Bell, Search
} from 'lucide-react'
import useAuthStore from './authStore'
import useThemeStore from './themeStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const employeeNav = [
  { label: 'Dashboard',    icon: LayoutDashboard, to: '/dashboard' },
  { label: 'My Audits',    icon: Mic,             to: '/audits' },
  { label: 'Feedback',     icon: MessageSquare,   to: '/feedback' },
  { label: 'AI Insights',  icon: Brain,           to: '/ai-insights' },
  { label: 'Profile',      icon: User,            to: '/profile' },
]

const adminNav = [
  { label: 'Dashboard',    icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Audits',       icon: Mic,             to: '/audits' },
  { label: 'Feedback',     icon: MessageSquare,   to: '/feedback' },
  { label: 'AI Insights',  icon: Brain,           to: '/ai-insights' },
  { divider: true },
  { label: 'Admin Panel',  icon: Shield,          to: '/admin' },
  { label: 'Users',        icon: Users,           to: '/admin/users' },
  { label: 'Analytics',    icon: BarChart3,       to: '/admin/analytics' },
  { label: 'Manage Audits',icon: FileText,        to: '/admin/audits' },
  { label: 'Submissions',  icon: MessageSquare,   to: '/admin/feedback' },
  { divider: true },
  { label: 'Profile',      icon: User,            to: '/profile' },
]

function NavItem({ item, collapsed }) {
  if (item.divider) {
    return (
      <div className="my-2 mx-4 border-t border-white/[0.06]" />
    )
  }

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl mx-2 transition-all duration-200 group relative',
          isActive
            ? 'bg-brand-500/15 text-brand-400 border border-brand-500/25'
            : 'text-white/50 hover:text-white/80 hover:bg-white/[0.05]'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId="nav-active"
              className="absolute inset-0 rounded-xl bg-brand-500/10 border border-brand-500/20"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            />
          )}
          <item.icon
            size={17}
            className={clsx('flex-shrink-0 relative z-10', isActive ? 'text-brand-400' : '')}
          />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="text-sm font-medium relative z-10 whitespace-nowrap overflow-hidden"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>
        </>
      )}
    </NavLink>
  )
}

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout, isAdmin } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = isAdmin() ? adminNav : employeeNav

  const handleLogout = async () => {
    logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  const sidebarWidth = collapsed ? 68 : 240

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface-bg)' }}>

      {/* ── Mobile overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={clsx(
          'fixed lg:relative z-50 h-full flex flex-col border-r',
          'transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{
          background: '#16161f',
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/[0.06] flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center flex-shrink-0 shadow-orange-glow">
            <Mic size={16} className="text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-hidden"
              >
                <p className="font-display font-bold text-white text-sm leading-none">DCM</p>
                <p className="text-[10px] text-white/40 mt-0.5">Audit Intelligence</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapse toggle - desktop only */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto hidden lg:flex w-6 h-6 rounded-lg items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all"
          >
            <ChevronRight
              size={14}
              className={clsx('transition-transform', collapsed ? '' : 'rotate-180')}
            />
          </button>

          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto lg:hidden text-white/50 hover:text-white/80"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
          {navItems.map((item, i) => (
            <NavItem key={i} item={item} collapsed={collapsed} />
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-white/[0.06] p-3 flex-shrink-0">
          <div className={clsx(
            'flex items-center gap-3 p-2 rounded-xl',
            collapsed ? 'justify-center' : ''
          )}>
            <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-brand-400 font-semibold text-xs">
                {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 overflow-hidden"
                >
                  <p className="text-xs font-medium text-white/90 truncate">{user?.full_name}</p>
                  <p className="text-[10px] text-white/40 capitalize">{user?.role}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handleLogout}
            className={clsx(
              'mt-1 flex items-center gap-2 px-3 py-2 rounded-xl w-full text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm',
              collapsed ? 'justify-center' : ''
            )}
          >
            <LogOut size={15} />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </motion.aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top navbar */}
        <header
          className="h-16 flex items-center gap-4 px-6 border-b flex-shrink-0"
          style={{
            background: 'rgba(17,17,24,0.95)',
            backdropFilter: 'blur(20px)',
            borderColor: 'rgba(255,255,255,0.06)'
          }}
        >
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-white/50 hover:text-white/80 mr-2"
          >
            <Menu size={20} />
          </button>

          {/* Search bar */}
          <div className="flex-1 max-w-sm hidden sm:flex items-center gap-3 px-4 py-2 rounded-xl border"
            style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
          >
            <Search size={14} className="text-white/30" />
            <span className="text-sm text-white/25">Search audits, clients...</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.05] transition-all"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Notifications */}
            <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.05] transition-all">
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500 border border-[#111118]" />
            </button>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center cursor-pointer hover:bg-brand-500/30 transition-all">
              <span className="text-brand-400 font-semibold text-sm">
                {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
