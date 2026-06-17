import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Brain, Mic, Award, MessageSquareHeart, AlertTriangle, KeyRound,
  TrendingUp, RefreshCw, Smile, Meh, Frown, Sparkles
} from 'lucide-react'
import toast from 'react-hot-toast'
import { aiAPI, auditsAPI } from '../api.js'
import { Card, SectionHeader, StatCard, Badge, ProgressBar, Skeleton, EmptyState } from '../index.jsx'

export default function AIInsightsPage() {
  const [stats, setStats] = useState(null)
  const [audits, setAudits] = useState([])
  const [loading, setLoading] = useState(true)

  const loadAiInsights = async () => {
    setLoading(true)
    try {
      const [aiData, auditData] = await Promise.all([
        aiAPI.getDashboardStats(),
        auditsAPI.getAll({ per_page: 100 })
      ])
      setStats(aiData)
      
      
      const completedAudits = auditData.audits?.filter(
        (a) => a.ai_summary || a.status === 'completed'
      ) || []
      setAudits(completedAudits)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not load AI Insights')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAiInsights()
  }, [])

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

  if (!stats || stats.total_analyzed === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="AI Insights"
          subtitle="Conversation analysis, sentiment, quality scores, and actionable feedback."
          action={<button type="button" onClick={loadAiInsights} className="btn-secondary"><RefreshCw size={15} /> Refresh</button>}
        />
        <Card className="p-8">
          <EmptyState
            icon={Brain}
            title="No AI Analysis Available"
            description="Upload an audio recording to an audit. Once processed by AI, your conversational reports will show up here."
            action={<Link to="/audits" className="btn-primary mt-2 inline-flex">Go to My Audits</Link>}
          />
        </Card>
      </div>
    )
  }

  
  const total = stats.total_analyzed
  const posPct = Math.round((stats.sentiment_breakdown?.positive / total) * 100) || 0
  const neuPct = Math.round((stats.sentiment_breakdown?.neutral / total) * 100) || 0
  const negPct = Math.round((stats.sentiment_breakdown?.negative / total) * 100) || 0

  return (
    <div className="space-y-6 pb-12">
      <SectionHeader
        title="AI Insights"
        subtitle="Intelligent conversation auditing, customer sentiment, and communication quality analysis."
        action={<button type="button" onClick={loadAiInsights} className="btn-secondary"><RefreshCw size={15} /> Refresh</button>}
      />

      {}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Analyzed Calls"
          value={stats.total_analyzed}
          icon={Mic}
          color="blue"
        />
        <StatCard
          label="Average Quality Score"
          value={`${stats.avg_quality}%`}
          icon={Award}
          color="orange"
        />
        <StatCard
          label="Average CSAT Score"
          value={`${stats.avg_satisfaction}%`}
          icon={MessageSquareHeart}
          color="green"
        />
        <StatCard
          label="Net Sentiment Index"
          value={stats.avg_sentiment >= 0 ? `+${stats.avg_sentiment.toFixed(2)}` : stats.avg_sentiment.toFixed(2)}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {}
        <div className="space-y-6">
          {}
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Smile size={16} className="text-brand" /> Sentiment Distribution
            </h3>
            
            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-white/60">
                    <Smile size={14} className="text-sageGreen" /> Positive sentiment
                  </span>
                  <span className="font-semibold text-sageGreen dark:text-sageGreen/90">{posPct}%</span>
                </div>
                <ProgressBar value={posPct} color="green" />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-white/60">
                    <Meh size={14} className="text-slate-400" /> Neutral sentiment
                  </span>
                  <span className="font-semibold text-slate-400">{neuPct}%</span>
                </div>
                <ProgressBar value={neuPct} color="blue" />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-white/60">
                    <Frown size={14} className="text-bordeauxVelvet dark:text-red-300" /> Negative sentiment
                  </span>
                  <span className="font-semibold text-bordeauxVelvet dark:text-red-300">{negPct}%</span>
                </div>
                <ProgressBar value={negPct} color="red" />
              </div>
            </div>
          </Card>

          {}
          {stats.top_keywords && stats.top_keywords.length > 0 && (
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <KeyRound size={16} className="text-brand" /> Conversational Keywords
              </h3>
              <p className="text-xs text-slate-400 dark:text-white/35">Recurring themes and subjects extracted by AI.</p>
              
              <div className="flex flex-wrap gap-2 pt-2">
                {stats.top_keywords.map((kw, i) => (
                  <span
                    key={i}
                    className="text-xs px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-white/70 border border-slate-200 dark:border-white/[0.06] hover:border-brand/40 transition-colors flex items-center gap-1"
                  >
                    {kw.keyword}
                    <span className="text-[10px] text-slate-400 dark:text-white/30 font-semibold bg-slate-200 dark:bg-white/5 px-1.5 py-0.2 rounded">
                      {kw.count}
                    </span>
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>

        {}
        <div className="lg:col-span-2 space-y-6">
          {}
          {stats.needs_attention && stats.needs_attention.length > 0 && (
            <Card className="p-6 border-bordeauxVelvet/10 dark:border-bordeauxVelvet/20 bg-bordeauxVelvet/[0.02]">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2 mb-1">
                <AlertTriangle size={16} className="text-bordeauxVelvet dark:text-red-300" /> Customer Painpoints Requiring Attention
              </h3>
              <p className="text-xs text-slate-500 dark:text-red-300/60 mb-4">
                These calls were flagged with negative sentiment scores or quality alerts. Review suggestions immediately to improve retention.
              </p>
              
              <div className="space-y-2.5">
                {stats.needs_attention.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-bordeauxVelvet/10 dark:border-bordeauxVelvet/15 bg-white dark:bg-bordeauxVelvet/5 p-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">{item.audit_id}</p>
                      <p className="text-xs text-slate-400 dark:text-red-300/40 mt-0.5">Sentiment score: {item.sentiment_score}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="red" className="font-bold">{item.quality_score}% Quality</Badge>
                      <Link to={`/audits/${item.audit_id}`} className="text-xs font-semibold text-bordeauxVelvet dark:text-red-300 hover:underline">
                        View details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {}
          {stats.top_issues && stats.top_issues.length > 0 && (
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <AlertTriangle size={16} className="text-brand" /> Recurring Service Painpoints
              </h3>
              
              <div className="space-y-3.5">
                {stats.top_issues.map((item, index) => {
                  const pct = Math.round((item.count / total) * 100)
                  return (
                    <div key={index}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium text-slate-600 dark:text-white/70">{item.issue}</span>
                        <span className="text-slate-400 dark:text-white/40">{item.count} occurrences ({pct}%)</span>
                      </div>
                      <ProgressBar value={pct} color="orange" />
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {}
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Sparkles size={16} className="text-brand" /> Processed Call Reports
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {audits.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 dark:border-white/[0.06] p-4 hover:border-brand/40 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-white text-sm">{item.audit_id}</p>
                      <p className="text-xs text-slate-400 dark:text-white/40 mt-1">{item.campaign_name} - {item.employee_name}</p>
                      {item.ai_summary?.call_summary && (
                        <p className="text-xs text-slate-500 dark:text-white/60 mt-2 line-clamp-2 leading-relaxed">
                          {item.ai_summary.call_summary}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end gap-2.5 flex-shrink-0">
                      <Badge variant={item.ai_summary?.sentiment_label ?? 'neutral'}>
                        {item.ai_summary?.sentiment_label ?? 'neutral'}
                      </Badge>
                      <Link to={`/audits/${item.id}`} className="text-xs font-semibold text-brand hover:underline">
                        Review call
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
