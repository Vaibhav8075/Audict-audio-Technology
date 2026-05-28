import { useEffect, useState } from 'react'
import { MessageSquare, Plus, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { feedbackAPI } from '../../api.js'
import { Badge, Card, EmptyState, SectionHeader } from '../../index.jsx'

export default function AdminFeedbackPage() {
  const [forms, setForms] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: 'Call Quality Feedback',
    description: 'Standard feedback form for call audits',
    q1: 'Was the customer issue resolved clearly?',
    q2: 'How professional was the agent?',
    q3: 'What should be improved?',
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const [formData, submissionData] = await Promise.all([
        feedbackAPI.getForms(),
        feedbackAPI.getAllSubmissions({ per_page: 100 }),
      ])
      setForms(formData.forms || [])
      setSubmissions(submissionData.submissions || [])
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not load feedback')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const createForm = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await feedbackAPI.createForm({
        title: form.title,
        description: form.description,
        questions: [
          { question_text: form.q1, question_type: 'yes_no', order_index: 0 },
          { question_text: form.q2, question_type: 'rating', order_index: 1 },
          { question_text: form.q3, question_type: 'text', order_index: 2 },
        ],
      })
      toast.success('Feedback form created')
      await loadData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not create form')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Submissions"
        subtitle="Create the feedback form employees will fill, then review responses here."
        action={<button type="button" onClick={loadData} className="btn-secondary"><RefreshCw size={15} /> Refresh</button>}
      />

      <Card className="p-6">
        <form onSubmit={createForm} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <input className="input-field" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            <input className="input-field" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <input className="input-field" value={form.q1} onChange={(event) => setForm({ ...form, q1: event.target.value })} />
            <input className="input-field" value={form.q2} onChange={(event) => setForm({ ...form, q2: event.target.value })} />
            <input className="input-field" value={form.q3} onChange={(event) => setForm({ ...form, q3: event.target.value })} />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            <Plus size={15} /> {saving ? 'Creating...' : 'Create feedback form'}
          </button>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-display font-semibold text-slate-800 dark:text-white mb-4">Active forms</h3>
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-white/50">Loading forms...</p>
          ) : forms.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No forms yet" description="Create one above." />
          ) : (
            <div className="space-y-3">
              {forms.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 dark:border-white/[0.06] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-white">{item.title}</p>
                      <p className="text-xs text-slate-500 dark:text-white/40">{item.description}</p>
                    </div>
                    <Badge variant="blue">{item.question_count} questions</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold text-slate-800 dark:text-white mb-4">Recent submissions</h3>
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-white/50">Loading submissions...</p>
          ) : submissions.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No submissions yet" description="Employees will appear here after submitting feedback." />
          ) : (
            <div className="space-y-3">
              {submissions.map((submission) => (
                <div key={submission.id} className="rounded-xl border border-slate-200 dark:border-white/[0.06] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-white">{submission.audit?.audit_id} - {submission.audit?.client_name}</p>
                      <p className="text-xs text-slate-500 dark:text-white/40">{submission.submitted_by?.full_name} - {submission.form_title}</p>
                      {submission.comments && <p className="text-sm text-slate-600 dark:text-white/60 mt-2">{submission.comments}</p>}
                    </div>
                    <Badge variant="orange">{submission.overall_rating || '-'} / 5</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
