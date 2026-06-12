import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Mic, Play, Pause, Volume2, Calendar, Clock, ChevronLeft,
  Brain, FileText, MessageSquare, AlertTriangle, ShieldCheck, HeartPulse
} from 'lucide-react'
import toast from 'react-hot-toast'
import WaveSurfer from 'wavesurfer.js'
import api, { auditsAPI, aiAPI, feedbackAPI } from '../api.js'
import { Card, SectionHeader, Badge, ProgressBar, Skeleton } from '../index.jsx'

export default function AuditDetailPage() {
  const { id } = useParams()
  const [audit, setAudit] = useState(null)
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [loading, setLoading] = useState(true)
  const [audioSrc, setAudioSrc] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState('00:00')
  const [currentTime, setCurrentTime] = useState('00:00')
  
  const wsContainerRef = useRef(null)
  const wavesurferRef = useRef(null)

  
  const formatTime = (secs) => {
    if (isNaN(secs)) return '00:00'
    const minutes = Math.floor(secs / 60)
    const seconds = Math.floor(secs % 60)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  
  useEffect(() => {
    const loadAllDetails = async () => {
      setLoading(true)
      try {
        const auditData = await auditsAPI.getOne(id)
        setAudit(auditData)

        
        if (auditData.status === 'completed' || auditData.status === 'processing') {
          const aiData = await aiAPI.getAnalysis(id)
          if (aiData?.analysis) {
            setAiAnalysis(aiData.analysis)
          }
        }

        
        const feedbackSubmissions = await feedbackAPI.getMySubmissions()
        const matchedFeedback = feedbackSubmissions.submissions?.find(
          (sub) => String(sub.audit?.id) === String(id)
        )
        if (matchedFeedback) {
          setFeedback(matchedFeedback)
        }

        
        if (auditData.recording?.has_file) {
          const response = await api.get(`/api/recordings/stream/${id}`, {
            responseType: 'blob'
          })
          const blobUrl = URL.createObjectURL(response.data)
          setAudioSrc(blobUrl)
        }
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Could not load audit details')
      } finally {
        setLoading(false)
      }
    }

    loadAllDetails()

    return () => {
      if (audioSrc) URL.revokeObjectURL(audioSrc)
    }
  }, [id])

  
  useEffect(() => {
    if (!wsContainerRef.current || !audioSrc) return

    wavesurferRef.current = WaveSurfer.create({
      container: wsContainerRef.current,
      waveColor: 'var(--brand-muted)',
      progressColor: 'var(--brand)',
      height: 60,
      cursorWidth: 1,
      cursorColor: '#53161D', 
      barWidth: 2,
      barGap: 3,
      barRadius: 2,
      normalize: true
    })

    wavesurferRef.current.load(audioSrc)

    
    wavesurferRef.current.on('ready', () => {
      setDuration(formatTime(wavesurferRef.current.getDuration()))
    })

    wavesurferRef.current.on('audioprocess', () => {
      setCurrentTime(formatTime(wavesurferRef.current.getCurrentTime()))
    })

    wavesurferRef.current.on('seek', () => {
      setCurrentTime(formatTime(wavesurferRef.current.getCurrentTime()))
    })

    wavesurferRef.current.on('finish', () => {
      setIsPlaying(false)
      wavesurferRef.current.seekTo(0)
      setCurrentTime('00:00')
    })

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy()
      }
    }
  }, [audioSrc])

  const handlePlayPause = () => {
    if (!wavesurferRef.current) return
    wavesurferRef.current.playPause()
    setIsPlaying(wavesurferRef.current.isPlaying())
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 rounded" />
        <Card className="p-6">
          <Skeleton className="h-6 w-1/3 mb-4 rounded" />
          <Skeleton className="h-20 w-full mb-4 rounded" />
          <Skeleton className="h-10 w-full rounded" />
        </Card>
      </div>
    )
  }

  if (!audit) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Audit not found or access denied.</p>
        <Link to="/audits" className="btn-primary mt-4 inline-flex">Go back</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {}
      <div className="flex items-center gap-3">
        <Link to="/audits" className="w-8 h-8 rounded-xl border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-500 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all">
          <ChevronLeft size={16} />
        </Link>
        <SectionHeader
          title={`${audit.audit_id}`}
          subtitle={`Audit detail for client ${audit.client_name}`}
        />
      </div>

      {}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
            <Mic size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 dark:text-white/35 font-medium uppercase">Client Name</p>
            <p className="font-semibold text-slate-800 dark:text-white text-sm">{audit.client_name}</p>
          </div>
        </Card>
        
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
            <Calendar size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 dark:text-white/35 font-medium uppercase">Call Date</p>
            <p className="font-semibold text-slate-800 dark:text-white text-sm">
              {audit.call_date ? new Date(audit.call_date).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 dark:text-white/35 font-medium uppercase">Call Duration</p>
            <p className="font-semibold text-slate-800 dark:text-white text-sm">
              {audit.call_duration ? formatTime(audit.call_duration) : 'N/A'}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
            <ShieldCheck size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 dark:text-white/35 font-medium uppercase">Audit Status</p>
            <Badge variant={audit.status} className="mt-0.5">{audit.status}</Badge>
          </div>
        </Card>
      </div>

      {}
      <Card className="p-6 relative overflow-hidden">
        <h3 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Volume2 size={16} className="text-brand" /> Secure Call Player
        </h3>

        {audit.recording?.has_file ? (
          <div className="space-y-4">
            {}
            <div ref={wsContainerRef} className="rounded-xl bg-slate-50 dark:bg-black/20 p-4 border border-slate-100 dark:border-white/[0.04]" />
            
            {}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={handlePlayPause}
                className="w-12 h-12 rounded-2xl bg-brand hover:scale-105 active:scale-95 transition-all text-white flex items-center justify-center shadow-lg"
              >
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
              </button>
              
              <div className="flex items-center gap-2 font-mono text-xs text-slate-500 dark:text-white/40">
                <span>{currentTime}</span>
                <span>/</span>
                <span>{duration}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 border border-dashed border-slate-200 dark:border-white/10 rounded-xl text-slate-400 dark:text-white/20">
            <Mic size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Audio recording is unavailable or has expired (7-day rentention limit reached).</p>
          </div>
        )}
      </Card>

      {}
      {aiAnalysis ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {}
          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <Brain size={16} className="text-brand" /> AI Quality Metrics
              </h3>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-500 dark:text-white/60">Call Quality Score</span>
                    <span className="text-brand">{aiAnalysis.call_quality_score ?? 0}%</span>
                  </div>
                  <ProgressBar value={aiAnalysis.call_quality_score ?? 0} color="orange" />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-500 dark:text-white/60">Customer Satisfaction (CSAT)</span>
                    <span className="text-emerald-500">{aiAnalysis.customer_satisfaction_score ?? 0}%</span>
                  </div>
                  <ProgressBar value={aiAnalysis.customer_satisfaction_score ?? 0} color="green" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between">
                <span className="text-xs text-slate-400 dark:text-white/35 font-medium uppercase">Customer Sentiment</span>
                <Badge variant={aiAnalysis.sentiment_label}>{aiAnalysis.sentiment_label}</Badge>
              </div>
            </Card>

            {}
            {aiAnalysis.ai_suggestions && aiAnalysis.ai_suggestions.length > 0 && (
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                  <HeartPulse size={16} className="text-brand" /> Actionable Suggestions
                </h3>
                <ul className="space-y-2.5">
                  {aiAnalysis.ai_suggestions.map((suggestion, index) => (
                    <li key={index} className="text-xs text-slate-600 dark:text-white/70 leading-relaxed flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 flex-shrink-0" />
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <FileText size={16} className="text-brand" /> Call Transcription Summary
              </h3>
              <div className="text-sm text-slate-600 dark:text-white/80 leading-relaxed bg-slate-50 dark:bg-black/10 p-4 border border-slate-100 dark:border-white/[0.04] rounded-xl">
                {aiAnalysis.call_summary}
              </div>
              
              {aiAnalysis.key_points && aiAnalysis.key_points.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 dark:text-white/35 uppercase mb-2">Key Discussion Points</h4>
                  <ul className="space-y-2">
                    {aiAnalysis.key_points.map((point, index) => (
                      <li key={index} className="text-xs text-slate-600 dark:text-white/70 leading-relaxed flex items-start gap-2">
                        <span className="text-brand font-bold">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {aiAnalysis.identified_issues && aiAnalysis.identified_issues.length > 0 && (
                <div className="pt-4 border-t border-slate-100 dark:border-white/[0.04]">
                  <h4 className="text-xs font-semibold text-red-500 uppercase mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Identified Painpoints / Issues
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {aiAnalysis.identified_issues.map((issue, index) => (
                      <span key={index} className="text-[10px] font-medium px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                        {issue}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {}
            {aiAnalysis.transcription && (
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold text-slate-800 dark:text-white">Full AI-Generated Transcription</h3>
                <div className="max-h-96 overflow-y-auto pr-2 space-y-3 scrollbar">
                  <div className="text-xs text-slate-600 dark:text-white/70 whitespace-pre-wrap leading-relaxed">
                    {aiAnalysis.transcription}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Brain size={32} className="mx-auto text-brand opacity-30 animate-pulse mb-3" />
          <p className="text-sm font-semibold text-slate-800 dark:text-white">AI Analysis is Processing</p>
          <p className="text-xs text-slate-500 dark:text-white/40 mt-1 max-w-xs mx-auto">
            AI Speech-to-Text and evaluation are analyzing the conversation recording. Check back in a few moments.
          </p>
        </Card>
      )}

      {}
      {feedback && (
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <MessageSquare size={16} className="text-brand" /> Submitted Self-Evaluation Feedback
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] text-slate-400 dark:text-white/35 font-medium uppercase">Overall Rating</p>
              <Badge variant="orange" className="mt-1 text-sm font-bold">{feedback.overall_rating} / 5</Badge>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[10px] text-slate-400 dark:text-white/35 font-medium uppercase">Comments / Remarks</p>
              <p className="text-sm text-slate-600 dark:text-white/70 mt-1 italic">
                "{feedback.comments || 'No comment provided'}"
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
