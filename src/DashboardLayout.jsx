/**
 * DashboardLayout.jsx
 * Main shell: fixed sidebar + top navbar + scrollable content area
 */

import { useState, useEffect, useMemo } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Mic, MessageSquare, Brain, User,
  LogOut, ChevronRight, Menu, X, Sun, Moon,
  Shield, Users, BarChart3, FileText, Bell, Search, BellOff
} from 'lucide-react'
import useAuthStore from './authStore'
import useThemeStore from './themeStore'
import { auditsAPI } from './api'
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
      <div className="my-2 mx-4 border-t border-slate-200 dark:border-white/[0.06]" />
    )
  }

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl mx-2 transition-all duration-200 group relative',
          isActive
            ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/25'
            : 'text-slate-600 dark:text-white/50 hover:text-slate-900 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/[0.05]'
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
            className={clsx('flex-shrink-0 relative z-10', isActive ? 'text-brand-600 dark:text-brand-400' : '')}
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

  // Notifications State
  const [notifications, setNotifications] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)

  const loadNotifications = async () => {
    if (!user) return
    try {
      let auditsData
      if (user.role === 'employee') {
        auditsData = await auditsAPI.getPublicList()
      } else {
        auditsData = await auditsAPI.getAll({ per_page: 20 })
      }
      
      const list = []
      auditsData.audits?.slice(0, 8).forEach(a => {
        // If own audit, notify employee
        if (user.role === 'employee' && !a.is_own_audit) return

        if (a.status === 'completed') {
          list.push({
            id: `ai-${a.id}`,
            title: 'AI Analysis Complete',
            message: `Call audit ${a.audit_id} has been analyzed by AI.`,
            to: `/audits/${a.id}`,
            read: localStorage.getItem(`notif-read-ai-${a.id}`) === 'true',
            date: a.call_date ? new Date(a.call_date) : new Date()
          })
        }
        
        list.push({
          id: `assign-${a.id}`,
          title: 'Audit Assigned',
          message: `New call audit ${a.audit_id} assigned for ${a.client_name}.`,
          to: `/audits/${a.id}`,
          read: localStorage.getItem(`notif-read-assign-${a.id}`) === 'true',
          date: a.call_date ? new Date(a.call_date) : new Date()
        })
      })

      // Sort by date desc
      list.sort((x, y) => y.date - x.date)
      setNotifications(list)
    } catch (err) {
      // Ignore background fetch error
    }
  }

  useEffect(() => {
    loadNotifications()
    // Poll notifications every 30 seconds for real-time update feel
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [user])

  const hasUnread = useMemo(() => {
    return notifications.some(n => !n.read)
  }, [notifications])

  const markAllAsRead = () => {
    notifications.forEach(n => {
      localStorage.setItem(`notif-read-${n.id}`, 'true')
      // Backup keys
      localStorage.setItem(`notif-read-ai-${n.id.replace('ai-', '')}`, 'true')
      localStorage.setItem(`notif-read-assign-${n.id.replace('assign-', '')}`, 'true')
    })
    setNotifications(notifications.map(n => ({ ...n, read: true })))
    toast.success('All notifications marked as read')
  }

  const handleNotifClick = (n) => {
    localStorage.setItem(`notif-read-${n.id}`, 'true')
    // Backup keys
    localStorage.setItem(`notif-read-ai-${n.id.replace('ai-', '')}`, 'true')
    localStorage.setItem(`notif-read-assign-${n.id.replace('assign-', '')}`, 'true')
    
    setNotifications(notifications.map(item => item.id === n.id ? { ...item, read: true } : item))
    setNotifOpen(false)
    navigate(n.to)
  }

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
          background: 'var(--surface-card)',
          borderColor: 'var(--surface-border)',
        }}
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-200 dark:border-white/[0.06] flex-shrink-0">
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
                <p className="font-display font-bold text-slate-800 dark:text-white text-sm leading-none">DCM</p>
                <p className="text-[10px] text-slate-500 dark:text-white/40 mt-0.5">Audit Intelligence</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapse toggle - desktop only */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto hidden lg:flex w-6 h-6 rounded-lg items-center justify-center text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white/70 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all"
          >
            <ChevronRight
              size={14}
              className={clsx('transition-transform', collapsed ? '' : 'rotate-180')}
            />
          </button>

          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto lg:hidden text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/80"
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
        <div className="border-t border-slate-200 dark:border-white/[0.06] p-3 flex-shrink-0">
          <div className={clsx(
            'flex items-center gap-3 p-2 rounded-xl',
            collapsed ? 'justify-center' : ''
          )}>
            <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-brand-600 dark:text-brand-400 font-semibold text-xs">
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
                  <p className="text-xs font-medium text-slate-800 dark:text-white/90 truncate">{user?.full_name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-white/40 capitalize">{user?.role}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handleLogout}
            className={clsx(
              'mt-1 flex items-center gap-2 px-3 py-2 rounded-xl w-full text-slate-500 dark:text-white/40 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all text-sm',
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
            background: 'var(--surface-card)',
            backdropFilter: 'blur(20px)',
            borderColor: 'var(--surface-border)'
          }}
        >
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80 mr-2"
          >
            <Menu size={20} />
          </button>

          {/* Search bar */}
          <div className="flex-1 max-w-sm hidden sm:flex items-center gap-3 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-white/[0.03]">
            <Search size={14} className="text-slate-400 dark:text-white/30" />
            <span className="text-sm text-slate-400 dark:text-white/25">Search audits, clients...</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all"
              >
                <Bell size={16} />
                {hasUnread && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand border border-slate-50 dark:border-[#111118]" />
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <>
                    {/* Click-away backdrop */}
                    <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                    
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#111118] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl z-40 overflow-hidden text-left"
                    >
                      <div className="p-3 border-b border-slate-100 dark:border-white/[0.04] flex items-center justify-between bg-slate-50/50 dark:bg-transparent">
                        <span className="text-xs font-semibold text-slate-800 dark:text-white">Notifications</span>
                        {hasUnread && (
                          <button
                            onClick={markAllAsRead}
                            className="text-[10px] text-brand hover:underline font-semibold"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>

                      <div className="max-h-64 overflow-y-auto py-1">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-slate-400 dark:text-white/20">
                            <BellOff size={20} className="mx-auto mb-2 opacity-50" />
                            <p className="text-[10px]">No notifications available yet.</p>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => handleNotifClick(n)}
                              className={clsx(
                                "px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer border-b border-slate-50 dark:border-white/[0.02] last:border-b-0 flex gap-2.5 items-start transition-colors",
                                !n.read ? "bg-brand-500/[0.02] dark:bg-brand-500/[0.01]" : ""
                              )}
                            >
                              <span className={clsx(
                                "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                                !n.read ? "bg-brand" : "bg-transparent"
                              )} />
                              <div className="min-w-0 flex-1">
                                <p className={clsx(
                                  "text-[11px] leading-tight text-slate-800 dark:text-white",
                                  !n.read ? "font-semibold" : "font-medium"
                                )}>
                                  {n.title}
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-white/40 mt-0.5 leading-snug">
                                  {n.message}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center cursor-pointer hover:bg-brand-500/30 transition-all">
              <span className="text-brand-600 dark:text-brand-400 font-semibold text-sm">
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
