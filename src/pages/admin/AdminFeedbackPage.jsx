import { useEffect, useState } from 'react'
import { MessageSquare, Plus, RefreshCw, Trash2, Eye, X, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { feedbackAPI } from '../../api.js'
import { Badge, Card, EmptyState, SectionHeader } from '../../index.jsx'

export default function AdminFeedbackPage() {
  const [forms, setForms] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form Builder state
  const [formTitle, setFormTitle] = useState('Call Quality Feedback')
  const [formDesc, setFormDesc] = useState('Standard feedback form for call audits')
  const [builderQuestions, setBuilderQuestions] = useState([
    { question_text: 'Was the customer issue resolved clearly?', question_type: 'yes_no' },
    { question_text: 'How professional was the agent?', question_type: 'rating' },
    { question_text: 'What should be improved?', question_type: 'text' }
  ])

  // Submission Detail modal state
  const [selectedSubmission, setSelectedSubmission] = useState(null)

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

  const handleAddQuestion = () => {
    setBuilderQuestions([...builderQuestions, { question_text: '', question_type: 'text' }])
  }

  const handleRemoveQuestion = (index) => {
    setBuilderQuestions(builderQuestions.filter((_, i) => i !== index))
  }

  const handleUpdateText = (index, val) => {
    const updated = [...builderQuestions]
    updated[index].question_text = val
    setBuilderQuestions(updated)
  }

  const handleUpdateType = (index, val) => {
    const updated = [...builderQuestions]
    updated[index].question_type = val
    setBuilderQuestions(updated)
  }

  const createForm = async (event) => {
    event.preventDefault()
    if (!formTitle.trim()) {
      toast.error('Please add a form title')
      return
    }
    if (builderQuestions.length === 0) {
      toast.error('Please add at least one question')
      return
    }
    const emptyQ = builderQuestions.some(q => !q.question_text.trim())
    if (emptyQ) {
      toast.error('All questions must have text')
      return
    }

    setSaving(true)
    try {
      await feedbackAPI.createForm({
        title: formTitle,
        description: formDesc,
        questions: builderQuestions.map((q, idx) => ({
          question_text: q.question_text,
          question_type: q.question_type,
          order_index: idx
        }))
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
    <div className="space-y-6 relative">
      <SectionHeader
        title="Submissions & Form Builder"
        subtitle="Design a custom feedback form employees fill out, then review submitted database logs below."
        action={<button type="button" onClick={loadData} className="btn-secondary"><RefreshCw size={15} /> Refresh</button>}
      />

      {/* Dynamic Form Builder */}
      <Card className="p-6 space-y-4">
        <h3 className="font-display font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <MessageSquare size={18} className="text-brand" /> Custom Form Builder
        </h3>
        <p className="text-xs text-slate-400 dark:text-white/40">
          Design custom questionnaires. Saving a new form will mark previous forms as inactive.
        </p>

        <form onSubmit={createForm} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-white/45 mb-1.5 uppercase">Form Title</label>
              <input
                className="input-field"
                placeholder="Form Title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-white/45 mb-1.5 uppercase">Description</label>
              <input
                className="input-field"
                placeholder="Form Description"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-500 dark:text-white/45 uppercase">Form Questions</label>
            {builderQuestions.map((q, idx) => (
              <div key={idx} className="flex gap-3 items-center bg-slate-50 dark:bg-white/[0.02] p-3 rounded-xl border border-slate-100 dark:border-white/[0.04]">
                <span className="text-xs font-mono text-slate-400 dark:text-white/30">{idx + 1}</span>
                
                <input
                  className="input-field flex-1 text-xs"
                  placeholder="Question text (e.g. How resolved was the billing ticket?)"
                  value={q.question_text}
                  onChange={(e) => handleUpdateText(idx, e.target.value)}
                />

                <select
                  className="input-field w-32 text-xs py-1 px-2"
                  value={q.question_type}
                  onChange={(e) => handleUpdateType(idx, e.target.value)}
                >
                  <option value="text">Open Text</option>
                  <option value="rating">Rating (1-5)</option>
                  <option value="yes_no">Yes/No</option>
                </select>

                <button
                  type="button"
                  onClick={() => handleRemoveQuestion(idx)}
                  className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all flex items-center justify-center"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleAddQuestion} className="btn-secondary text-xs">
              <Plus size={14} /> Add Question
            </button>
            <button type="submit" disabled={saving} className="btn-primary text-xs ml-auto">
              {saving ? 'Saving Form...' : 'Deploy Feedback Form'}
            </button>
          </div>
        </form>
      </Card>

      {/* Database logs */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-display font-semibold text-slate-800 dark:text-white mb-4">Active Forms History</h3>
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-white/50">Loading forms...</p>
          ) : forms.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No forms yet" description="Deploy a custom form above." />
          ) : (
            <div className="space-y-3">
              {forms.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 dark:border-white/[0.06] p-4 bg-slate-50/50 dark:bg-transparent">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-white text-sm">{item.title}</p>
                      <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">{item.description}</p>
                    </div>
                    <Badge variant="blue">{item.question_count} questions</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold text-slate-800 dark:text-white mb-4">Feedback Database Logs</h3>
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-white/50">Loading submissions...</p>
          ) : submissions.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No submissions yet" description="Self-evaluations appear here after employees submit them." />
          ) : (
            <div className="space-y-3">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  onClick={() => setSelectedSubmission(submission)}
                  className="group rounded-xl border border-slate-200 dark:border-white/[0.06] p-4 bg-slate-50/50 dark:bg-transparent hover:border-brand/40 dark:hover:border-brand/40 transition-all cursor-pointer flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-white text-sm group-hover:text-brand transition-colors">
                      {submission.audit?.audit_id} - {submission.audit?.client_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
                      By: {submission.submitted_by?.full_name} ({submission.submitted_by?.email})
                    </p>
                    {submission.comments && (
                      <p className="text-xs text-slate-600 dark:text-white/60 mt-2 line-clamp-1 italic">
                        "{submission.comments}"
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <Badge variant="orange">{submission.overall_rating || '-'} / 5</Badge>
                    <span className="text-[10px] text-slate-400 dark:text-white/20 flex items-center gap-1">
                      <Eye size={12} /> View
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111118] border border-slate-200 dark:border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal header */}
            <div className="p-4 border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between">
              <div>
                <h4 className="font-display font-bold text-slate-800 dark:text-white">
                  Submission Details - {selectedSubmission.audit?.audit_id}
                </h4>
                <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
                  Client: {selectedSubmission.audit?.client_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal content */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Employee Meta */}
              <div className="grid grid-cols-2 gap-4 text-xs p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] rounded-xl">
                <div>
                  <span className="text-slate-400 dark:text-white/30 uppercase font-semibold text-[9px] block">Submitted By</span>
                  <span className="font-medium text-slate-800 dark:text-white">{selectedSubmission.submitted_by?.full_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-white/30 uppercase font-semibold text-[9px] block">Email</span>
                  <span className="font-medium text-slate-800 dark:text-white">{selectedSubmission.submitted_by?.email}</span>
                </div>
              </div>

              {/* QA List */}
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase block tracking-wider">
                  Self-Evaluation Form Answers
                </span>
                
                {selectedSubmission.answers && selectedSubmission.answers.length > 0 ? (
                  selectedSubmission.answers.map((qa, index) => (
                    <div key={index} className="space-y-1.5 border-b border-slate-100 dark:border-white/[0.04] pb-3 last:border-b-0 last:pb-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-white">
                        {index + 1}. {qa.question_text}
                      </p>
                      
                      {qa.question_type === 'rating' ? (
                        <div className="flex gap-1 items-center pt-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={14}
                              className={
                                i < Number(qa.answer_value || 0)
                                  ? 'text-amber-500 fill-amber-500'
                                  : 'text-slate-200 dark:text-white/10'
                              }
                            />
                          ))}
                          <span className="text-xs text-slate-400 ml-1.5 font-semibold">
                            ({qa.answer_value} / 5)
                          </span>
                        </div>
                      ) : qa.question_type === 'yes_no' ? (
                        <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          String(qa.answer_value).toLowerCase() === 'yes'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}>
                          {qa.answer_value}
                        </span>
                      ) : (
                        <p className="text-xs text-slate-600 dark:text-white/60 bg-slate-50 dark:bg-white/[0.01] p-2.5 rounded-lg border border-slate-100 dark:border-white/[0.02] italic leading-relaxed">
                          "{qa.answer_value || 'No response.'}"
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">No individual question answers found.</p>
                )}
              </div>

              {/* Overall Ratings & Comments */}
              <div className="pt-4 border-t border-slate-200 dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-wider">
                    Overall Satisfaction Rate
                  </span>
                  <Badge variant="orange">{selectedSubmission.overall_rating || '-'} / 5</Badge>
                </div>
                
                {selectedSubmission.comments && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-wider block">
                      General Reviewer Comments
                    </span>
                    <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed italic bg-slate-50 dark:bg-white/[0.01] p-3 border border-slate-100 dark:border-white/[0.02] rounded-xl">
                      "{selectedSubmission.comments}"
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-4 bg-slate-50 dark:bg-white/[0.01] border-t border-slate-200 dark:border-white/[0.06] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="btn-secondary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
