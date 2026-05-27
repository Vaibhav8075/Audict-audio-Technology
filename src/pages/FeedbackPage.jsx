import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, MessageSquare, RefreshCw, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { auditsAPI, feedbackAPI } from '../api.js'
import { Badge, Card, EmptyState, SectionHeader } from '../index.jsx'

export default function FeedbackPage() {
  const [audits, setAudits] = useState([])
  const [forms, setForms] = useState([])
  const [selectedAuditId, setSelectedAuditId] = useState('')
  const [selectedFormId, setSelectedFormId] = useState('')
  const [answers, setAnswers] = useState({})
  const [overallRating, setOverallRating] = useState(5)
  const [comments, setComments] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const selectedForm = useMemo(
    () => forms.find((form) => String(form.id) === String(selectedFormId)),
    [forms, selectedFormId],
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [auditData, formData] = await Promise.all([
        auditsAPI.getAll({ per_page: 100 }),
        feedbackAPI.getForms(),
      ])
      setAudits(auditData.audits || [])
      setForms(formData.forms || [])
      setSelectedAuditId((current) => current || (auditData.audits?.[0]?.id ? String(auditData.audits[0].id) : ''))
      setSelectedFormId((current) => current || (formData.forms?.[0]?.id ? String(formData.forms[0].id) : ''))
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not load feedback')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const check = async () => {
      if (!selectedAuditId || !selectedFormId) return
      try {
        const result = await feedbackAPI.checkSubmission(selectedAuditId, selectedFormId)
        setSubmitted(result.has_submitted)
      } catch {
        setSubmitted(false)
      }
    }
    check()
  }, [selectedAuditId, selectedFormId])

  const submitFeedback = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await feedbackAPI.submit({
        audit_id: Number(selectedAuditId),
        form_id: Number(selectedFormId),
        overall_rating: Number(overallRating),
        comments,
        answers: (selectedForm?.questions || []).map((question) => ({
          question_id: question.id,
          answer_value: answers[question.id] || '',
        })),
      })
      toast.success('Feedback submitted')
      setSubmitted(true)
      setComments('')
      setAnswers({})
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not submit feedback')
    } finally {
      setSaving(false)
    }
  }

  const renderQuestion = (question) => {
    const value = answers[question.id] || ''
    if (question.question_type === 'rating') {
      return (
        <select className="input-field" value={value} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })}>
          <option value="">Choose rating</option>
          {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
        </select>
      )
    }
    if (question.question_type === 'yes_no') {
      return (
        <select className="input-field" value={value} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })}>
          <option value="">Choose</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      )
    }
    return <textarea className="input-field min-h-24" value={value} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} />
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Feedback"
        subtitle="Submit feedback for an assigned audit."
        action={<button type="button" onClick={loadData} className="btn-secondary"><RefreshCw size={15} /> Refresh</button>}
      />

      {loading ? (
        <Card className="p-6 text-white/50">Loading feedback forms...</Card>
      ) : audits.length === 0 || forms.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={MessageSquare} title="Feedback needs an audit and a form" description="Create an audit in Manage Audits and create a form in Submissions." />
        </Card>
      ) : (
        <Card className="p-6">
          <form onSubmit={submitFeedback} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Audit</label>
                <select className="input-field" value={selectedAuditId} onChange={(event) => setSelectedAuditId(event.target.value)}>
                  {audits.map((audit) => <option key={audit.id} value={audit.id}>{audit.audit_id} - {audit.client_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Feedback form</label>
                <select className="input-field" value={selectedFormId} onChange={(event) => setSelectedFormId(event.target.value)}>
                  {forms.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}
                </select>
              </div>
            </div>

            {submitted && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                <CheckCircle2 size={16} /> Feedback has already been submitted for this audit and form.
              </div>
            )}

            {(selectedForm?.questions || []).map((question) => (
              <div key={question.id}>
                <label className="block text-sm font-medium text-white/70 mb-2">{question.question_text}</label>
                {renderQuestion(question)}
              </div>
            ))}

            <div className="grid gap-4 md:grid-cols-[160px,1fr]">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Overall rating</label>
                <select className="input-field" value={overallRating} onChange={(event) => setOverallRating(event.target.value)}>
                  {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Comments</label>
                <textarea className="input-field min-h-24" value={comments} onChange={(event) => setComments(event.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Badge variant={submitted ? 'green' : 'orange'}>{submitted ? 'submitted' : 'ready'}</Badge>
              <button type="submit" disabled={saving || submitted} className="btn-primary">
                <Send size={15} /> {saving ? 'Submitting...' : 'Submit feedback'}
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
