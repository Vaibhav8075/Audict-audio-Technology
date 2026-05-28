import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, FileAudio, Mic, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { auditsAPI } from '../api.js'
import { Badge, Card, EmptyState, SectionHeader } from '../index.jsx'

export default function AuditsPage() {
  const [audits, setAudits] = useState([])
  const [loading, setLoading] = useState(true)

  const loadAudits = async () => {
    setLoading(true)
    try {
      const data = await auditsAPI.getAll({ per_page: 100 })
      setAudits(data.audits || [])
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not load audits')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAudits()
  }, [])

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Audits"
        subtitle="Assigned call audits and uploaded recording status."
        action={<button type="button" onClick={loadAudits} className="btn-secondary"><RefreshCw size={15} /> Refresh</button>}
      />

      {loading ? (
        <Card className="p-6 text-slate-500 dark:text-white/50">Loading audits...</Card>
      ) : audits.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Mic} title="No audits available" description="Admins create audits and upload audio from Manage Audits." />
        </Card>
      ) : (
        <div className="grid gap-4">
          {audits.map((audit) => (
            <Card key={audit.id} className="p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display font-semibold text-slate-800 dark:text-white">{audit.audit_id}</h3>
                    <Badge variant={audit.status}>{audit.status}</Badge>
                    {audit.recording?.has_file ? <Badge variant="green">audio ready</Badge> : <Badge variant="gray">no audio</Badge>}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-white/60 mt-1">{audit.client_name} - {audit.employee_name}</p>
                  <p className="text-xs text-slate-400 dark:text-white/35 mt-1 flex items-center gap-1">
                    <Calendar size={13} /> {audit.call_date ? new Date(audit.call_date).toLocaleString() : 'No date'}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-400 dark:text-white/40">
                  <div className="flex items-center gap-1.5">
                    <FileAudio size={16} /> {audit.recording?.has_file ? 'Uploaded' : 'Waiting for upload'}
                  </div>
                  {audit.recording?.has_file && (
                    <Link to={`/audits/${audit.id}`} className="btn-primary text-xs py-1.5 px-3">
                      Review call
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
