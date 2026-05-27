import { useEffect, useState } from 'react'
import { BarChart3, Brain, MessageSquare, Mic } from 'lucide-react'
import toast from 'react-hot-toast'
import { aiAPI, auditsAPI } from '../api.js'
import { Card, SectionHeader, StatCard } from '../index.jsx'

export default function DashboardPage() {
  const [auditStats, setAuditStats] = useState(null)
  const [aiStats, setAiStats] = useState(null)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [auditData, aiData] = await Promise.all([
          auditsAPI.getStats(),
          aiAPI.getDashboardStats(),
        ])
        setAuditStats(auditData)
        setAiStats(aiData)
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Could not load dashboard stats')
      }
    }
    loadStats()
  }, [])

  const stats = [
    { label: 'Audits', value: auditStats?.total ?? 0, icon: Mic, color: 'orange' },
    { label: 'Pending', value: auditStats?.pending ?? 0, icon: MessageSquare, color: 'blue' },
    { label: 'AI Insights', value: aiStats?.total_analyzed ?? 0, icon: Brain, color: 'green' },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dashboard"
        subtitle="Audit activity, feedback, and AI analysis at a glance."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>
      <Card className="p-6">
        <div className="flex items-center gap-3 text-white/70">
          <BarChart3 size={18} className="text-brand-400" />
          <span className="text-sm">Create audits from Manage Audits, upload audio, then collect feedback from the Feedback page.</span>
        </div>
      </Card>
    </div>
  )
}
