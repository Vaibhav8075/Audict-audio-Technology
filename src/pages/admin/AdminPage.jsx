import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Shield, Users, FileAudio, MessageSquare, Download, Clock,
  RefreshCw, ChevronRight, UserPlus, FileBarChart2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { adminAPI } from '../../api.js'
import { Card, SectionHeader, StatCard, Skeleton, formatDateTime } from '../../index.jsx'

export default function AdminPage() {
  const [logs, setLogs] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [retentionDays, setRetentionDays] = useState(7)
  const [updatingRetention, setUpdatingRetention] = useState(false)

  const loadAdminDashboard = async () => {
    setLoading(true)
    try {
      const [logsData, analyticsData, retentionData] = await Promise.all([
        adminAPI.getLogs({ per_page: 10 }),
        adminAPI.getAnalytics(),
        adminAPI.getRetentionSettings()
      ])
      setLogs(logsData.logs || [])
      setSummary(analyticsData.summary || null)
      setRetentionDays(retentionData.retention_days ?? 7)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not load admin panel data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAdminDashboard()
  }, [])

  const handleExportCSV = () => {
    try {
      adminAPI.exportFeedbackCSV()
      toast.success('Preparing CSV feedback export...')
    } catch (error) {
      toast.error('Could not export feedback data')
    }
  }

  const handleUpdateRetention = async () => {
    setUpdatingRetention(true)
    try {
      await adminAPI.updateRetentionSettings(Number(retentionDays))
      toast.success('Audio retention policy updated successfully')
      await loadAdminDashboard()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not update retention policy')
    } finally {
      setUpdatingRetention(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 rounded" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Card className="p-6">
          <Skeleton className="h-40 w-full rounded-xl" />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      <SectionHeader
        title="Admin Panel"
        subtitle="Manage user accounts, monitor recording security, review audit metrics, and download reports."
        action={<button type="button" onClick={loadAdminDashboard} className="btn-secondary"><RefreshCw size={15} /> Refresh</button>}
      />

      {}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Registered Employees"
          value={summary?.total_users ?? 0}
          icon={Users}
          color="blue"
        />
        <StatCard
          label="Total Assigned Audits"
          value={summary?.total_audits ?? 0}
          icon={Shield}
          color="orange"
        />
        <StatCard
          label="Active Audio Storage"
          value={summary?.active_recordings ?? 0}
          icon={FileAudio}
          color="green"
        />
        <StatCard
          label="Permanent Feedback Submissions"
          value={summary?.total_feedback ?? 0}
          icon={MessageSquare}
          color="purple"
        />
      </div>

      {}
      <div className="grid gap-6 lg:grid-cols-3">
        {}
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-white">Admin Quick Actions</h3>
            <div className="space-y-2">
              <Link to="/admin/users" className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-white/[0.06] hover:border-brand/40 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-all group">
                <span className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-white/80">
                  <UserPlus size={16} className="text-brand" /> Manage User Accounts
                </span>
                <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link to="/admin/analytics" className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-white/[0.06] hover:border-brand/40 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-all group">
                <span className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-white/80">
                  <FileBarChart2 size={16} className="text-brand" /> Operational Analytics
                </span>
                <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link to="/admin/audits" className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-white/[0.06] hover:border-brand/40 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-all group">
                <span className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-white/80">
                  <Shield size={16} className="text-brand" /> Manage Audit Schedule
                </span>
                <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </Card>

          {}
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Download size={16} className="text-brand" /> Data Reports Export
            </h3>
            <p className="text-xs text-slate-500 dark:text-white/40 leading-relaxed">
              Export all employee self-evaluation responses and audit ratings into a single consolidated CSV file for offline reviews.
            </p>
            <button
              onClick={handleExportCSV}
              className="btn-primary w-full justify-center text-xs py-3"
            >
              <Download size={15} /> Export Feedback Responses (CSV)
            </button>
          </Card>

          {/* Audio Retention Policy settings */}
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Clock size={16} className="text-brand" /> Audio Retention Policy
            </h3>
            <p className="text-xs text-slate-500 dark:text-white/40 leading-relaxed">
              Configure the number of days call audio files are stored in active storage before they expire.
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={retentionDays}
                onChange={e => setRetentionDays(e.target.value)}
                className="input-field py-1.5 px-3 max-w-[100px] text-center"
              />
              <button
                onClick={handleUpdateRetention}
                disabled={updatingRetention}
                className="btn-primary flex-1 text-xs justify-center"
              >
                {updatingRetention ? 'Saving...' : 'Update Policy'}
              </button>
            </div>
          </Card>
        </div>

        {}
        <div className="lg:col-span-2">
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Clock size={16} className="text-brand" /> Recording Security Access Logs
            </h3>
            <p className="text-xs text-slate-500 dark:text-white/40">
              Audit trail showing playing and viewing events on secure call recording files.
            </p>

            <div className="border border-slate-100 dark:border-white/[0.06] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06] text-slate-500 dark:text-white/40 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">Audit ID</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">IP Address</th>
                      <th className="px-4 py-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-slate-600 dark:text-white/70">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                          No access logs recorded yet.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{log.audit_id}</td>
                          <td className="px-4 py-3">{log.user}</td>
                          <td className="px-4 py-3 capitalize">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              log.action === 'play' ? 'bg-sageGreen/10 text-sageGreen dark:text-sageGreen/90 border border-sageGreen/20' : 'bg-slateBlue/10 text-slateBlue dark:text-slateBlue/90 border border-slateBlue/20'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[10px]">{log.ip_address || 'local'}</td>
                          <td className="px-4 py-3 text-slate-400 font-mono text-[10px]">
                            {log.timestamp ? formatDateTime(log.timestamp, true) : 'N/A'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
