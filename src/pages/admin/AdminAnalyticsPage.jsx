import { useEffect, useState } from 'react'
import {
  TrendingUp, Award, MessageSquare, Shield,
  RefreshCw, Smile, Meh, Frown, Sparkles
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'
import { adminAPI } from '../../api.js'
import { Card, SectionHeader, StatCard, Skeleton, Badge, ProgressBar } from '../../index.jsx'

export default function AdminAnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const result = await adminAPI.getAnalytics()
      setData(result)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not load analytics metrics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 rounded" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Card className="p-6">
          <Skeleton className="h-60 w-full rounded-xl" />
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Could not retrieve analytics. Ensure database connections are active.</p>
        <button onClick={loadAnalytics} className="btn-primary mt-4 inline-flex">Retry</button>
      </div>
    )
  }

  // Format status data for Recharts BarChart
  const statusData = Object.entries(data.status_breakdown || {}).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    count
  }))

  // Format sentiment data for Recharts PieChart
  const sentimentColors = {
    positive: '#10b981', // emerald-500
    neutral: '#3b82f6',  // blue-500
    negative: '#ef4444'  // red-500
  }

  const sentimentData = Object.entries(data.sentiment_breakdown || {}).map(([sentiment, count]) => ({
    name: sentiment.charAt(0).toUpperCase() + sentiment.slice(1),
    value: count,
    color: sentimentColors[sentiment] || '#94a3b8'
  })).filter(item => item.value > 0)

  return (
    <div className="space-y-6 pb-12">
      <SectionHeader
        title="Operational Analytics"
        subtitle="Historical audit schedules, AI scores, customer satisfaction indicators, and daily trends."
        action={<button type="button" onClick={loadAnalytics} className="btn-secondary"><RefreshCw size={15} /> Refresh</button>}
      />

      {/* Aggregate Score Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Average Call Quality"
          value={`${data.scores?.avg_quality ?? 0}%`}
          icon={Award}
          color="orange"
        />
        <StatCard
          label="Average Customer Satisfaction"
          value={`${data.scores?.avg_satisfaction ?? 0}%`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          label="Permanent Feedback Score"
          value={`${data.scores?.avg_feedback_rating ?? 0} / 5`}
          icon={MessageSquare}
          color="purple"
        />
      </div>

      {/* Recharts Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Daily Audit volume over 7 days */}
        <Card className="lg:col-span-2 p-6 space-y-4">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Shield size={16} className="text-brand" /> Audit Activity Volume (Last 7 Days)
          </h3>
          <p className="text-xs text-slate-400 dark:text-white/35">Volume of assigned call audits tracked daily.</p>
          
          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily_trend || []} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: 'var(--text-primary)'
                  }}
                />
                <Area type="monotone" dataKey="count" stroke="var(--brand)" strokeWidth={2} fillOpacity={1} fill="url(#colorTrend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Sentiment PieChart */}
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Smile size={16} className="text-brand" /> AI Sentiment Distribution
          </h3>
          <p className="text-xs text-slate-400 dark:text-white/35">Aggregate caller feelings parsed by Groq Speech analysis.</p>

          <div className="h-48 w-full relative flex items-center justify-center">
            {sentimentData.length === 0 ? (
              <p className="text-xs text-slate-400">No sentiment data analyzed yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sentimentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {sentimentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface-card)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '12px',
                      fontSize: '11px',
                      color: 'var(--text-primary)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Custom legends */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.04] text-center text-[10px] font-semibold">
            <div className="text-emerald-500 flex flex-col items-center">
              <Smile size={15} />
              <span className="text-slate-500 dark:text-white/60 mt-1">Positive</span>
              <span className="text-sm font-bold mt-0.5">{data.sentiment_breakdown?.positive ?? 0}</span>
            </div>
            <div className="text-blue-500 flex flex-col items-center">
              <Meh size={15} />
              <span className="text-slate-500 dark:text-white/60 mt-1">Neutral</span>
              <span className="text-sm font-bold mt-0.5">{data.sentiment_breakdown?.neutral ?? 0}</span>
            </div>
            <div className="text-red-500 flex flex-col items-center">
              <Frown size={15} />
              <span className="text-slate-500 dark:text-white/60 mt-1">Negative</span>
              <span className="text-sm font-bold mt-0.5">{data.sentiment_breakdown?.negative ?? 0}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Status breakdown bar chart */}
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Sparkles size={16} className="text-brand" /> Audit Progress Schedules
          </h3>
          <p className="text-xs text-slate-400 dark:text-white/35">Tracking operational status breakdown of assigned tasks.</p>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: 'var(--text-primary)'
                  }}
                />
                <Bar dataKey="count" fill="var(--brand)" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Custom statistics overview details */}
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <TrendingUp size={16} className="text-brand" /> Operational Highlights
          </h3>
          <p className="text-xs text-slate-400 dark:text-white/35">Key statistics from the past week of call recording audits.</p>
          
          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="text-slate-500 dark:text-white/60">Weekly uploads versus active database files</span>
                <span className="font-semibold text-slate-800 dark:text-white">
                  {data.summary?.weekly_uploads ?? 0} uploads
                </span>
              </div>
              <ProgressBar value={data.summary?.active_recordings ? Math.round(((data.summary?.weekly_uploads ?? 0) / data.summary.active_recordings) * 100) : 0} color="orange" />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="text-slate-500 dark:text-white/60">Feedback collection coverage across scheduled audits</span>
                <span className="font-semibold text-slate-800 dark:text-white">
                  {data.summary?.total_feedback ?? 0} responses
                </span>
              </div>
              <ProgressBar value={data.summary?.total_audits ? Math.round(((data.summary?.total_feedback ?? 0) / data.summary.total_audits) * 100) : 0} color="green" />
            </div>
            
            <div className="pt-4 border-t border-slate-100 dark:border-white/[0.04] grid grid-cols-2 gap-4 text-center">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04]">
                <p className="text-[10px] text-slate-400 uppercase">New Audits (Weekly)</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white mt-0.5">{data.summary?.weekly_audits ?? 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04]">
                <p className="text-[10px] text-slate-400 uppercase">Total User base</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white mt-0.5">{data.summary?.total_users ?? 0}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
