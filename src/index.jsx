/**
 * ui/index.jsx
 * Shared UI components used across the app
 */

import { motion } from 'framer-motion'
import clsx from 'clsx'

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className, hover = false, onClick }) {
  return (
    <motion.div
      whileHover={hover ? { y: -2 } : undefined}
      onClick={onClick}
      className={clsx(
        'glass-card',
        hover && 'cursor-pointer transition-shadow duration-200 hover:shadow-elevated',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </motion.div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
const badgeVariants = {
  green:    'badge-green',
  yellow:   'badge-yellow',
  red:      'badge-red',
  blue:     'badge-blue',
  orange:   'badge-orange',
  gray:     'badge-gray',
  positive: 'badge-green',
  negative: 'badge-red',
  neutral:  'badge-gray',
  completed:'badge-green',
  pending:  'badge-yellow',
  processing:'badge-blue',
  expired:  'badge-gray',
  admin:    'badge-orange',
  employee: 'badge-blue',
}

export function Badge({ variant = 'gray', children, className }) {
  return (
    <span className={clsx('badge', badgeVariants[variant] || 'badge-gray', className)}>
      {children}
    </span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export function Skeleton({ className, lines = 1 }) {
  if (lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={clsx('skeleton h-4 rounded', i === lines - 1 ? 'w-3/4' : 'w-full', className)}
          />
        ))}
      </div>
    )
  }
  return <div className={clsx('skeleton', className)} />
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, icon: Icon, trend, color = 'orange', loading }) {
  const colorMap = {
    orange: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
    green:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
    red:    'text-red-400 bg-red-500/10 border-red-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  }

  return (
    <Card>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center border',
            colorMap[color]
          )}>
            {Icon && <Icon size={18} />}
          </div>
          {trend !== undefined && (
            <span className={clsx(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              trend >= 0
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-red-500/10 text-red-400'
            )}>
              {trend >= 0 ? '+' : ''}{trend}%
            </span>
          )}
        </div>
        {loading ? (
          <>
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-3 w-28" />
          </>
        ) : (
          <>
            <p className="font-display font-bold text-2xl text-white">{value}</p>
            <p className="text-xs text-white/40 mt-0.5">{label}</p>
          </>
        )}
      </div>
    </Card>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
        {Icon && <Icon size={24} className="text-white/20" />}
      </div>
      <h3 className="font-medium text-white/60 mb-1">{title}</h3>
      {description && <p className="text-sm text-white/30 max-w-xs mb-4">{description}</p>}
      {action && action}
    </motion.div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="text-sm text-white/40 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 20, className }) {
  return (
    <svg
      className={clsx('animate-spin', className)}
      width={size} height={size}
      fill="none" viewBox="0 0 24 24"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-80" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const sizeMap = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 8 }}
        transition={{ duration: 0.2 }}
        className={clsx('w-full glass-card', sizeMap[size])}
      >
        {title && (
          <div className="flex items-center justify-between p-6 pb-0">
            <h3 className="font-display font-semibold text-white text-lg">{title}</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all"
            >
              ×
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = 'orange', showLabel = false }) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100))
  const colorMap = {
    orange: 'bg-brand-500',
    green:  'bg-emerald-500',
    red:    'bg-red-500',
    blue:   'bg-blue-500',
  }

  return (
    <div className="relative">
      {showLabel && (
        <div className="flex justify-between text-xs text-white/40 mb-1">
          <span>{value}</span>
          <span>{percent.toFixed(0)}%</span>
        </div>
      )}
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={clsx('h-full rounded-full', colorMap[color])}
        />
      </div>
    </div>
  )
}
